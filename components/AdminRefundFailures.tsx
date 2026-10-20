import { toast } from "sonner";
import type { OutputType } from "../endpoints/admin/finance_GET.schema";
import { useAdminRefundRetry } from "../helpers/useAdminRefundRetry";
import { Button } from "./Button";
import styles from "./AdminRefundFailures.module.css";

type Props = {
  failures: OutputType["refundFailures"];
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

export const AdminRefundFailures = ({ failures, className }: Props) => {
  const retry = useAdminRefundRetry();

  if (failures.orders.length === 0 && failures.payments.length === 0) {
    return null;
  }

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label="Refunds failed – action needed">
      <h3 className={styles.title}>Refunds failed – action needed</h3>
      <p className={styles.intro}>
        Review these refunds and contact affected customers as needed.
      </p>

      <div className={styles.list}>
        {failures.orders.map((order) => (
          <div className={styles.item} key={`order-${order.orderId}`}>
            <div className={styles.details}>
              <strong>Order #{order.orderId} · {money.format(order.total)}</strong>
              <span>Status: {order.status}</span>
              <span>Razorpay payment ID: {order.razorpayPaymentId ?? "—"}</span>
              <span>Failed Razorpay refund ID: {order.failedRazorpayRefundId ?? "—"}</span>
              <span>Reason: {order.refundFailureReason ?? "No reason recorded"}</span>
              <span>
                Failed (IST): {order.refundFailedAt
                  ? dateTime.format(new Date(order.refundFailedAt))
                  : "—"}
              </span>
            </div>
            <Button
              disabled={retry.isPending}
              onClick={() => retry.mutate(order.orderId, {
                onSuccess: () => toast.success(`Refund retried for order #${order.orderId}.`),
                onError: (error) => toast.error(error.message),
              })}
            >
              {retry.isPending && retry.variables === order.orderId
                ? "Retrying…"
                : "Retry refund"}
            </Button>
          </div>
        ))}

        {failures.payments.map((payment) => (
          <div className={styles.item} key={`payment-${payment.id}`}>
            <div className={styles.details}>
              <strong>
                {payment.kind}
                {payment.recordId === null ? "" : ` #${payment.recordId}`}
                {" · "}
                {money.format(payment.amountPaise / 100)}
              </strong>
              <span>Razorpay payment ID: {payment.razorpayPaymentId}</span>
              <span>Razorpay refund ID: {payment.razorpayRefundId ?? "—"}</span>
              <span>Reason: {payment.error ?? "No reason recorded"}</span>
              <span>
                Failed (IST): {payment.refundFailedAt
                  ? dateTime.format(new Date(payment.refundFailedAt))
                  : "—"}
              </span>
              <strong className={styles.instruction}>
                Refund this payment from the Razorpay dashboard, then contact the customer.
              </strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};