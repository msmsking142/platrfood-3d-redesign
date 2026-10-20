import { getProTrialIneligibleReason, hasExplicitRenewalConsent, isProTrialActive, PRO_TRIAL_DAYS } from "./proTrialEligibility";

describe("30-day Pro trial policy", () => {
  const eligible = {
    enabled: true,
    launchMode: false,
    status: "approved" as const,
    trialAlreadyUsed: false,
    hasPaidProPayment: false,
  };

  it("always uses a fixed 30-day trial", () => {
    expect(PRO_TRIAL_DAYS).toBe(30);
  });

  it("allows a newly approved merchant who has never used Pro", () => {
    expect(getProTrialIneligibleReason(eligible)).toBeNull();
  });

  it("keeps the trial offer available during launch mode when enabled", () => {
    expect(getProTrialIneligibleReason({ ...eligible, enabled: false })).toBe("Offer currently unavailable");
    expect(getProTrialIneligibleReason({ ...eligible, launchMode: true })).toBeNull();
  });

  it("requires an approved restaurant profile", () => {
    expect(getProTrialIneligibleReason({ ...eligible, status: "pending" })).toBe("Offer available after your restaurant is approved");
  });

  it("prevents a second trial or a trial after paid Pro history", () => {
    expect(getProTrialIneligibleReason({ ...eligible, trialAlreadyUsed: true })).toBe("Free trial already used");
    expect(getProTrialIneligibleReason({ ...eligible, hasPaidProPayment: true })).toBe("Offer is for restaurants that haven't had Pro before");
  });

  it("requires explicit consent before continuing Pro after the trial", () => {
    expect(hasExplicitRenewalConsent(false)).toBeFalse();
    expect(hasExplicitRenewalConsent(true)).toBeTrue();
  });

  it("expires the trial at the exact end time and never revives a cancelled trial", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(isProTrialActive(new Date("2026-10-20T12:00:01.000Z"), null, now)).toBeTrue();
    expect(isProTrialActive(now, null, now)).toBeFalse();
    expect(isProTrialActive(new Date("2026-10-19T12:00:00.000Z"), null, now)).toBeFalse();
    expect(isProTrialActive(new Date("2026-10-21T12:00:00.000Z"), now, now)).toBeFalse();
  });
});
