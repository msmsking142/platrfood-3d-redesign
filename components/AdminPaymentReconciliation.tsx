import { useState } from "react";
import { AdminHandledPayments } from "./AdminHandledPayments";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import type { ReconciliationRow } from "../endpoints/admin/payment_reconcile_GET.schema";
import { useAdminPaymentReconcile } from "../helpers/useAdminPaymentReconcile";
import styles from "./AdminPaymentReconciliation.module.css";

type Props = { className?: string };

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const verdicts: Record<
  ReconciliationRow["verdict"],
  { label: string; variant: "destructive" | "warning" | "outline" }
> = {
  captured_not_credited: {
    label: "Paid in Razorpay – not credited",
    variant: "destructive",
  },
  authorized_only: { label: "Authorized only", variant: "warning" },
  failed_only: { label: "No money received", variant: "outline" },
  no_payment_attempt: { label: "No money received", variant: "outline" },
  amount_mismatch: { label: "Amount mismatch", variant: "destructive" },
  lookup_error: { label: "Needs manual review", variant: "destructive" },
};

function PaymentTable({
  title,
  rows,
}: {
  title: string;
  rows: ReconciliationRow[];
}) {
  return (
    <section className={styles.group}>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing pending</p>
      ) : (
        <div
          className={styles.tableScroll}
          role="region"
          aria-label={`${title} reconciliation results`}
          tabIndex={0}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Amount</th>
                <th scope="col">Razorpay order ID</th>
                <th scope="col">Created (IST)</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const verdict = verdicts[row.verdict];

                return (
                  <tr key={`${row.kind}-${row.recordId}`}>
                    <th scope="row">#{row.recordId}</th>
                    <td className={styles.amount}>{money.format(row.amount)}</td>
                    <td className={styles.orderId}>{row.razorpayOrderId ?? "Missing"}</td>
                    <td>{dateTime.format(new Date(row.createdAt))}</td>
                    <td>
                      <div className={styles.result}>
                        <Badge variant={verdict.variant}>{verdict.label}</Badge>
                        {row.detail && <span className={styles.detail}>{row.detail}</span>}
                        {row.payments.length > 0 && (
                          <details className={styles.payments}>
                            <summary>
                              {row.paymentCount} payment{row.paymentCount === 1 ? "" : "s"}
                            </summary>
                            <ul>
                              {row.payments.map((payment) => (
                                <li key={payment.paymentId}>
                                  <span className={styles.paymentId}>{payment.paymentId}</span>
                                  {" · "}{payment.status}
                                  {" · "}{money.format(payment.amountPaise / 100)}
                                  {payment.method ? ` · ${payment.method}` : ""}
                                  {" · "}{dateTime.format(new Date(payment.createdAt))}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export const AdminPaymentReconciliation = ({ className }: Props) => {
  const query = useAdminPaymentReconcile();
  const [hasChecked, setHasChecked] = useState(false);

  const check = () => {
    setHasChecked(true);
    void query.refetch();
  };

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-busy={query.isFetching}>
      <div className={styles.header}>
        <div>
          <h3>Payment reconciliation (read-only)</h3>
          <p>This check only reads Razorpay. Automatic refunds of late and duplicate payments are listed below.</p>
        </div>
        <Button onClick={check} disabled={query.isFetching}>
          {query.isFetching ? "Checking…" : "Check with Razorpay"}
        </Button>
      </div>

      {query.isFetching ? (
        <div className={styles.loading} role="status" aria-label="Checking payments">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : query.isError ? (
        <p className={styles.error} role="alert">
          Could not check payments: {query.error instanceof Error ? query.error.message : "Unknown error"}
        </p>
      ) : query.data && hasChecked ? (
        <div className={styles.results}>
          <p className={styles.checkedAt}>
            Checked {dateTime.format(new Date(query.data.checkedAt))} IST
          </p>
          <PaymentTable title="Wallet top-ups" rows={query.data.walletTopups} />
          <PaymentTable title="Pro payments" rows={query.data.proPayments} />
          <PaymentTable title="Food orders" rows={query.data.foodOrders} />
          <AdminHandledPayments payments={query.data.handledPayments} />
        </div>
      ) : (
        <p className={styles.prompt}>Run a check to review pending payments against Razorpay.</p>
      )}
    </section>
  );
};