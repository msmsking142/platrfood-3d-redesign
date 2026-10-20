import superjson from "superjson";
import { sql } from "kysely";
import { publish } from "@floot/realtime";
import { db } from "../../helpers/db";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { financialLedger } from "../../helpers/financialLedger";
import { channels } from "../../helpers/realtimeChannels";
import { HttpError, requireRole } from "../../helpers/requireRole";
import {
  schema,
  type InputType,
  type OutputType,
} from "./delivery_protection_action_POST.schema";

const CANCEL_CODE = "PLATFORM_DELIVERY_FAILURE";

async function publishChanges(restaurantId?: number) {
  const messages = [
    { channel: channels.admin(), data: { type: "admin" } },
    ...(restaurantId === undefined
      ? []
      : [{
          channel: channels.restaurant(restaurantId),
          data: { type: "status" },
        }]),
  ];
  for (const message of messages) {
    try {
      await publish(message.channel, message.data);
    } catch (error) {
      console.error(`Delivery-protection publish failed on ${message.channel}:`, error);
    }
  }
}

async function decideCompensation(
  input: Extract<InputType, { action: "compensation_decision" }>,
  adminUserId: number,
) {
  return db.transaction().execute(async (transaction) => {
    const compensation = await transaction
      .selectFrom("restaurantCompensations")
      .selectAll()
      .where("id", "=", input.compensationId)
      .forUpdate()
      .executeTakeFirst();
    if (!compensation) throw new HttpError(404, "Compensation not found");

    const now = new Date();
    let message: string;
    if (input.decision === "approve") {
      if (!["not_eligible", "disputed", "rejected"].includes(compensation.status)) {
        throw new HttpError(409, "This compensation cannot be approved from its current status");
      }
      if (compensation.adjustmentId !== null) {
        throw new HttpError(409, "This compensation already has an adjustment");
      }
      if (input.amount === undefined || input.amount <= 0) {
        throw new HttpError(400, "Enter a compensation amount greater than zero");
      }

      const adjustment = await transaction
        .insertInto("restaurantAdjustments")
        .values({
          restaurantId: compensation.restaurantId,
          orderId: compensation.orderId,
          amount: input.amount,
          reason: `Delivery failure compensation – order #${compensation.orderId}`,
          createdByUserId: adminUserId,
          payoutId: null,
          foodComplaintId: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await transaction
        .updateTable("restaurantCompensations")
        .set({
          status: "approved",
          amount: input.amount,
          adjustmentId: adjustment.id,
          adminNote: input.note,
          decidedByUserId: adminUserId,
          decidedAt: now,
          updatedAt: now,
        })
        .where("id", "=", compensation.id)
        .execute();

      const record = {
        entryType: "restaurant_payable" as const,
        amount: input.amount,
        orderId: compensation.orderId,
        restaurantId: compensation.restaurantId,
        note: input.note,
        createdByUserId: adminUserId,
      };
      const inserted = await financialLedger.record(transaction, {
        ...record,
        key: `order:${compensation.orderId}:restaurant_compensation`,
      });
      if (!inserted) {
        const restored = await financialLedger.record(transaction, {
          ...record,
          key: `order:${compensation.orderId}:restaurant_compensation:${adjustment.id}`,
        });
        if (!restored) throw new Error("Could not record compensation in the ledger");
      }
      message = `Compensation approved for order #${compensation.orderId}`;
    } else if (input.decision === "reject") {
      if (!["disputed", "not_eligible"].includes(compensation.status)) {
        throw new HttpError(409, "Only disputed or ineligible compensation can be rejected");
      }
      await transaction
        .updateTable("restaurantCompensations")
        .set({
          status: "rejected",
          adminNote: input.note,
          decidedByUserId: adminUserId,
          decidedAt: now,
          updatedAt: now,
        })
        .where("id", "=", compensation.id)
        .execute();
      message = `Compensation rejected for order #${compensation.orderId}`;
    } else {
      if (compensation.status !== "approved" || compensation.adjustmentId === null) {
        throw new HttpError(409, "Only an approved, unsettled compensation can be revoked");
      }
      const adjustment = await transaction
        .selectFrom("restaurantAdjustments")
        .select(["id", "payoutId"])
        .where("id", "=", compensation.adjustmentId)
        .forUpdate()
        .executeTakeFirst();
      if (!adjustment) throw new HttpError(409, "Compensation adjustment is missing");
      if (adjustment.payoutId !== null) {
        throw new HttpError(409, `Already included in payout #${adjustment.payoutId}`);
      }
      await transaction
        .updateTable("restaurantCompensations")
        .set({
          status: "rejected",
          amount: 0,
          adjustmentId: null,
          adminNote: input.note,
          decidedByUserId: adminUserId,
          decidedAt: now,
          updatedAt: now,
        })
        .where("id", "=", compensation.id)
        .execute();
      const deleted = await transaction
        .deleteFrom("restaurantAdjustments")
        .where("id", "=", adjustment.id)
        .where("payoutId", "is", null)
        .returning("id")
        .executeTakeFirst();
      if (!deleted) {
        throw new HttpError(409, "Already included in a payout");
      }
      const recorded = await financialLedger.record(transaction, {
        key: `order:${compensation.orderId}:restaurant_compensation_revoked:${adjustment.id}`,
        entryType: "restaurant_payable",
        amount: -compensation.amount,
        orderId: compensation.orderId,
        restaurantId: compensation.restaurantId,
        note: input.note,
        createdByUserId: adminUserId,
      });
      if (!recorded && compensation.amount !== 0) {
        throw new Error("Could not record compensation reversal in the ledger");
      }
      message = `Compensation revoked for order #${compensation.orderId}`;
    }

    await deliveryProtection.logEvent(
      transaction,
      compensation.orderId,
      `compensation_${input.decision}`,
      null,
      {
        compensationId: compensation.id,
        amount: input.decision === "approve" ? input.amount! : input.decision === "revoke" ? 0 : compensation.amount,
        note: input.note,
        adminUserId,
      },
    );
    return { message, restaurantId: compensation.restaurantId };
  });
}

export async function handle(request: Request) {
  try {
    const admin = await requireRole(request, ["admin"]);
    const input = schema.parse(superjson.parse(await request.text()));
    let message: string;
    let restaurantId: number | undefined;

    switch (input.action) {
      case "settings": {
        if (input.riderSearchExpandedRadiusM < input.riderSearchRadiusM) {
          throw new HttpError(400, "Expanded radius cannot be smaller than initial radius");
        }
        if (input.deliveryFailureCompMax < input.deliveryFailureCompMin) {
          throw new HttpError(400, "Maximum compensation cannot be less than minimum");
        }
        const { action, ...settings } = input;
        const updated = await db
          .updateTable("appSettings")
          .set({ ...settings, updatedAt: new Date() })
          .where("id", "=", 1)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new HttpError(404, "App settings not found");
        message = "Delivery protection settings saved";
        break;
      }
      case "compensation_decision": {
        const result = await decideCompensation(input, admin.id);
        message = result.message;
        restaurantId = result.restaurantId;
        break;
      }
      case "resume_area": {
        const updated = await db
          .updateTable("serviceAreas")
          .set({
            ordersPausedUntil: null,
            ordersPauseReason: null,
            updatedAt: new Date(),
          })
          .where(
            sql<string>`lower(${sql.ref("town")})`,
            "=",
            input.town.toLowerCase(),
          )
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new HttpError(404, "Service area not found");
        message = `Orders resumed in ${input.town}`;
        break;
      }
      case "pause_area": {
        await db.transaction().execute(async (transaction) => {
          const area = await transaction
            .selectFrom("serviceAreas")
            .select("id")
            .where(
              sql<string>`lower(${sql.ref("town")})`,
              "=",
              input.town.toLowerCase(),
            )
            .forUpdate()
            .executeTakeFirst();
          const pausedUntil = new Date(Date.now() + input.minutes * 60_000);
          if (area) {
            await transaction
              .updateTable("serviceAreas")
              .set({
                ordersPausedUntil: pausedUntil,
                ordersPauseReason: input.reason,
                updatedAt: new Date(),
              })
              .where("id", "=", area.id)
              .execute();
          } else {
            await transaction
              .insertInto("serviceAreas")
              .values({
                town: input.town,
                isActive: true,
                ordersPausedUntil: pausedUntil,
                ordersPauseReason: input.reason,
              })
              .execute();
          }
        });
        message = `Orders paused in ${input.town}`;
        break;
      }
      case "retry_refund": {
        const order = await db
          .selectFrom("orders")
          .select(["cancelCode", "paymentStatus"])
          .where("id", "=", input.orderId)
          .executeTakeFirst();
        if (!order) throw new HttpError(404, "Order not found");
        if (order.cancelCode !== CANCEL_CODE || order.paymentStatus !== "paid") {
          throw new HttpError(409, "Only a paid delivery-failure order can have its refund retried");
        }
        await deliveryProtection.refundFailedOrder(input.orderId);
        const after = await db
          .selectFrom("orders")
          .select("paymentStatus")
          .where("id", "=", input.orderId)
          .executeTakeFirstOrThrow();
        message = after.paymentStatus === "refunded"
          ? `Refund completed for order #${input.orderId}`
          : `Refund for order #${input.orderId} is still pending; check the recorded failure before retrying`;
        break;
      }
    }

    await publishChanges(restaurantId);
    return requireRole.json({ ok: true, message } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}