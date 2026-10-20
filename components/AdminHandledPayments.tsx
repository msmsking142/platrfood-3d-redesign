import type { OutputType } from "../endpoints/admin/payment_reconcile_GET.schema";
import { Badge } from "./Badge";
import tableStyles from "./AdminPaymentReconciliation.module.css";
import styles from "./AdminHandledPayments.module.css";

type HandledPayment = OutputType["handledPayments"][number];

type Props = {
  payments: HandledPayment[];
  className?: string;
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const actionLabels: Record<HandledPayment["action"], string> = {
  accepted_superseded: "Accepted old-order payment",
  refund_duplicate: "Duplicate refunded",
  refund_late: "Late payment refunded",
  manual_review: "Manual review",
};

const statusVariants: Record<
  HandledPayment["status"],
  "outline" | "warning" | "destructive"
> = {
  done: "outline",
  processing: "warning",
  failed: "destructive",
  manual_review: "destructive",
  refund_failed: "destructive",
};

export const AdminHandledPayments = ({ payments, className }: Props) => (
  <section className={`${tableStyles.group} ${className ?? ""}`}>
    <h4>Late, duplicate &amp; old-order payments</h4>
    {payments.length === 0 ? (
      <p className={tableStyles.empty}>No late or duplicate payments</p>
    ) : (
      <div
        className={tableStyles.tableScroll}
        role="region"
        aria-label="Late, duplicate and old-order payments"
        tabIndex={0}
      >
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">Kind / record</th>
              <th scope="col">Amount</th>
              <th scope="col">Razorpay payment ID</th>
              <th scope="col">Action</th>
              <th scope="col">Status</th>
              <th scope="col">Refund ID</th>
              <th scope="col">Reason / error</th>
              <th scope="col">Created (IST)</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <th scope="row">
                  {payment.kind}
                  {payment.recordId === null ? "" : ` #${payment.recordId}`}
                </th>
                <td className={tableStyles.amount}>
                  {money.format(payment.amountPaise / 100)}
                </td>
                <td className={tableStyles.paymentId}>{payment.razorpayPaymentId}</td>
                <td>{actionLabels[payment.action]}</td>
                <td>
                  <Badge variant={statusVariants[payment.status]}>
                    {payment.status.replaceAll("_", " ")}
                  </Badge>
                </td>
                <td className={tableStyles.paymentId}>
                  {payment.razorpayRefundId ?? "—"}
                </td>
                <td className={styles.reason}>
                  {payment.reason}
                  {payment.error && (
                    <span className={styles.error}>Error: {payment.error}</span>
                  )}
                </td>
                <td>{dateTime.format(new Date(payment.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);