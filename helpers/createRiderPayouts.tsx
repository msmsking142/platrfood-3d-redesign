import { sql, type Selectable } from "kysely";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import type { RiderPayouts } from "./schema";

const MISSING_DETAILS_NOTE = "Add UPI / bank details in rider profile";
const NON_POSITIVE_NOTE = "Net amount is not positive – review adjustments";

type PayoutStatus = Selectable<RiderPayouts>["status"];

export async function createRiderPayouts(
  cutoff: Date,
): Promise<{ ridersProcessed: number; entriesLinked: number; failed: number }> {
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error("Rider payout cutoff must be a valid date");
  }

  let ridersProcessed = 0;
  let entriesLinked = 0;
  let failed = 0;

  try {
    await financialLedger.promoteEligibleRiderEarnings();

    const riders = await db
      .selectFrom("riderEarnings")
      .select("riderId")
      .distinct()
      .where("status", "=", "eligible")
      .where("payoutId", "is", null)
      .where("eligibleAt", "<", cutoff)
      .execute();

    for (const { riderId } of riders) {
      try {
        const result = await db.transaction().execute(async (transaction) => {
          const entries = await transaction
            .selectFrom("riderEarnings")
            .select(["id", "amount", "createdAt"])
            .where("riderId", "=", riderId)
            .where("status", "=", "eligible")
            .where("payoutId", "is", null)
            .where("eligibleAt", "<", cutoff)
            .orderBy("id", "asc")
            .forUpdate()
            .execute();

          if (entries.length === 0) {
            return { linked: 0, blocked: false };
          }

          const rider = await transaction
            .selectFrom("riders")
            .select(["payoutUpiId", "payoutAccountNumber", "payoutIfsc"])
            .where("id", "=", riderId)
            .forUpdate()
            .executeTakeFirstOrThrow();

          const hasPaymentDetails =
            Boolean(rider.payoutUpiId?.trim()) ||
            (Boolean(rider.payoutAccountNumber?.trim()) &&
              Boolean(rider.payoutIfsc?.trim()));

          const amount = entries.reduce((sum, entry) => sum + entry.amount, 0);
          if (!Number.isSafeInteger(amount)) {
            throw new Error(`Invalid rider payout total for rider ${riderId}`);
          }

          const periodStart = new Date(
            Math.min(...entries.map((entry) => entry.createdAt.getTime())),
          );
          const initialNote =
            amount <= 0
              ? NON_POSITIVE_NOTE
              : hasPaymentDetails
                ? null
                : MISSING_DETAILS_NOTE;

          const payout = await transaction
            .insertInto("riderPayouts")
            .values({
              riderId,
              payoutDate: cutoff,
              periodStart,
              periodEnd: cutoff,
              entryCount: entries.length,
              amount,
              status: initialNote === null ? "pending" : "on_hold",
              note: initialNote,
              transferMode: "manual",
            })
            .onConflict((conflict) =>
              conflict
                .columns(["riderId", "payoutDate"])
                .doUpdateSet(({ ref }) => {
                  const mergedAmount = sql<number>`${ref("riderPayouts.amount")} + ${ref("excluded.amount")}`;

                  return {
                    entryCount: sql<number>`${ref("riderPayouts.entryCount")} + ${ref("excluded.entryCount")}`,
                    amount: mergedAmount,
                    periodStart: sql<Date>`least(${ref("riderPayouts.periodStart")}, ${ref("excluded.periodStart")})`,
                    periodEnd: cutoff,
                    status: hasPaymentDetails
                      ? sql<PayoutStatus>`case when ${mergedAmount} <= 0 then 'on_hold' else 'pending' end`
                      : "on_hold",
                    note: hasPaymentDetails
                      ? sql<string | null>`case when ${mergedAmount} <= 0 then ${NON_POSITIVE_NOTE} else null end`
                      : sql<string>`case when ${mergedAmount} <= 0 then ${NON_POSITIVE_NOTE} else ${MISSING_DETAILS_NOTE} end`,
                  };
                })
                .where("riderPayouts.status", "in", ["pending", "on_hold"]),
            )
            .returning("id")
            .executeTakeFirst();

          if (!payout) {
            console.error(
              `Skipping rider ${riderId}: payout for ${cutoff.toISOString()} is no longer editable`,
            );
            return { linked: 0, blocked: true };
          }

          const linked = await transaction
            .updateTable("riderEarnings")
            .set({ payoutId: payout.id, status: "in_payout" })
            .where(
              "id",
              "in",
              entries.map((entry) => entry.id),
            )
            .where("payoutId", "is", null)
            .where("status", "=", "eligible")
            .returning("id")
            .execute();

          if (linked.length !== entries.length) {
            throw new Error(
              `Rider payout ${payout.id} could not link all eligible earnings`,
            );
          }

          return { linked: linked.length, blocked: false };
        });

        if (result.blocked) {
          failed++;
        } else if (result.linked > 0) {
          ridersProcessed++;
          entriesLinked += result.linked;
        }
      } catch (error) {
        failed++;
        console.error(`Rider payout creation failed for rider ${riderId}:`, error);
      }
    }

    console.log("platr™ rider payout summary:", {
      cutoff: cutoff.toISOString(),
      ridersProcessed,
      entriesLinked,
      failed,
    });

    return { ridersProcessed, entriesLinked, failed };
  } catch (error) {
    console.error("Could not prepare rider payouts:", error);
    throw error;
  }
}