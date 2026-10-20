import { sql } from "kysely";
import { db } from "./db";
import { createRiderPayouts } from "./createRiderPayouts";
import { deliveryPricing } from "./deliveryPricing";
import { pricingSettings } from "./pricingSettings";
import { financialLedger } from "./financialLedger";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function latestFridayMidnightIst(now: Date): Date {
  const istClock = new Date(now.getTime() + IST_OFFSET_MS);
  const daysSinceFriday = (istClock.getUTCDay() - 5 + 7) % 7;
  istClock.setUTCHours(0, 0, 0, 0);
  istClock.setUTCDate(istClock.getUTCDate() - daysSinceFriday);
  return new Date(istClock.getTime() - IST_OFFSET_MS);
}

export async function createWeeklyPayouts(): Promise<void> {
  const cutoff = latestFridayMidnightIst(new Date());
  let processedRestaurants = 0;
  let linkedOrders = 0;
  let skippedPaidPayouts = 0;
  let failedRestaurants = 0;
  let appliedAdjustments = 0;
  let carriedForwardAdjustments = 0;

  try {
    const restaurants = await db
      .selectFrom("orders")
      .select("restaurantId")
      .distinct()
      .where("status", "=", "delivered")
      .where("paymentMethod", "in", ["upi", "wallet"])
      .where("paymentStatus", "=", "paid")
      .where("payoutId", "is", null)
      .where("deliveredAt", "<", cutoff)
      .union(
        db
          .selectFrom("restaurantAdjustments")
          .select("restaurantId")
          .where("payoutId", "is", null)
          .where("amount", ">", 0)
          .where("createdAt", "<", cutoff),
      )
      .execute();

    for (const { restaurantId } of restaurants) {
      try {
        const result = await db.transaction().execute(async (transaction) => {
          const orders = await transaction
            .selectFrom("orders")
            .select([
              "id",
              "deliveredAt",
              "itemsTotal",
              "commissionAmount",
              "restaurantPayout",
            ])
            .where("restaurantId", "=", restaurantId)
            .where("status", "=", "delivered")
            .where("paymentMethod", "in", ["upi", "wallet"])
            .where("paymentStatus", "=", "paid")
            .where("payoutId", "is", null)
            .where("deliveredAt", "<", cutoff)
            .orderBy("id", "asc")
            .forUpdate()
            .execute();

          const adjustments = await transaction
            .selectFrom("restaurantAdjustments")
            .select(["id", "amount", "createdAt"])
            .where("restaurantId", "=", restaurantId)
            .where("payoutId", "is", null)
            .where("createdAt", "<", cutoff)
            .orderBy("id", "asc")
            .forUpdate()
            .execute();
          const compensationDates = adjustments
            .filter((adjustment) => adjustment.amount > 0)
            .map((adjustment) => adjustment.createdAt.getTime());

          if (orders.length === 0 && compensationDates.length === 0) {
            return { count: 0, skippedPaid: false, applied: 0, carriedForward: 0 };
          }

          const restaurant = await transaction
            .selectFrom("restaurants")
            .select([
              "payoutAccountNumber",
              "payoutIfsc",
              "payoutUpiId",
              "pan",
            ])
            .where("id", "=", restaurantId)
            .executeTakeFirstOrThrow();

          const hasBank =
            Boolean(restaurant.payoutAccountNumber?.trim()) &&
            Boolean(restaurant.payoutIfsc?.trim());
          const hasUpi = Boolean(restaurant.payoutUpiId?.trim());
          const needsDetails = !hasBank && !hasUpi;
          const hasValidPan = deliveryPricing.isValidPan(restaurant.pan);
          const payoutNote = [
            needsDetails ? "Add bank / UPI details in Finance" : null,
            !hasValidPan ? "Add PAN in Finance to reduce TDS to 0.1%" : null,
          ].filter((note) => note !== null).join("; ") || null;

          const deliveredDates = orders.map((order) => {
            if (order.deliveredAt === null) {
              throw new Error(
                `Delivered order ${order.id} has no delivery timestamp`,
              );
            }
            return order.deliveredAt;
          });
          const periodStart = new Date(
            orders.length > 0
              ? Math.min(...deliveredDates.map((date) => date.getTime()))
              : compensationDates.length > 0
                ? Math.min(...compensationDates)
                : cutoff.getTime(),
          );
          const totals = orders.reduce(
            (sum, order) => ({
              foodTotal: sum.foodTotal + order.itemsTotal,
              commissionTotal:
                sum.commissionTotal + order.commissionAmount,
              amount: sum.amount + order.restaurantPayout,
            }),
            { foodTotal: 0, commissionTotal: 0, amount: 0 },
          );

          const payout = await transaction
            .insertInto("restaurantPayouts")
            .values({
              restaurantId,
              payoutDate: cutoff,
              periodStart,
              periodEnd: cutoff,
              orderCount: orders.length,
              ...totals,
              status: needsDetails ? "on_hold" : "pending",
              note: payoutNote,
            })
            .onConflict((conflict) =>
              conflict
                .columns(["restaurantId", "payoutDate"])
                .doUpdateSet(({ ref }) => ({
                  orderCount: sql<number>`${ref("restaurantPayouts.orderCount")} + ${ref("excluded.orderCount")}`,
                  foodTotal: sql<number>`${ref("restaurantPayouts.foodTotal")} + ${ref("excluded.foodTotal")}`,
                  commissionTotal: sql<number>`${ref("restaurantPayouts.commissionTotal")} + ${ref("excluded.commissionTotal")}`,
                  amount: sql<number>`${ref("restaurantPayouts.amount")} + ${ref("excluded.amount")}`,
                  periodStart: sql<Date>`least(${ref("restaurantPayouts.periodStart")}, ${ref("excluded.periodStart")})`,
                  periodEnd: cutoff,
                  status: needsDetails ? "on_hold" : "pending",
                  note: payoutNote,
                }))
                .where("restaurantPayouts.status", "!=", "paid"),
            )
.returning(["id", "foodTotal", "tdsAmount", "amount", "orderCount", "adjustmentTotal"])
            .executeTakeFirst();

          if (!payout) {
            console.error(
              `Skipping restaurant ${restaurantId}: payout for ${cutoff.toISOString()} is already paid`,
            );
            return { count: 0, skippedPaid: true, applied: 0, carriedForward: 0 };
          }

          const { settings } = await pricingSettings.load(null, transaction);
          const newTds = deliveryPricing.payoutTds({
            foodSales: payout.foodTotal,
            hasValidPan,
            settings,
          });
          const delta = newTds - payout.tdsAmount;
          if (delta !== 0) {
            await transaction
              .updateTable("restaurantPayouts")
              .set({ tdsAmount: newTds, amount: payout.amount - delta })
              .where("id", "=", payout.id)
              .execute();
            const recorded = await financialLedger.record(transaction, {
              key: `restaurant_payout:${payout.id}:tds:${newTds}:${payout.orderCount}`,
              entryType: "adjustment",
              amount: -delta,
              restaurantId,
              restaurantPayoutId: payout.id,
              note: `Income-tax TDS u/s 393(1) (earlier 194-O)${hasValidPan ? "" : " – 5% no-PAN rate"}`,
            });
            if (!recorded) {
              throw new Error(`TDS ledger entry already exists for payout ${payout.id}`);
            }
          }

          let availableAmount = payout.amount - delta;
          let appliedTotal = 0;
          let applied = 0;
          let carriedForward = 0;
          let carriedForwardAmount = 0;

          for (const adjustment of adjustments) {
            if (availableAmount + adjustment.amount < 0) {
              carriedForward++;
              carriedForwardAmount += -adjustment.amount;
              continue;
            }

            await transaction
              .updateTable("restaurantAdjustments")
              .set({ payoutId: payout.id })
              .where("id", "=", adjustment.id)
              .where("payoutId", "is", null)
              .executeTakeFirstOrThrow();
            availableAmount += adjustment.amount;
            appliedTotal += adjustment.amount;
            applied++;
          }

          const cumulativeAdjustments = payout.adjustmentTotal + appliedTotal;
          const payoutAdjustments = await transaction
            .selectFrom("restaurantAdjustments")
            .select("amount")
            .where("payoutId", "=", payout.id)
            .execute();
          const adjustmentTotals = payoutAdjustments.reduce(
            (totals, adjustment) => ({
              deductions: totals.deductions + Math.min(adjustment.amount, 0),
              compensation: totals.compensation + Math.max(adjustment.amount, 0),
            }),
            { deductions: 0, compensation: 0 },
          );
          const adjustmentNotes = [
            adjustmentTotals.deductions < 0
              ? `Food complaint deductions: −₹${-adjustmentTotals.deductions}`
              : null,
            adjustmentTotals.compensation > 0
              ? `Delivery failure compensation: +₹${adjustmentTotals.compensation}`
              : null,
            carriedForward > 0
              ? `₹${carriedForwardAmount} carried forward`
              : null,
          ].filter((note) => note !== null);
          await transaction
            .updateTable("restaurantPayouts")
            .set({
              amount: availableAmount,
              adjustmentTotal: cumulativeAdjustments,
              note: [payoutNote, ...adjustmentNotes].filter(Boolean).join("; ") || null,
            })
            .where("id", "=", payout.id)
            .executeTakeFirstOrThrow();

          if (orders.length === 0) {
            return { count: 0, skippedPaid: false, applied, carriedForward };
          }

          const linked = await transaction
            .updateTable("orders")
            .set({ payoutId: payout.id })
            .where(
              "id",
              "in",
              orders.map((order) => order.id),
            )
            .where("payoutId", "is", null)
            .returning("id")
            .execute();

          if (linked.length !== orders.length) {
            throw new Error(
              `Payout ${payout.id} could not link all eligible orders`,
            );
          }

          return { count: linked.length, skippedPaid: false, applied, carriedForward };
        });

        appliedAdjustments += result.applied;
        carriedForwardAdjustments += result.carriedForward;
        if (result.skippedPaid) {
          skippedPaidPayouts++;
        } else if (result.count > 0 || result.applied > 0) {
          processedRestaurants++;
          linkedOrders += result.count;
        }
      } catch (error) {
        failedRestaurants++;
        console.error(
          `Weekly payout failed for restaurant ${restaurantId}:`,
          error,
        );
      }
    }

    let riderPayouts: Awaited<ReturnType<typeof createRiderPayouts>> | null = null;
    try {
      riderPayouts = await createRiderPayouts(cutoff);
    } catch (error) {
      console.error("Weekly rider payouts failed:", error);
    }

    console.log("platr™ weekly payout summary:", {
      riderPayouts,
      cutoff: cutoff.toISOString(),
      processedRestaurants,
      linkedOrders,
      skippedPaidPayouts,
      failedRestaurants,
      appliedAdjustments,
      carriedForwardAdjustments,
    });
  } catch (error) {
    console.error("Could not load eligible weekly payout restaurants:", error);
    throw error;
  }
}