import { useState, type FormEvent } from "react";
import type {
  Failure, OutputType, ProtectionSettings,
} from "../endpoints/admin/delivery_reliability_GET.schema";
import type { SubmitProtectionAction } from "../helpers/useAdminDeliveryReliability";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./Dialog";
import styles from "./AdminDeliveryFailures.module.css";

type Filter = "disputed" | "not_eligible" | "approved" | "rejected" | "all";
type Decision = { kind: "approve" | "reject" | "revoke"; failure: Failure };

const money = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});
const when = (value: Date) => new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

const labels: Record<string, string> = {
  restaurant_accepted: "Restaurant accepted",
  preparing_started: "Preparing started",
  ready: "Marked READY",
  search_started: "Rider search started",
  search_expanded: "Search radius expanded",
  incentive_offered: "Rider incentive offered",
  delivery_at_risk: "Delivery at risk",
  priority_search_started: "Priority search started",
  deadline_set: "Search deadline set",
  rider_assigned: "Rider assigned",
  auto_cancelled: "Auto-cancelled: PLATFORM_DELIVERY_FAILURE",
  refund_initiated: "Refund initiated",
  refund_succeeded: "Refund succeeded",
  refund_failed: "Refund failed",
  compensation_created: "Compensation assessed",
  compensation_approve: "Compensation approved",
  compensation_reject: "Compensation rejected",
  compensation_revoke: "Compensation revoked",
};

function detailSummary(detail: Failure["timeline"][number]["detail"]): string | null {
  if (detail === null) return null;
  if (typeof detail !== "object" || Array.isArray(detail)) return String(detail);
  const parts = Object.entries(detail)
    .filter(([, value]) => value !== null && typeof value !== "object")
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`);
  return parts.length ? parts.join(" · ") : null;
}

function calculationSummary(calculation: NonNullable<Failure["compensation"]>["calculation"]) {
  if (calculation === null) return null;
  if (typeof calculation !== "object" || Array.isArray(calculation)) {
    return String(calculation);
  }
  return Object.entries(calculation)
    .filter(([, value]) => value !== null && typeof value !== "object")
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`)
    .join(" · ") || null;
}

function suggestedAmount(failure: Failure, settings: ProtectionSettings) {
  const compensation = failure.compensation;
  if (compensation && compensation.amount > 0) return compensation.amount;
  const calculation = compensation?.calculation;
  if (calculation && typeof calculation === "object" && !Array.isArray(calculation)) {
    const suggestion = calculation.suggestedAmount;
    if (typeof suggestion === "number" && Number.isInteger(suggestion) && suggestion > 0) {
      return Math.min(5000, suggestion);
    }
  }
  return Math.min(
    5000,
    settings.deliveryFailureCompMax,
    Math.max(
      settings.deliveryFailureCompMin,
      Math.round(failure.itemsTotal * settings.deliveryFailureCompBps / 10000),
    ),
  );
}

