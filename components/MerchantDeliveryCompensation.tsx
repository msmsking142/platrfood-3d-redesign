import { useState, type FormEvent } from "react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { getRestaurantPayoutStatusLabel } from "../helpers/restaurantPayoutStatus";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { MerchantCard, MerchantEmpty } from "./MerchantUi";
import { Textarea } from "./Textarea";
import styles from "./MerchantDeliveryCompensation.module.css";

export function MerchantDeliveryCompensation({
  compensations,
  className,
}: {
  compensations: OutputType["compensations"];
  className?: string;
}) {
  const [disputeOrderId, setDisputeOrderId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const dispute = ziptoHooks.useAction(
    postRestaurantAction,
    [ziptoHooks.keys.restaurantDashboard],
    "Compensation dispute submitted",
  );

  const closeDialog = () => {
    if (dispute.isPending) return;
    setDisputeOrderId(null);
    setNote("");
  };

  const submitDispute = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disputeOrderId === null) return;
    const trimmedNote = note.trim();
    if (trimmedNote.length < 10 || trimmedNote.length > 500) return;

    dispute.mutate(
      { action: "dispute_compensation", orderId: disputeOrderId, note: trimmedNote },
      {
        onSuccess: () => {
          setDisputeOrderId(null);
          setNote("");
        },
      },
    );
  };

  return (
    <MerchantCard className={className}>
      <h3 className={styles.heading}>Delivery failure compensation</h3>
      <p className={styles.explainer}>
        If platr™ can&apos;t find a delivery partner and your food was ready on time,
        platr™ pays you a pre-agreed compensation. It&apos;s added to your Friday
        payout — no commission is charged and it&apos;s never taken from the
        customer&apos;s refund.
      </p>

      {compensations.length === 0 ? (
        <MerchantEmpty
          title="No delivery failure compensation yet"
          text="Compensation decisions for orders without a delivery partner will appear here."
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order #</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Settlement</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {compensations.map((compensation) => (
                <tr key={compensation.id}>
                  <td data-label="Date">
                    {compensation.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td data-label="Order #">#ZIP-{compensation.orderId}</td>
                  <td data-label="Amount" className={styles.amount}>
                    +{ziptoConfig.rupees(compensation.amount)}
                  </td>
                  <td data-label="Status">
                    <Badge variant={
                      compensation.status === "approved" ? "success"
                        : compensation.status === "disputed" ? "warning"
                          : compensation.status === "rejected" ? "destructive" : "outline"
                    }>
                      {compensation.status === "approved" ? "Approved"
                        : compensation.status === "not_eligible" ? "Not eligible"
                          : compensation.status === "disputed" ? "Under review" : "Rejected"}
                    </Badge>
                  </td>
                  <td data-label="Reason" className={styles.reason}>
                    {compensation.reason}
                    {compensation.disputeNote && (
                      <p><strong>Your dispute:</strong> {compensation.disputeNote}</p>
                    )}
                    {compensation.adminNote && (
                      <p><strong>platr™&apos;s note:</strong> {compensation.adminNote}</p>
                    )}
                  </td>
                  <td data-label="Settlement">
                    {compensation.settlement.payoutId !== null
                      ? `In payout #${compensation.settlement.payoutId} (${compensation.settlement.payoutStatus
                          ? getRestaurantPayoutStatusLabel(compensation.settlement.payoutStatus)
                          : "status pending"})`
                      : compensation.status === "approved" ? "Next Friday payout" : "—"}
                  </td>
                  <td data-label="Action">
                    {(compensation.status === "not_eligible" || compensation.status === "rejected")
                      && compensation.disputedAt === null && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDisputeOrderId(compensation.orderId)}
                        >
                          Dispute
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={disputeOrderId !== null} onOpenChange={(open) => {
        if (!open) closeDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute compensation for order #{disputeOrderId}</DialogTitle>
          </DialogHeader>
          <form className={styles.form} onSubmit={submitDispute}>
            <label htmlFor="compensation-dispute-note">
              Explain why this order qualifies for compensation
            </label>
            <Textarea
              id="compensation-dispute-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              minLength={10}
              maxLength={500}
              required
              disabled={dispute.isPending}
            />
            <small>10–500 characters</small>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={closeDialog} disabled={dispute.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={dispute.isPending || note.trim().length < 10 || note.trim().length > 500}
              >
                {dispute.isPending ? "Submitting…" : "Submit dispute"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </MerchantCard>
  );
}