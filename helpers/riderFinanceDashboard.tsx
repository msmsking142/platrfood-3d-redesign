import type { Selectable } from "kysely";
import { db } from "./db";
import { pricingSettings } from "./pricingSettings";
import type { Riders } from "./schema";

type FinanceRider = Pick<
  Selectable<Riders>,
  | "id"
  | "town"
  | "payoutAccountHolder"
  | "payoutAccountNumber"
  | "payoutIfsc"
  | "payoutUpiId"
>;

export async function riderFinanceDashboard(rider: FinanceRider | null) {
  const earnings = {
    pending: 0,
    eligible: 0,
    inPayout: 0,
    paid: 0,
    adjustments: 0,
    entries: [] as Awaited<ReturnType<typeof loadEntries>>,
  };
  const payoutDetails = {
    accountHolder: rider?.payoutAccountHolder ?? null,
    accountNumberLast4: rider?.payoutAccountNumber?.slice(-4) ?? null,
    ifsc: rider?.payoutIfsc ?? null,
    upiId: rider?.payoutUpiId ?? null,
    hasDetails: Boolean(
      rider?.payoutUpiId ||
      (rider?.payoutAccountNumber && rider?.payoutIfsc),
    ),
  };

  if (!rider) {
    return {
      earnings,
      payouts: [] as Awaited<ReturnType<typeof loadPayouts>>,
      payoutDetails,
      payRules: {
        basePay: 0,
        baseKm: 0,
        perKm: 0,
        incentive: 0,
        cancelAfterAcceptPay: 0,
        holdHours: 0,
      },
    };
  }

  const [totals, entries, payouts, pricing] = await Promise.all([
    db.selectFrom("riderEarnings")
      .select(["status", "entryType"])
      .select((expression) => expression.fn.sum<number>("amount").as("total"))
      .where("riderId", "=", rider.id)
      .groupBy(["status", "entryType"])
      .execute(),
    loadEntries(rider.id),
    loadPayouts(rider.id),
    pricingSettings.load(rider.town),
  ]);

  for (const total of totals) {
    const amount = Number(total.total ?? 0);
    if (!Number.isSafeInteger(amount)) {
      throw new Error(`Invalid earning total for rider ${rider.id}`);
    }
    if (total.status === "pending") earnings.pending += amount;
    if (total.status === "eligible") earnings.eligible += amount;
    if (total.status === "in_payout") earnings.inPayout += amount;
    if (total.status === "paid") earnings.paid += amount;
    if (total.entryType === "adjustment" && total.status !== "reversed") {
      earnings.adjustments += amount;
    }
  }
  earnings.entries = entries;

  return {
    earnings,
    payouts,
    payoutDetails,
    payRules: {
      basePay: pricing.settings.riderBasePay,
      baseKm: pricing.settings.riderBaseM / 1000,
      perKm: pricing.settings.riderPerKm,
      incentive: pricing.settings.riderBonus,
      cancelAfterAcceptPay: pricing.settings.riderCancelAfterAcceptPay,
      holdHours: pricing.row.riderEarningHoldHours,
    },
  };
}

function loadEntries(riderId: number) {
  return db.selectFrom("riderEarnings")
    .select([
      "id", "orderId", "entryType", "basePay", "distancePay",
      "incentive", "amount", "status", "eligibleAt", "note", "createdAt",
    ])
    .where("riderId", "=", riderId)
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(50)
    .execute();
}

function loadPayouts(riderId: number) {
  return db.selectFrom("riderPayouts")
    .select([
      "id", "payoutDate", "periodStart", "periodEnd", "entryCount",
      "amount", "status", "utrReference", "note", "paidAt", "failureReason",
    ])
    .where("riderId", "=", riderId)
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc")
    .limit(20)
    .execute();
}