export function AdminDeliveryFailures({
  failures, counts, settings, submit, isSaving, className,
}: {
  failures: Failure[];
  counts: OutputType["counts"];
  settings: ProtectionSettings;
  submit: SubmitProtectionAction;
  isSaving: boolean;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>("disputed");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const visible = failures.filter((failure) =>
    filter === "all" || failure.compensation?.status === filter,
  );

  function open(kind: Decision["kind"], failure: Failure) {
    setDecision({ kind, failure });
    setAmount(String(suggestedAmount(failure, settings)));
    setNote("");
    setError(null);
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision?.failure.compensation) return;
    try {
      await submit({
        action: "compensation_decision",
        compensationId: decision.failure.compensation.id,
        decision: decision.kind,
        ...(decision.kind === "approve" ? { amount: Number(amount) } : {}),
        note,
      });
      setDecision(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save decision");
    }
  }

  async function retry(orderId: number) {
    try {
      setError(null);
      await submit({ action: "retry_refund", orderId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry refund");
    }
  }

  const filters: Array<{ key: Filter; text: string }> = [
    { key: "disputed", text: `Disputed (${counts.disputed})` },
    { key: "not_eligible", text: `Needs review (${counts.notEligible})` },
    { key: "approved", text: `Approved (${counts.approved})` },
    { key: "rejected", text: `Rejected (${counts.rejected})` },
    { key: "all", text: `All (${failures.length})` },
  ];

  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <div className={styles.heading}>
        <h3>Failures &amp; compensation review</h3>
        <p>Latest 100 no-rider cancellations. Refunds include the full order total; compensation is a separate restaurant payable.</p>
      </div>
      {error && !decision && <p className={styles.error} role="alert">{error}</p>}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList aria-label="Filter delivery failures">
          {filters.map(({ key, text }) => (
            <TabsTrigger key={key} value={key}>{text}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {visible.length ? (
        <div className={styles.list}>
          {visible.map((failure) => {
            const compensation = failure.compensation;
            return (
              <article className={styles.card} key={failure.id}>
                <div className={styles.cardTop}>
                  <div>
                    <h4>Order #{failure.id} · {failure.restaurantName}</h4>
                    <p>{failure.town} · {failure.noRiderCancelledAt
                      ? `${when(failure.noRiderCancelledAt)} IST`
                      : "Cancellation time unavailable"}</p>
                  </div>
                  <Badge variant={compensation?.status === "approved" ? "success"
                    : compensation?.status === "disputed" ? "warning" : "outline"}>
                    {compensation?.status.replace("_", " ") ?? "No assessment"}
                  </Badge>
                </div>
                <div className={styles.details}>
                  <div>
                    <span>Order total</span><strong>{money.format(failure.total)}</strong>
                  </div>
                  <div>
                    <span>Compensation</span><strong>{money.format(compensation?.amount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>Customer refund</span>
                    <strong>
                      {failure.paymentStatus === "refunded"
                        ? "Refunded"
                        : failure.refundFailedAt ? "Refund failed" : "Pending"}
                    </strong>
                  </div>
                  <div>
                    <span>Search incentive</span><strong>{money.format(failure.riderSearchIncentive)}</strong>
                  </div>
                </div>
                {failure.refundFailureReason && (
                  <p className={styles.error}>Refund issue: {failure.refundFailureReason}</p>
                )}
                {failure.paymentStatus === "paid" && failure.refundFailedAt && (
                  <Button size="sm" disabled={isSaving} onClick={() => void retry(failure.id)}>
                    {isSaving ? "Retrying…" : "Retry refund"}
                  </Button>
                )}
                {compensation && (
                  <div className={styles.explanation}>
                    <p><strong>Reason:</strong> {compensation.reason}</p>
                    {calculationSummary(compensation.calculation) && (
                      <p><strong>Calculation:</strong> {calculationSummary(compensation.calculation)}</p>
                    )}
                    {compensation.disputeNote && <p><strong>Dispute:</strong> {compensation.disputeNote}</p>}
                    {compensation.adminNote && <p><strong>Admin note:</strong> {compensation.adminNote}</p>}
                    {compensation.status === "approved" && (
                      <p><strong>Settlement:</strong> {compensation.adjustmentPayoutId !== null
                        ? `Included in payout #${compensation.adjustmentPayoutId}`
                        : "Next Friday payout"}</p>
                    )}
                  </div>
                )}
                <div className={styles.actions}>
                  {compensation && ["not_eligible", "disputed", "rejected"].includes(compensation.status) && (
                    <Button size="sm" disabled={isSaving} onClick={() => open("approve", failure)}>Approve</Button>
                  )}
                  {compensation && ["not_eligible", "disputed"].includes(compensation.status) && (
                    <Button size="sm" variant="secondary" disabled={isSaving} onClick={() => open("reject", failure)}>Reject</Button>
                  )}
                  {compensation?.status === "approved" && compensation.adjustmentId !== null
                    && compensation.adjustmentPayoutId === null && (
                    <Button size="sm" variant="destructive" disabled={isSaving} onClick={() => open("revoke", failure)}>Revoke</Button>
                  )}
                </div>
                <Collapsible>
                  <CollapsibleTrigger className={styles.timelineTrigger}>
                    View delivery timeline ({failure.timeline.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {failure.timeline.length ? (
                      <ol className={styles.timeline}>
                        {failure.timeline.map((event, index) => (
                          <li key={`${event.type}-${index}`}>
                            <time dateTime={new Date(event.at).toISOString()}>
                              {when(event.at)} IST
                            </time>
                            <strong>{labels[event.type] ?? event.type.replace(/_/g, " ")}</strong>
                            {detailSummary(event.detail) && <small>{detailSummary(event.detail)}</small>}
                          </li>
                        ))}
                      </ol>
                    ) : <p className={styles.empty}>No events recorded for this order.</p>}
                  </CollapsibleContent>
                </Collapsible>
              </article>
            );
          })}
        </div>
      ) : <p className={styles.empty}>No {filter === "all" ? "" : `${filter.replace("_", " ")} `}delivery failures in the latest 100.</p>}

      <Dialog open={decision !== null} onOpenChange={(open) => {
        if (!open && !isSaving) { setDecision(null); setError(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.kind === "approve" ? "Approve compensation"
              : decision?.kind === "revoke" ? "Revoke compensation" : "Reject compensation"}</DialogTitle>
            <DialogDescription>
              Order #{decision?.failure.id}. {decision?.kind === "revoke"
                ? "This removes the unpaid restaurant adjustment and records a ledger reversal."
                : decision?.kind === "approve"
                  ? "This creates a restaurant adjustment for its next payout."
                  : "Record why the compensation request was rejected."}
            </DialogDescription>
          </DialogHeader>
          <form className={styles.decisionForm} onSubmit={(event) => void submitDecision(event)}>
            {decision?.kind === "approve" && (
              <label>Amount (₹)
                <Input type="number" min={1} max={5000} step={1} required
                  value={amount} onChange={(event) => setAmount(event.target.value)}
                  disabled={isSaving} />
              </label>
            )}
            <label>Reason for decision
              <Textarea minLength={3} maxLength={500} required value={note}
                onChange={(event) => setNote(event.target.value)} disabled={isSaving} />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <Button variant="ghost" disabled={isSaving} onClick={() => setDecision(null)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}
                variant={decision?.kind === "revoke" ? "destructive" : "primary"}>
                {isSaving ? "Saving…" : `Confirm ${decision?.kind ?? "decision"}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}