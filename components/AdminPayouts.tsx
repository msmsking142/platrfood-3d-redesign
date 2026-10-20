import type { InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import type { OutputType as AdminOverview } from "../endpoints/admin/overview_GET.schema";
import type { OutputType as PayoutProviders } from "../endpoints/admin/payout_providers_GET.schema";
import type { PayoutStatus } from "../helpers/schema";
import { Button } from "./Button";
import styles from "./AdminPayouts.module.css";

type AdminPayoutsProps = {
  payouts: AdminOverview["payouts"];
  riderPayouts: AdminFinance["riderPayouts"];
  providers: PayoutProviders;
  unsettledOnline: AdminOverview["unsettledOnline"];
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  formatMoney: (amount: number) => string;
  className?: string;
};

const statusLabels: Record<PayoutStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  on_hold: "On hold",
};

export const AdminPayouts = ({
  payouts, riderPayouts, providers, unsettledOnline, onAction, isPending, formatMoney, className,
}: AdminPayoutsProps) => {
  const actions = (kind: "restaurant" | "rider", payoutId: number, status: PayoutStatus) => {
    const transition = (to: PayoutStatus, reason?: string, utrReference?: string) =>
      onAction({ action: "payout_transition", kind, payoutId, to, reason, utrReference });

    const hold = () => {
      const reason = prompt("Reason for holding this payout", "");
      if (reason === null) return;
      if (reason.trim().length > 200) return alert("Reason must be 200 characters or fewer.");
      transition("on_hold", reason.trim());
    };
    const fail = () => {
      const reason = prompt("Reason the transfer failed");
      if (reason === null) return;
      if (!reason.trim() || reason.trim().length > 200) return alert("Enter a reason of 200 characters or fewer.");
      transition("failed", reason.trim());
    };
    const pay = () => {
      if (!confirm("Only record after your bank/UPI app confirms the transfer succeeded")) return;
      const reference = prompt("Enter the successful bank/UPI transfer UTR");
      if (reference === null) return;
      const utrReference = reference.trim();
      if (utrReference.length < 4 || utrReference.length > 60) return alert("Enter a UTR between 4 and 60 characters.");
      transition("paid", undefined, utrReference);
    };
    return (
      <div className={styles.actions}>
        {status === "pending" && <>
          <Button size="sm" disabled={isPending} onClick={() => transition("approved")}>Approve</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={hold}>Hold</Button>
        </>}
        {status === "approved" && <>
          <Button size="sm" disabled={isPending} onClick={() => transition("processing")}>Mark processing</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={pay}>Record manual payment</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={fail}>Mark failed</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={hold}>Hold</Button>
        </>}
        {status === "processing" && <>
          <Button size="sm" disabled={isPending} onClick={pay}>Record manual payment</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={fail}>Mark failed</Button>
        </>}
        {status === "failed" && <>
          <Button size="sm" disabled={isPending} onClick={() => transition("approved")}>Retry</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={hold}>Hold</Button>
        </>}
        {status === "on_hold" &&
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => transition("pending")}>Release</Button>}
      </div>
    );
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <h2>Payouts</h2>
      <div className={styles.providers}>
        <h3>Payout providers</h3>
        <p><strong>Razorpay Route: {providers.razorpayRoute.status.replaceAll("_", " ")}</strong> · {providers.razorpayRoute.detail}</p>
        <p><strong>Rider payouts: {providers.riderPayouts.status.replaceAll("_", " ")}</strong> · {providers.riderPayouts.detail}</p>
        <strong className={styles.badge}>Automated transfers: NOT CONFIGURED – record manual transfers only</strong>
      </div>
      <p>Unsettled online orders: {unsettledOnline.orderCount} · {formatMoney(unsettledOnline.amount)}</p>
      <Button disabled={isPending} onClick={() => onAction({ action: "run_payouts" })}>
        {isPending ? "Generating…" : "Generate this week's payouts now"}
      </Button>

      <h3>Restaurant payouts</h3>
      {!payouts.length ? <p>No restaurant payouts generated yet.</p> : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Restaurant</th><th scope="col">Date / period</th><th scope="col">Orders</th>
              <th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Transfer details</th>
              <th scope="col">UTR</th><th scope="col">Actions</th>
            </tr></thead>
            <tbody>{payouts.map((payout) => <tr key={payout.id}>
              <th scope="row">{payout.restaurantName}</th>
              <td>{new Date(payout.payoutDate).toLocaleDateString("en-IN")}<br />
                {new Date(payout.periodStart).toLocaleDateString("en-IN")} – {new Date(payout.periodEnd).toLocaleDateString("en-IN")}
              </td>
              <td>{payout.orderCount}</td>
              <td>{formatMoney(payout.amount)}</td>
              <td>{statusLabels[payout.status]}</td>
              <td>
                Holder: {payout.payoutAccountHolder || "Not provided"}<br />
                Account: {payout.payoutAccountNumber || "Not provided"}<br />
                IFSC: {payout.payoutIfsc || "Not provided"}<br />
                UPI: {payout.payoutUpiId || "Not provided"}
              </td>
              <td>{payout.utrReference || "—"}</td>
              <td>{actions("restaurant", payout.id, payout.status)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      <h3>Rider payouts</h3>
      {!riderPayouts.length ? <p>No rider payouts generated yet.</p> : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Rider</th><th scope="col">Date / period</th><th scope="col">Entries</th>
              <th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Transfer details</th>
              <th scope="col">UTR / failure</th><th scope="col">Actions</th>
            </tr></thead>
            <tbody>{riderPayouts.map((payout) => <tr key={payout.id}>
              <th scope="row">{payout.riderName}<br />{payout.phone}</th>
              <td>{new Date(payout.payoutDate).toLocaleDateString("en-IN")}<br />
                {new Date(payout.periodStart).toLocaleDateString("en-IN")} – {new Date(payout.periodEnd).toLocaleDateString("en-IN")}
              </td>
              <td>{payout.entryCount}</td>
              <td>{formatMoney(payout.amount)}</td>
              <td>{statusLabels[payout.status]}</td>
              <td>
                Holder: {payout.payoutAccountHolder || "Not provided"}<br />
                Account: {payout.payoutAccountNumberLast4 || "Not provided"}<br />
                IFSC: {payout.payoutIfsc || "Not provided"}<br />
                UPI: {payout.payoutUpiId || "Not provided"}
              </td>
              <td>{payout.utrReference || payout.failureReason || "—"}</td>
              <td>{actions("rider", payout.id, payout.status)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};