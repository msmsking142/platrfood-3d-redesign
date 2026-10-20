import type { Selectable } from "kysely";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { HttpError } from "./requireRole";
import type { RestaurantPayouts } from "./schema";

type TargetStatus = Selectable<RestaurantPayouts>["status"];

type TransitionInput = {
  kind: "restaurant" | "rider";
  payoutId: number;
  to: TargetStatus;
  utrReference?: string;
  reason?: string;
  adminUserId: number;
};

const allowedFrom: Record<TargetStatus, TargetStatus[]> = {
  approved: ["pending", "failed"],
  processing: ["approved"],
  paid: ["approved", "processing"],
  failed: ["approved", "processing"],
  on_hold: ["pending", "approved", "failed"],
  pending: ["on_hold"],
};

function changesFor(input: TransitionInput, now: Date) {
  switch (input.to) {
    case "approved":
      return {
        status: "approved" as const,
        approvedAt: now,
        approvedByUserId: input.adminUserId,
        failureReason: null,
      };
    case "processing":
      return { status: "processing" as const, processingAt: now };
    case "paid": {
      const reference = input.utrReference?.trim();
      if (!reference || reference.length < 4 || reference.length > 60) {
        throw new HttpError(400, "Transfer reference must be 4–60 characters");
      }
      return {
        status: "paid" as const,
        paidAt: now,
        utrReference: reference,
        transferMode: "manual",
      };
    }
    case "failed": {
      const reason = input.reason?.trim();
      if (!reason) {
        throw new HttpError(400, "A failure reason is required");
      }
      return { status: "failed" as const, failureReason: reason };
    }
    case "on_hold":
      return { status: "on_hold" as const, note: input.reason?.trim() || null };
    case "pending":
      return { status: "pending" as const, note: null };
  }
}

export const payoutWorkflow = {
  async transition(input: TransitionInput): Promise<{ ok: true }> {
    try {
      const table =
        input.kind === "restaurant" ? "restaurantPayouts" : "riderPayouts";
      const changes = changesFor(input, new Date());

      return await db.transaction().execute(async (transaction) => {
        const payout = await transaction
          .updateTable(table)
          .set(changes)
          .where("id", "=", input.payoutId)
          .where("status", "in", allowedFrom[input.to])
          .returning(["id", "amount"])
          .executeTakeFirst();

        if (!payout) {
          throw new HttpError(
            409,
            "Payout does not exist or cannot make this transition",
          );
        }

        if (input.to === "approved" || input.to === "paid") {
          if (payout.amount <= 0) {
            throw new HttpError(400, "Payout amount must be positive");
          }

          const payee =
            input.kind === "restaurant"
              ? await transaction
                  .selectFrom("restaurantPayouts")
                  .innerJoin(
                    "restaurants",
                    "restaurants.id",
                    "restaurantPayouts.restaurantId",
                  )
                  .select([
                    "restaurantPayouts.restaurantId as payeeId",
                    "restaurants.payoutUpiId as upiId",
                    "restaurants.payoutAccountNumber as accountNumber",
                    "restaurants.payoutIfsc as ifsc",
                  ])
                  .where("restaurantPayouts.id", "=", payout.id)
                  .executeTakeFirst()
              : await transaction
                  .selectFrom("riderPayouts")
                  .innerJoin("riders", "riders.id", "riderPayouts.riderId")
                  .select([
                    "riderPayouts.riderId as payeeId",
                    "riders.payoutUpiId as upiId",
                    "riders.payoutAccountNumber as accountNumber",
                    "riders.payoutIfsc as ifsc",
                  ])
                  .where("riderPayouts.id", "=", payout.id)
                  .executeTakeFirst();

          if (!payee) {
            throw new Error(
              `Payee for ${input.kind} payout ${payout.id} was not found`,
            );
          }

          if (input.to === "approved") {
            const hasPaymentDetails =
              Boolean(payee.upiId?.trim()) ||
              (Boolean(payee.accountNumber?.trim()) &&
                Boolean(payee.ifsc?.trim()));

            if (!hasPaymentDetails) {
              throw new HttpError(
                400,
                "Add the payee's UPI or bank details before approval",
              );
            }
          } else {
            const recorded = await financialLedger.record(
              transaction,
              input.kind === "restaurant"
                ? {
                    key: `restaurant_payout:${payout.id}`,
                    entryType: "restaurant_payout",
                    amount: -payout.amount,
                    restaurantId: payee.payeeId,
                    restaurantPayoutId: payout.id,
                  }
                : {
                    key: `rider_payout:${payout.id}`,
                    entryType: "rider_payout",
                    amount: -payout.amount,
                    riderId: payee.payeeId,
                    riderPayoutId: payout.id,
                  },
            );

            if (!recorded) {
              throw new Error(
                `Ledger entry already exists for ${input.kind} payout ${payout.id}`,
              );
            }

            if (input.kind === "rider") {
              await transaction
                .updateTable("riderEarnings")
                .set({ status: "paid" })
                .where("payoutId", "=", payout.id)
                .execute();
            }
          }
        }

        return { ok: true };
      });
    } catch (error) {
      console.error(
        `Payout transition failed (${input.kind} ${input.payoutId} → ${input.to}):`,
        error,
      );
      throw error;
    }
  },
};