import type { Selectable } from "kysely";
import { db } from "./db";
import { deliveryPricing } from "./deliveryPricing";
import { pricingSettings } from "./pricingSettings";
import type { LedgerEntries, OrderStatus } from "./schema";

type LedgerRecordInput = {
  key: Selectable<LedgerEntries>["idempotencyKey"];
} & Pick<Selectable<LedgerEntries>, "entryType" | "amount"> &
  Partial<
    Pick<
      Selectable<LedgerEntries>,
      | "orderId"
      | "restaurantId"
      | "riderId"
      | "restaurantPayoutId"
      | "riderPayoutId"
      | "note"
      | "createdByUserId"
    >
  >;

function earningEligibleAt(start: Date, holdHours: number): Date {
  if (!Number.isFinite(holdHours) || holdHours < 0) {
    throw new Error("Rider earning hold hours must be non-negative");
  }

  const timestamp = start.getTime() + holdHours * 60 * 60 * 1000;
  if (!Number.isFinite(timestamp)) {
    throw new Error("Could not calculate rider earning eligibility date");
  }

  return new Date(timestamp);
}

export const financialLedger = {
  async record(
    executor: typeof db,
    input: LedgerRecordInput,
  ): Promise<boolean> {
    try {
      if (!input.key.trim()) {
        throw new Error("Ledger idempotency key cannot be empty");
      }
      if (!Number.isSafeInteger(input.amount)) {
        throw new Error(`Ledger amount must be whole rupees: ${input.key}`);
      }
      if (input.amount === 0) return false;

      const inserted = await executor
        .insertInto("ledgerEntries")
        .values({
          idempotencyKey: input.key,
          entryType: input.entryType,
          amount: input.amount,
          orderId: input.orderId ?? null,
          restaurantId: input.restaurantId ?? null,
          riderId: input.riderId ?? null,
          restaurantPayoutId: input.restaurantPayoutId ?? null,
          riderPayoutId: input.riderPayoutId ?? null,
          note: input.note ?? null,
          createdByUserId: input.createdByUserId ?? null,
        })
        .onConflict((conflict) =>
          conflict.column("idempotencyKey").doNothing(),
        )
        .returning("id")
        .executeTakeFirst();

      return inserted !== undefined;
    } catch (error) {
      console.error(`Could not record ledger entry ${input.key}:`, error);
      throw error;
    }
  },

  async onPaymentCaptured(
    orderId: number,
    { gatewayFeePaise }: { gatewayFeePaise?: number | null } = {},
  ): Promise<void> {
    try {
      await db.transaction().execute(async (transaction) => {
        const order = await transaction
          .selectFrom("orders")
          .select(["id", "total", "paymentMethod", "gatewayFee"])
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirst();

        if (!order) throw new Error(`Order ${orderId} does not exist`);
        if (order.paymentMethod !== "upi" && order.paymentMethod !== "wallet") {
          throw new Error(
            `Cannot record a captured payment for COD order ${orderId}`,
          );
        }

        await financialLedger.record(transaction, {
          key: `order:${orderId}:customer_payment`,
          entryType: "customer_payment",
          amount: order.total,
          orderId,
        });

        if (gatewayFeePaise == null) return;
        if (
          !Number.isSafeInteger(gatewayFeePaise) ||
          gatewayFeePaise < 0
        ) {
          throw new Error(
            `Invalid gateway fee in paise for order ${orderId}`,
          );
        }

        const gatewayFee = Math.round(gatewayFeePaise / 100);
        if (
          order.gatewayFee !== null &&
          order.gatewayFee !== gatewayFee
        ) {
          throw new Error(
            `Gateway fee for order ${orderId} differs from its recorded fee`,
          );
        }

        if (order.gatewayFee === null) {
          const updated = await transaction
            .updateTable("orders")
            .set({ gatewayFee, updatedAt: new Date() })
            .where("id", "=", orderId)
            .where("gatewayFee", "is", null)
            .returning("id")
            .executeTakeFirst();

          if (!updated) {
            throw new Error(
              `Could not store gateway fee for order ${orderId}`,
            );
          }
        }

        await financialLedger.record(transaction, {
          key: `order:${orderId}:gateway_fee`,
          entryType: "gateway_fee",
          amount: gatewayFee,
          orderId,
        });
      });
    } catch (error) {
      console.error(
        `Could not record captured payment for order ${orderId}:`,
        error,
      );
      throw error;
    }
  },

  async onOrderDelivered(orderId: number): Promise<void> {
    try {
      await db.transaction().execute(async (transaction) => {
        const order = await transaction
          .selectFrom("orders")
          .selectAll()
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirst();

        if (!order) throw new Error(`Order ${orderId} does not exist`);
        if (order.status !== "delivered" || order.riderId === null) {
          console.error(
            `Cannot record delivery for order ${orderId}: order is not delivered or has no rider`,
          );
          return;
        }
        if (order.deliveredAt === null) {
          throw new Error(
            `Delivered order ${orderId} has no delivery timestamp`,
          );
        }

        const { row: settingsRow } = await pricingSettings.load(
          order.town,
          transaction,
        );
        const existingEarning = await transaction
          .selectFrom("riderEarnings")
          .select("id")
          .where("orderId", "=", orderId)
          .where("entryType", "=", "delivery")
          .executeTakeFirst();

        if (!existingEarning) {
          await transaction
            .insertInto("riderEarnings")
            .values({
              orderId,
              riderId: order.riderId,
              entryType: "delivery",
              basePay: order.riderBasePay,
              distancePay: order.riderDistancePay,
              incentive: order.riderBonus,
              amount: order.riderPayout,
              status: "pending",
              eligibleAt: earningEligibleAt(
                order.deliveredAt,
                settingsRow.riderEarningHoldHours,
              ),
              payoutId: null,
              note: null,
              createdByUserId: null,
            })
            .execute();
        }

        const paymentEntry: LedgerRecordInput | null =
          order.paymentMethod === "cod"
            ? {
                key: `order:${orderId}:cod_collected`,
                entryType: "cod_collected",
                amount: order.total,
                orderId,
                riderId: order.riderId,
              }
            : order.paymentStatus === "paid"
              ? {
                  key: `order:${orderId}:restaurant_payable`,
                  entryType: "restaurant_payable",
                  amount: order.restaurantPayout,
                  orderId,
                  restaurantId: order.restaurantId,
                }
              : null;

        const entries: LedgerRecordInput[] = [
          ...(paymentEntry ? [paymentEntry] : []),
          {
            key: `order:${orderId}:rider_payable`,
            entryType: "rider_payable",
            amount: order.riderPayout,
            orderId,
            riderId: order.riderId,
          },
          {
            key: `order:${orderId}:platform_commission`,
            entryType: "platform_commission",
            amount: order.commissionAmount,
            orderId,
            restaurantId: order.restaurantId,
          },
          {
            key: `order:${orderId}:platform_fee`,
            entryType: "platform_fee",
            amount: order.platformFee,
            orderId,
          },
          {
            key: `order:${orderId}:delivery_revenue`,
            entryType: "delivery_revenue",
            amount:
              order.deliveryFee +
              order.surgeFee +
              order.smallOrderFee -
              order.ziptoDiscount,
            orderId,
          },
          {
            key: `order:${orderId}:tax_collected`,
            entryType: "tax_collected",
            amount:
              order.foodTax +
              order.deliveryTax +
              order.commissionTax,
            orderId,
          },
          {
            key: `order:${orderId}:zipto_delivery_subsidy`,
            entryType: "zipto_delivery_subsidy",
            amount: order.ziptoDeliverySubsidy,
            orderId,
          },
        ];

        for (const entry of entries) {
          await financialLedger.record(transaction, entry);
        }
      });
    } catch (error) {
      console.error(
        `Could not record delivery finances for order ${orderId}:`,
        error,
      );
      throw error;
    }
  },

  async onOrderClosed(
    orderId: number,
    statusBeforeCancel: OrderStatus,
  ): Promise<void> {
    try {
      await db.transaction().execute(async (transaction) => {
        const order = await transaction
          .selectFrom("orders")
          .select([
            "id",
            "status",
            "town",
            "riderId",
            "riderPayout",
          ])
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirst();

        if (!order) throw new Error(`Order ${orderId} does not exist`);
        if (
          (order.status !== "cancelled" &&
            order.status !== "rejected") ||
          order.riderId === null
        ) {
          return;
        }

        const { row, settings } = await pricingSettings.load(
          order.town,
          transaction,
        );
        const amount = deliveryPricing.riderCancellationPay({
          statusAtCancel: statusBeforeCancel,
          riderAssigned: true,
          riderTotal: order.riderPayout,
          settings,
        });
        if (amount <= 0) return;
        if (!Number.isSafeInteger(amount)) {
          throw new Error(
            `Invalid rider cancellation pay for order ${orderId}`,
          );
        }

        const note =
          statusBeforeCancel === "picked_up"
            ? "Cancelled after pickup – failed delivery, full pay"
            : "Cancelled after rider accepted – compensation";

        const existingEarning = await transaction
          .selectFrom("riderEarnings")
          .select("id")
          .where("orderId", "=", orderId)
          .where("entryType", "=", "cancellation")
          .executeTakeFirst();

        if (!existingEarning) {
          await transaction
            .insertInto("riderEarnings")
            .values({
              orderId,
              riderId: order.riderId,
              entryType: "cancellation",
              basePay: amount,
              distancePay: 0,
              incentive: 0,
              amount,
              status: "pending",
              eligibleAt: earningEligibleAt(
                new Date(),
                row.riderEarningHoldHours,
              ),
              payoutId: null,
              note,
              createdByUserId: null,
            })
            .execute();
        }

        await financialLedger.record(transaction, {
          key: `order:${orderId}:rider_cancellation_pay`,
          entryType: "rider_payable",
          amount,
          orderId,
          riderId: order.riderId,
          note,
        });
      });
    } catch (error) {
      console.error(
        `Could not record rider cancellation pay for order ${orderId}:`,
        error,
      );
      throw error;
    }
  },

  async onRefund(orderId: number, refundId: string): Promise<void> {
    try {
      if (!refundId.trim()) {
        throw new Error(`Refund ID is missing for order ${orderId}`);
      }

      const order = await db
        .selectFrom("orders")
        .select(["id", "total"])
        .where("id", "=", orderId)
        .executeTakeFirst();

      if (!order) throw new Error(`Order ${orderId} does not exist`);

      const previousFailure = await db
        .selectFrom("ledgerEntries")
        .select("id")
        .where(
          "idempotencyKey",
          "like",
          `order:${orderId}:customer\\_refund\\_failed:%`,
        )
        .limit(1)
        .executeTakeFirst();

      await financialLedger.record(db, {
        key: previousFailure
          ? `order:${orderId}:customer_refund:${refundId}`
          : `order:${orderId}:customer_refund`,
        entryType: "customer_refund",
        amount: -order.total,
        orderId,
        note: refundId,
      });
    } catch (error) {
      console.error(`Could not record refund for order ${orderId}:`, error);
      throw error;
    }
  },

  async addRiderAdjustment({
    riderId,
    amount,
    note,
    adminUserId,
  }: {
    riderId: number;
    amount: number;
    note: string;
    adminUserId: number;
  }): Promise<number> {
    try {
      if (!Number.isSafeInteger(amount) || amount === 0) {
        throw new Error("Rider adjustment must be a non-zero whole-rupee amount");
      }
      const trimmedNote = note.trim();
      if (!trimmedNote) {
        throw new Error("Rider adjustment requires a note");
      }

      return await db.transaction().execute(async (transaction) => {
        const earning = await transaction
          .insertInto("riderEarnings")
          .values({
            riderId,
            orderId: null,
            payoutId: null,
            entryType: "adjustment",
            basePay: 0,
            distancePay: 0,
            incentive: 0,
            amount,
            status: "eligible",
            eligibleAt: new Date(),
            note: trimmedNote,
            createdByUserId: adminUserId,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        const inserted = await financialLedger.record(transaction, {
          key: `rider_adjustment:${earning.id}`,
          entryType: "adjustment",
          amount,
          riderId,
          note: trimmedNote,
          createdByUserId: adminUserId,
        });

        if (!inserted) {
          throw new Error(
            `Could not record ledger entry for rider adjustment ${earning.id}`,
          );
        }

        return earning.id;
      });
    } catch (error) {
      console.error(
        `Could not add adjustment for rider ${riderId}:`,
        error,
      );
      throw error;
    }
  },

  async promoteEligibleRiderEarnings(
    now: Date = new Date(),
  ): Promise<number> {
    try {
      if (Number.isNaN(now.getTime())) {
        throw new Error("Invalid rider earning eligibility date");
      }

      const promoted = await db
        .updateTable("riderEarnings")
        .set({ status: "eligible" })
        .where("status", "=", "pending")
        .where("eligibleAt", "<=", now)
        .returning("id")
        .execute();

      return promoted.length;
    } catch (error) {
      console.error("Could not promote eligible rider earnings:", error);
      throw error;
    }
  },
};