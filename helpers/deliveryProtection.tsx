// BACKEND ONLY. Orchestrates rider search, delivery-failure cancellation,
// refunds, merchant compensation, and temporary service-area pauses.
import type { Selectable } from "kysely";
import { sql } from "kysely";
import { cancelQueuedTask, queueTask } from "@floot/queueTask";
import { publish } from "@floot/realtime";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { notifyZipto } from "./notifyZipto";
import { orderPayments } from "./orderPayments";
import { channels } from "./realtimeChannels";
import { riderSearchDecision, type SearchState } from "./riderSearchDecision";
import type { OrderDeliveryEvents, Orders } from "./schema";

const CANCEL_CODE = "PLATFORM_DELIVERY_FAILURE";
const ACTIVE = ["accepted", "preparing", "ready"] as const;

type EventDetail = Selectable<OrderDeliveryEvents>["detail"];
type SearchPatch = Partial<
  Pick<
    Selectable<Orders>,
    | "riderSearchStage"
    | "riderSearchRadiusM"
    | "riderSearchDeadlineAt"
    | "riderSearchIncentive"
    | "deliveryAtRiskAt"
    | "riderBonus"
    | "riderPayout"
    | "contribution"
    | "updatedAt"
  >
>;

function searchStage(value: string | null): SearchState["stage"] {
  if (
    value === null ||
    value === "initial" ||
    value === "expanded" ||
    value === "priority"
  ) {
    return value;
  }
  throw new Error(`Unknown rider-search stage: ${value}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const deliveryProtection = {
  async logEvent(
    executor: typeof db,
    orderId: number,
    type: Selectable<OrderDeliveryEvents>["eventType"],
    keySuffix: string | null,
    detail: EventDetail = null,
  ): Promise<void> {
    await executor
      .insertInto("orderDeliveryEvents")
      .values({
        orderId,
        eventType: type,
        eventKey: keySuffix ? `${orderId}:${keySuffix}` : null,
        detail,
      })
      .onConflict((conflict) => conflict.column("eventKey").doNothing())
      .execute();
  },

  async scheduleTick(orderId: number, at: Date): Promise<void> {
    try {
      await queueTask(
        "riderSearchTick",
        { orderId },
        {
          delayMs: Math.max(60_000, at.getTime() - Date.now() + 5_000),
          key: `rs-${orderId}`,
        },
      );
    } catch (error) {
      // Delayed tasks are limited project-wide; dashboard sweeps provide
      // another opportunity to advance an unscheduled search.
      console.error(`Could not schedule rider search for order ${orderId}:`, error);
    }
  },

  async unschedule(orderId: number): Promise<void> {
    for (const key of [`rs-${orderId}`, `norider-${orderId}`]) {
      try {
        await cancelQueuedTask({ key });
      } catch (error) {
        console.error(`Could not cancel delivery timer ${key}:`, error);
      }
    }
  },

  async onRestaurantAccepted(orderId: number): Promise<void> {
    await deliveryProtection.logEvent(db, orderId, "restaurant_accepted", "accepted");
    await deliveryProtection.tick(orderId);
  },

  async onPreparing(orderId: number): Promise<void> {
    await deliveryProtection.logEvent(db, orderId, "preparing_started", "preparing");
  },

  async onReady(orderId: number): Promise<void> {
    await deliveryProtection.logEvent(db, orderId, "ready", "ready");
    await deliveryProtection.tick(orderId);
  },

  async onRiderAssigned(orderId: number, riderId: number): Promise<void> {
    const now = new Date();
    const assigned = await db
      .updateTable("orders")
      .set({ riderAssignedAt: now })
      .where("id", "=", orderId)
      .where("riderAssignedAt", "is", null)
      .returning("restaurantAcceptedAt")
      .executeTakeFirst();

    if (assigned) {
      await deliveryProtection.logEvent(
        db,
        orderId,
        "rider_assigned",
        "rider_assigned",
        {
          riderId,
          matchingSeconds: assigned.restaurantAcceptedAt
            ? Math.max(
                0,
                Math.floor(
                  (now.getTime() - assigned.restaurantAcceptedAt.getTime()) / 1000,
                ),
              )
            : null,
        },
      );
    }
    await deliveryProtection.unschedule(orderId);
  },

  async tick(
    orderId: number,
  ): Promise<{ cancelled: boolean; notifiedAtRisk: boolean }> {
    try {
      const result = await db.transaction().execute(async (transaction) => {
        const order = await transaction
          .selectFrom("orders")
          .select([
            "status",
            "riderId",
            "restaurantId",
            "town",
            "restaurantAcceptedAt",
            "readyAt",
            "riderSearchStage",
            "riderSearchRadiusM",
            "riderSearchDeadlineAt",
            "riderSearchIncentive",
            "deliveryAtRiskAt",
            "itemsTotal",
            "riderBonus",
            "riderPayout",
            "contribution",
          ])
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const settingsRow = await transaction
          .selectFrom("appSettings")
          .selectAll()
          .where("id", "=", 1)
          .executeTakeFirstOrThrow();

        const restaurant = await transaction
          .selectFrom("restaurants")
          .select("avgPrepMinutes")
          .where("id", "=", order.restaurantId)
          .executeTakeFirstOrThrow();

        const settings = riderSearchDecision.fromSettingsRow(settingsRow);
        const now = new Date();
        const state: SearchState = {
          status: order.status,
          riderId: order.riderId,
          restaurantAcceptedAt: order.restaurantAcceptedAt,
          readyAt: order.readyAt,
          stage: searchStage(order.riderSearchStage),
          radiusM: order.riderSearchRadiusM,
          deadlineAt: order.riderSearchDeadlineAt,
          incentive: order.riderSearchIncentive,
          atRiskAt: order.deliveryAtRiskAt,
        };
        const decision = riderSearchDecision.decide(state, settings, now);

        if (!decision.active) {
          return {
            cancelled: false,
            notifiedAtRisk: false,
            changed: false,
            nextCheckAt: null,
            town: order.town,
            restaurantId: order.restaurantId,
          };
        }

        const patch: SearchPatch = {};
        if (decision.patch.stage !== undefined) {
          patch.riderSearchStage = decision.patch.stage;
        }
        if (decision.patch.radiusM !== undefined) {
          patch.riderSearchRadiusM = decision.patch.radiusM;
        }
        if (decision.patch.deadlineAt !== undefined) {
          patch.riderSearchDeadlineAt = decision.patch.deadlineAt;
        }
        if (decision.patch.atRiskAt !== undefined) {
          patch.deliveryAtRiskAt = decision.patch.atRiskAt;
        }
        if (decision.patch.incentive !== undefined) {
          const delta = decision.patch.incentive - order.riderSearchIncentive;
          patch.riderSearchIncentive = decision.patch.incentive;
          patch.riderBonus = order.riderBonus + delta;
          patch.riderPayout = order.riderPayout + delta;
          patch.contribution = order.contribution - delta;
        }

        const changed = Object.keys(patch).length > 0;
        if (changed) {
          patch.updatedAt = now;
          await transaction
            .updateTable("orders")
            .set(patch)
            .where("id", "=", orderId)
            .execute();
        }

        for (const event of decision.events) {
          // The pure decision supplies JSON-safe primitives in its event details.
          await deliveryProtection.logEvent(
            transaction,
            orderId,
            event.type,
            event.key,
            event.detail as EventDetail,
          );
        }

        let cancelled = false;
        if (decision.cancel) {
          const updated = await transaction
            .updateTable("orders")
            .set({
              status: "cancelled",
              cancelCode: CANCEL_CODE,
              cancelReason:
                "No delivery partner was available for your order. You'll get a 100% refund (food, delivery and fees) — no cancellation fee.",
              noRiderCancelledAt: now,
              updatedAt: now,
            })
            .where("id", "=", orderId)
            .where("riderId", "is", null)
            .where("status", "in", ACTIVE)
            .returning("id")
            .executeTakeFirst();

          cancelled = updated !== undefined;
          if (cancelled) {
            await deliveryProtection.logEvent(
              transaction,
              orderId,
              "auto_cancelled",
              "auto_cancelled",
              {
                deadlineAt: riderSearchDecision
                  .computeDeadline(state, settings)
                  ?.toISOString() ?? null,
                stage: decision.patch.stage ?? state.stage,
                code: CANCEL_CODE,
              },
            );

            const compensation = riderSearchDecision.compensation(
              {
                readyAt: order.readyAt,
                restaurantAcceptedAt: order.restaurantAcceptedAt,
                avgPrepMinutes: restaurant.avgPrepMinutes,
                itemsTotal: order.itemsTotal,
              },
              settings,
            );
            const status = compensation.eligible ? "approved" : "not_eligible";
            const created = await transaction
              .insertInto("restaurantCompensations")
              .values({
                orderId,
                restaurantId: order.restaurantId,
                amount: compensation.amount,
                status,
                reason: compensation.reason,
                calculation: compensation.calculation,
              })
              .onConflict((conflict) => conflict.column("orderId").doNothing())
              .returning("id")
              .executeTakeFirst();

            if (created) {
              if (compensation.eligible && compensation.amount > 0) {
                const adjustment = await transaction
                  .insertInto("restaurantAdjustments")
                  .values({
                    restaurantId: order.restaurantId,
                    orderId,
                    amount: compensation.amount,
                    reason: `Delivery failure compensation – order #${orderId}`,
                    payoutId: null,
                    foodComplaintId: null,
                    createdByUserId: null,
                  })
                  .returning("id")
                  .executeTakeFirstOrThrow();

                await transaction
                  .updateTable("restaurantCompensations")
                  .set({ adjustmentId: adjustment.id })
                  .where("id", "=", created.id)
                  .execute();

                await financialLedger.record(transaction, {
                  key: `order:${orderId}:restaurant_compensation`,
                  entryType: "restaurant_payable",
                  amount: compensation.amount,
                  orderId,
                  restaurantId: order.restaurantId,
                  note: "Delivery failure compensation (platr™ cost)",
                });
              }

              await deliveryProtection.logEvent(
                transaction,
                orderId,
                "compensation_created",
                "compensation",
                { status, amount: compensation.amount },
              );
            }
          }
        }

        return {
          cancelled,
          notifiedAtRisk: decision.notifyAtRisk,
          changed,
          nextCheckAt: decision.nextCheckAt,
          town: order.town,
          restaurantId: order.restaurantId,
        };
      });

      if (result.cancelled) {
        try {
          await notifyZipto(orderId);
        } catch (error) {
          console.error(`Could not notify participants for failed order ${orderId}:`, error);
        }

        await deliveryProtection.refundFailedOrder(orderId);
        await deliveryProtection.evaluateAreaPause(result.town);

        for (const [channel, message] of [
          [channels.admin(), { type: "admin" }],
          [
            channels.restaurant(result.restaurantId),
            { type: "order", orderId },
          ],
        ] as const) {
          try {
            await publish(channel, message);
          } catch (error) {
            console.error(`Could not publish delivery failure on ${channel}:`, error);
          }
        }
      } else {
        if (result.changed) {
          try {
            await notifyZipto(orderId);
          } catch (error) {
            console.error(`Could not notify rider-search update for order ${orderId}:`, error);
          }
        }
        if (result.nextCheckAt) {
          await deliveryProtection.scheduleTick(orderId, result.nextCheckAt);
        }
      }

      return {
        cancelled: result.cancelled,
        notifiedAtRisk: result.notifiedAtRisk,
      };
    } catch (error) {
      console.error(`Delivery-protection tick failed for order ${orderId}:`, error);
      throw error;
    }
  },

  async refundFailedOrder(orderId: number): Promise<void> {
    try {
      await deliveryProtection.logEvent(
        db,
        orderId,
        "refund_initiated",
        "refund_initiated",
      );
      await orderPayments.refundIfPaid(
        orderId,
        "Platform delivery failure – 100% refund",
      );

      const payment = await db
        .selectFrom("orders")
        .select(["paymentStatus", "paymentMethod", "razorpayRefundId"])
        .where("id", "=", orderId)
        .executeTakeFirstOrThrow();

      if (payment.paymentStatus === "refunded") {
        await deliveryProtection.logEvent(
          db,
          orderId,
          "refund_succeeded",
          "refund_succeeded",
          {
            method: payment.paymentMethod,
            refundId: payment.razorpayRefundId,
          },
        );
      } else if (payment.paymentStatus === "paid") {
        throw new Error(`Paid order ${orderId} remains unrefunded`);
      }
    } catch (error) {
      console.error(`Delivery-failure refund failed for order ${orderId}:`, error);
      const message = errorMessage(error).slice(0, 300);

      try {
        await db
          .updateTable("orders")
          .set({
            refundFailedAt: new Date(),
            refundFailureReason: message,
          })
          .where("id", "=", orderId)
          .where("paymentStatus", "=", "paid")
          .where("razorpayRefundId", "is", null)
          .execute();
      } catch (updateError) {
        console.error(`Could not record refund failure for order ${orderId}:`, updateError);
      }

      try {
        await deliveryProtection.logEvent(
          db,
          orderId,
          "refund_failed",
          `refund_failed:${Date.now()}`,
          { message },
        );
      } catch (eventError) {
        console.error(`Could not log refund failure for order ${orderId}:`, eventError);
      }

      try {
        await publish(channels.admin(), { type: "admin" });
      } catch (publishError) {
        console.error(`Could not alert admin about refund for order ${orderId}:`, publishError);
      }
    }
  },

  async evaluateAreaPause(town: string): Promise<void> {
    try {
      const settings = await db
        .selectFrom("appSettings")
        .select([
          "areaPauseEnabled",
          "areaPauseLookbackMin",
          "areaPauseFailureThreshold",
          "areaPauseDurationMin",
        ])
        .where("id", "=", 1)
        .executeTakeFirstOrThrow();
      if (!settings.areaPauseEnabled) return;

      const now = new Date();
      const since = new Date(
        now.getTime() - settings.areaPauseLookbackMin * 60_000,
      );
      const failures = await db
        .selectFrom("orders")
        .select(sql<number>`count(*)::integer`.as("count"))
        .where("cancelCode", "=", CANCEL_CODE)
        .where(sql<string>`lower(${sql.ref("town")})`, "=", town.toLowerCase())
        .where("noRiderCancelledAt", ">=", since)
        .executeTakeFirstOrThrow();

      if (failures.count < settings.areaPauseFailureThreshold) return;

      const pausedUntil = new Date(
        now.getTime() + settings.areaPauseDurationMin * 60_000,
      );
      const reason =
        `Auto-paused: ${failures.count} delivery failures in ` +
        `${settings.areaPauseLookbackMin} min`;
      const area = await db
        .selectFrom("serviceAreas")
        .select("id")
        .where(sql<string>`lower(${sql.ref("town")})`, "=", town.toLowerCase())
        .executeTakeFirst();

      if (area) {
        await db
          .updateTable("serviceAreas")
          .set({
            ordersPausedUntil: pausedUntil,
            ordersPauseReason: reason,
            updatedAt: now,
          })
          .where("id", "=", area.id)
          .where((expression) =>
            expression.or([
              expression("ordersPausedUntil", "is", null),
              expression("ordersPausedUntil", "<", pausedUntil),
            ]),
          )
          .execute();
      } else {
        await db
          .insertInto("serviceAreas")
          .values({
            town,
            isActive: true,
            ordersPausedUntil: pausedUntil,
            ordersPauseReason: reason,
          })
          .execute();
      }
    } catch (error) {
      console.error(`Could not evaluate delivery pause for ${town}:`, error);
    }
  },

  async availability(
    town: string,
  ): Promise<{ available: boolean; reason: string | null; pausedUntil: Date | null }> {
    const settings = await db
      .selectFrom("appSettings")
      .select("areaPauseWhenNoRiders")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const area = await db
      .selectFrom("serviceAreas")
      .select("ordersPausedUntil")
      .where(sql<string>`lower(${sql.ref("town")})`, "=", town.toLowerCase())
      .executeTakeFirst();
    const now = new Date();

    if (area?.ordersPausedUntil && area.ordersPausedUntil > now) {
      const time = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(area.ordersPausedUntil);

      return {
        available: false,
        reason:
          `Deliveries in ${town} are paused for a short while because ` +
          `delivery partners are busy. Please try again after ${time}.`,
        pausedUntil: area.ordersPausedUntil,
      };
    }

    if (settings.areaPauseWhenNoRiders) {
      const recent = new Date(now.getTime() - 15 * 60_000);
      const riders = await db
        .selectFrom("riders")
        .select(sql<number>`count(*)::integer`.as("count"))
        .where("status", "=", "approved")
        .where("isOnline", "=", true)
        .where(sql<string>`lower(${sql.ref("town")})`, "=", town.toLowerCase())
        .where("lastLocationAt", ">=", recent)
        .executeTakeFirstOrThrow();

      if (riders.count === 0) {
        return {
          available: false,
          reason:
            `No delivery partners are online in ${town} right now. ` +
            "Please try again shortly.",
          pausedUntil: null,
        };
      }
    }

    return { available: true, reason: null, pausedUntil: null };
  },

  async sweep(filter?: {
    customerUserId?: number;
    restaurantId?: number;
    town?: string;
  }): Promise<number> {
    const settings = await db
      .selectFrom("appSettings")
      .select("riderSearchExpandAfterMin")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const now = new Date();
    const expandBefore = new Date(
      now.getTime() - settings.riderSearchExpandAfterMin * 60_000,
    );

    let searches = db
      .selectFrom("orders")
      .select("id")
      .where("riderId", "is", null)
      .where("status", "in", ACTIVE)
      .where("restaurantAcceptedAt", "is not", null)
      .where((expression) =>
        expression.or([
          expression("riderSearchStage", "is", null),
          expression("riderSearchDeadlineAt", "<=", now),
          expression.and([
            expression("riderSearchStage", "=", "initial"),
            expression("restaurantAcceptedAt", "<=", expandBefore),
          ]),
          expression.and([
            expression("readyAt", "is not", null),
            expression("riderSearchStage", "!=", "priority"),
          ]),
        ]),
      );

    if (filter?.customerUserId !== undefined) {
      searches = searches.where("customerUserId", "=", filter.customerUserId);
    }
    if (filter?.restaurantId !== undefined) {
      searches = searches.where("restaurantId", "=", filter.restaurantId);
    }
    if (filter?.town !== undefined) {
      searches = searches.where(
        sql<string>`lower(${sql.ref("town")})`,
        "=",
        filter.town.toLowerCase(),
      );
    }

    const due = await searches
      .orderBy("restaurantAcceptedAt", "asc")
      .limit(20)
      .execute();
    let ticked = 0;
    for (const order of due) {
      try {
        await deliveryProtection.tick(order.id);
        ticked += 1;
      } catch (error) {
        console.error(`Could not sweep rider search for order ${order.id}:`, error);
      }
    }

    let refunds = db
      .selectFrom("orders")
      .select("id")
      .where("cancelCode", "=", CANCEL_CODE)
      .where("paymentStatus", "=", "paid")
      .where("razorpayRefundId", "is", null)
      .where("refundFailedAt", "is", null)
      .where("noRiderCancelledAt", "<=", new Date(now.getTime() - 120_000));

    if (filter?.customerUserId !== undefined) {
      refunds = refunds.where("customerUserId", "=", filter.customerUserId);
    }
    if (filter?.restaurantId !== undefined) {
      refunds = refunds.where("restaurantId", "=", filter.restaurantId);
    }
    if (filter?.town !== undefined) {
      refunds = refunds.where(
        sql<string>`lower(${sql.ref("town")})`,
        "=",
        filter.town.toLowerCase(),
      );
    }

    const pendingRefunds = await refunds
      .orderBy("noRiderCancelledAt", "asc")
      .limit(10)
      .execute();
    for (const order of pendingRefunds) {
      await deliveryProtection.refundFailedOrder(order.id);
    }

    return ticked;
  },
};