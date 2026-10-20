// BACKEND ONLY.
import { sql } from "kysely";
import { db } from "./db";
import {
  WEBHOOK_EVENT_STALE_AFTER_MS,
  webhookEventClaimDecision,
} from "./webhookEventClaimDecision";

type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "already_done" | "in_progress" };

async function attemptClaim(
  eventId: string,
  eventType: string,
  now: Date,
): Promise<boolean> {
  const staleBefore = new Date(
    now.getTime() - WEBHOOK_EVENT_STALE_AFTER_MS,
  );

  // The conflict predicate and update execute in one database statement.
  // A concurrent invocation cannot read "failed" and then overwrite a
  // different invocation's fresh processing claim.
  const row = await db
    .insertInto("paymentWebhookEvents")
    .values({
      eventId,
      eventType,
      status: "processing",
      startedAt: now,
      completedAt: null,
      attempts: 1,
      lastError: null,
    })
    .onConflict((conflict) =>
      conflict
        .column("eventId")
        .doUpdateSet((expression) => ({
          status: "processing",
          startedAt: now,
          completedAt: null,
          attempts: sql<number>`${expression.ref("paymentWebhookEvents.attempts")} + 1`,
          lastError: null,
        }))
        .where((expression) =>
          expression.or([
            expression(expression.ref("paymentWebhookEvents.status"), "=", "failed"),
            expression.and([
              expression(expression.ref("paymentWebhookEvents.status"), "=", "processing"),
              expression.or([
                expression(expression.ref("paymentWebhookEvents.startedAt"), "is", null),
                expression(expression.ref("paymentWebhookEvents.startedAt"), "<", staleBefore),
              ]),
            ]),
          ]),
        ),
    )
    .returning("eventId")
    .executeTakeFirst();

  return row !== undefined;
}

export const webhookEventClaims = {
  async claim(eventId: string, eventType: string): Promise<ClaimResult> {
    try {
      // A failed attempt could finish between the conflict predicate and the
      // follow-up SELECT. Retry that race once with another atomic statement.
      for (let attempt = 0; attempt < 2; attempt++) {
        const now = new Date();
        if (await attemptClaim(eventId, eventType, now)) {
          return { claimed: true };
        }

        const existing = await db
          .selectFrom("paymentWebhookEvents")
          .select(["status", "startedAt"])
          .where("eventId", "=", eventId)
          .executeTakeFirst();

        const decision = webhookEventClaimDecision(existing ?? null, now);
        if (decision !== "claim") {
          return { claimed: false, reason: decision };
        }
      }

      throw new Error(`Webhook event ${eventId} changed during both claim attempts`);
    } catch (error) {
      console.error(`Could not claim webhook event ${eventId}:`, error);
      throw error;
    }
  },

  async markDone(eventId: string): Promise<void> {
    try {
      const updated = await db
        .updateTable("paymentWebhookEvents")
        .set({
          status: "done",
          completedAt: new Date(),
          lastError: null,
        })
        .where("eventId", "=", eventId)
        .where("status", "=", "processing")
        .returning("eventId")
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`Processing claim not found for webhook event ${eventId}`);
      }
    } catch (error) {
      console.error(`Could not complete webhook event ${eventId}:`, error);
      throw error;
    }
  },

  async markFailed(eventId: string, error: unknown): Promise<void> {
    try {
      const message = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 1000);

      const updated = await db
        .updateTable("paymentWebhookEvents")
        .set({ status: "failed", lastError: message })
        .where("eventId", "=", eventId)
        .where("status", "=", "processing")
        .returning("eventId")
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`Processing claim not found for failed webhook event ${eventId}`);
      }
    } catch (markError) {
      console.error(`Could not mark webhook event ${eventId} failed:`, markError);
      throw markError;
    }
  },
};