import {
  WEBHOOK_EVENT_STALE_AFTER_MS,
  webhookEventClaimDecision,
} from "./webhookEventClaimDecision";

describe("webhookEventClaimDecision", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("claims missing and failed events", () => {
    expect(webhookEventClaimDecision(null, now)).toBe("claim");
    expect(
      webhookEventClaimDecision(
        { status: "failed", startedAt: now },
        now,
      ),
    ).toBe("claim");
  });

  it("does not claim completed events", () => {
    expect(
      webhookEventClaimDecision(
        { status: "done", startedAt: null },
        now,
      ),
    ).toBe("already_done");
  });

  it("claims processing events without a start time or past the stale boundary", () => {
    expect(
      webhookEventClaimDecision(
        { status: "processing", startedAt: null },
        now,
      ),
    ).toBe("claim");
    expect(
      webhookEventClaimDecision(
        {
          status: "processing",
          startedAt: new Date(
            now.getTime() - WEBHOOK_EVENT_STALE_AFTER_MS - 1,
          ),
        },
        now,
      ),
    ).toBe("claim");
  });

  it("keeps recent and exactly-boundary processing events in progress", () => {
    for (const elapsed of [0, WEBHOOK_EVENT_STALE_AFTER_MS]) {
      expect(
        webhookEventClaimDecision(
          {
            status: "processing",
            startedAt: new Date(now.getTime() - elapsed),
          },
          now,
        ),
      ).toBe("in_progress");
    }
  });
});