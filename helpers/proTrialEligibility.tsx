import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Restaurants } from "./schema";

type Database = Kysely<DB> | Transaction<DB>;

// The merchant-facing offer is explicitly a fixed 30-day trial. Keep this
// independent of the admin pricing/tax settings while CA confirmation is pending.
export const PRO_TRIAL_DAYS = 30;

export function isProTrialActive(endsAt: Date, cancelledAt: Date | null, now = new Date()): boolean {
  return cancelledAt === null && endsAt > now;
}

export function hasExplicitRenewalConsent(consented: boolean): boolean {
  return consented === true;
}

export function getProTrialIneligibleReason(input: {
  enabled: boolean;
  launchMode: boolean;
  status: "approved" | "pending" | "rejected" | "suspended" | null;
  trialAlreadyUsed: boolean;
  hasPaidProPayment: boolean;
}): string | null {
  if (!input.enabled) return "Offer currently unavailable";
  if (input.status === null) return "Complete your restaurant profile first";
  if (input.status !== "approved") return "Offer available after your restaurant is approved";
  if (input.trialAlreadyUsed) return "Free trial already used";
  if (input.hasPaidProPayment) return "Offer is for restaurants that haven't had Pro before";
  return null;
}

export async function getProTrialEligibility(
  database: Database,
  restaurantId: number,
  status: Selectable<Restaurants>["status"] | null,
) {
  const [settings, trial, paidPayment] = await Promise.all([
    database.selectFrom("appSettings")
      .select(["proTrialEnabled", "proTrialDays", "launchMode"])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow(),
    database.selectFrom("proTrials")
      .select(["startedAt", "endsAt", "cancelledAt"])
      .where("restaurantId", "=", restaurantId)
      .executeTakeFirst(),
    database.selectFrom("subscriptionPayments")
      .select("id")
      .where("restaurantId", "=", restaurantId)
      .where("status", "=", "paid")
      .executeTakeFirst(),
  ]);

  const ineligibleReason = getProTrialIneligibleReason({
    enabled: settings.proTrialEnabled,
    launchMode: settings.launchMode,
    status,
    trialAlreadyUsed: trial !== undefined,
    hasPaidProPayment: paidPayment !== undefined,
  });

  return {
    eligible: ineligibleReason === null,
    ineligibleReason,
    days: PRO_TRIAL_DAYS,
    trial: trial
      ? {
          ...trial,
          active: isProTrialActive(trial.endsAt, trial.cancelledAt),
        }
      : null,
  };
}