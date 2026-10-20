import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { riderOrderDate } from "../helpers/riderOrderUtils";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { MerchantCard, MerchantStat } from "./MerchantUi";
import styles from "./RiderEarningsLedger.module.css";

export const RiderEarningsLedger = ({
  earnings,
  payouts,
  holdHours,
  className,
}: {
  earnings: OutputType["earnings"];
  payouts: OutputType["payouts"];
  holdHours: OutputType["payRules"]["holdHours"];
  className?: string;
}) => (
  <div className={`${styles.wrap} ${className ?? ""}`}>
    <h2 className={styles.heading}>Earnings ledger</h2>
    <div className={styles.stats}>
      <MerchantStat label="Pending" value={ziptoConfig.rupees(earnings.pending)} hint={`In ${holdHours}h hold`} />
      <MerchantStat label="Eligible for next payout" value={ziptoConfig.rupees(earnings.eligible)} tone="green" />
      <MerchantStat label="In payout batch" value={ziptoConfig.rupees(earnings.inPayout)} />
      <MerchantStat label="Paid out" value={ziptoConfig.rupees(earnings.paid)} tone="green" />
      <MerchantStat label="Adjustments" value={ziptoConfig.rupees(earnings.adjustments)} />
    </div>

    <MerchantCard>
      <h2 className={styles.heading}>Ledger entries</h2>
      {earnings.entries.length === 0 ? (
        <p className={styles.empty}>No earnings entries yet.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date</th><th scope="col">Order #</th><th scope="col">Type</th>
                <th scope="col">Base</th><th scope="col">Distance</th><th scope="col">Incentive</th>
                <th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {earnings.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{riderOrderDate(entry.createdAt)}</td>
                  <td>{entry.orderId ?? "—"}</td>
                  <td>{entry.entryType === "delivery" ? "Delivery" : entry.entryType === "cancellation" ? "Cancellation pay" : "Adjustment"}</td>
                  <td>{ziptoConfig.rupees(entry.basePay)}</td>
                  <td>{ziptoConfig.rupees(entry.distancePay)}</td>
                  <td>{ziptoConfig.rupees(entry.incentive)}</td>
                  <td className={entry.amount < 0 ? styles.negative : undefined}>{ziptoConfig.rupees(entry.amount)}</td>
                  <td>{entry.status === "in_payout" ? "In payout" : entry.status === "paid" ? "Paid" : entry.status === "eligible" ? "Eligible" : entry.status === "reversed" ? "Reversed" : "Pending"}</td>
                  <td className={styles.note}>{entry.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MerchantCard>

    <MerchantCard>
      <h2 className={styles.heading}>Payout history</h2>
      {payouts.length === 0 ? (
        <p className={styles.empty}>No payout batches yet.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Payout date</th><th scope="col">Period</th><th scope="col">Entries</th>
                <th scope="col">Amount</th><th scope="col">Status</th><th scope="col">UTR</th><th scope="col">Note / failure reason</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>{riderOrderDate(payout.payoutDate)}</td>
                  <td>{riderOrderDate(payout.periodStart)} – {riderOrderDate(payout.periodEnd)}</td>
                  <td>{payout.entryCount}</td>
                  <td>{ziptoConfig.rupees(payout.amount)}</td>
                  <td>
                    {payout.status === "pending" ? "Awaiting approval"
                      : payout.status === "approved" ? "Approved"
                      : payout.status === "processing" ? "Processing"
                      : payout.status === "paid" ? "Paid"
                      : payout.status === "failed" ? "Failed" : "On hold"}
                  </td>
                  <td>{payout.utrReference ?? "—"}</td>
                  <td className={styles.note}>{[payout.note, payout.failureReason].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MerchantCard>
  </div>
);