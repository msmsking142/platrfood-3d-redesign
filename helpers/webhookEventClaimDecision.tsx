import type { Selectable } from "kysely";
import type { PaymentWebhookEvents } from "./schema";

export const WEBHOOK_EVENT_STALE_AFTER_MS = 16 * 60_000;

type ExistingClaim = Pick<
  Selectable<PaymentWebhookEvents>,
  "status" | "startedAt"
>;

export function webhookEventClaimDecision(
  existing: ExistingClaim | null,
  now: Date,
  staleAfterMs = WEBHOOK_EVENT_STALE_AFTER_MS,
): "claim" | "already_done" | "in_progress" {
  if (existing === null || existing.status === "failed") return "claim";
  if (existing.status === "done") return "already_done";

  if (
    existing.startedAt === null ||
    existing.startedAt.getTime() < now.getTime() - staleAfterMs
  ) {
    return "claim";
  }

  return "in_progress";
}