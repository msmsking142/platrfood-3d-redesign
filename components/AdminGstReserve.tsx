import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import styles from "./AdminGstReserve.module.css";

type Props = { finance: AdminFinance; isFetching: boolean };

export const AdminGstReserve = ({ finance, isFetching }: Props) => {
  const gst = finance.gstReserve;
  const money = ziptoConfig.rupees;
  const cards = [
    { label: "GST on food orders", value: gst.foodGst, detail: "Food GST recorded on paid, delivered orders" },
    { label: "GST on delivery & customer fees", value: gst.deliveryPlatformGst, detail: "Delivery, platform, surge and small-order fees" },
    { label: "GST on merchant commission", value: gst.commissionGst, detail: "GST charged on platr™'s commission" },
    { label: "GST on Pro subscriptions", value: gst.proSubscriptionGst, detail: `${gst.paidProSubscriptions} successful subscription payments` },
    { label: "GST on rider onboarding", value: gst.riderOnboardingGst, detail: `${gst.paidRiderOnboardingFees} successful onboarding payments` },
  ];

  const onboardingByMonth = new Map(
    finance.riderOnboardingTaxSummary.map((row) => [row.month, row]),
  );
  const months = [...new Set([
    ...finance.taxSummary.map((row) => row.month),
    ...finance.riderOnboardingTaxSummary.map((row) => row.month),
  ])].sort((a, b) => a.localeCompare(b));
  const orderByMonth = new Map(finance.taxSummary.map((row) => [row.month, row]));

  return (
    <section className={styles.root} aria-busy={isFetching}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>SEPARATE FROM PLATR REVENUE</p>
          <h2>GST Reserve</h2>
          <p>Track GST collected or recorded across food orders, merchant charges, Pro subscriptions and rider onboarding.</p>
        </div>
        <div className={styles.total}>
          <small>All-time gross GST tracked</small>
          <strong>{money(gst.totalGst)}</strong>
          <span>Reserve this amount before treating cash as available operating money.</span>
        </div>
      </header>

      <div className={styles.notice} role="note">
        <strong>This is an accounting reserve, not a bank transfer.</strong>
        <span>Payments still settle to the configured payment account. Move the reserve to a dedicated bank account manually, then reconcile refunds, credit notes and eligible input-tax credits with your CA.</span>
      </div>

      <div className={styles.cards}>
        {cards.map((card) => (
          <article className={styles.card} key={card.label}>
            <span>{card.label}</span>
            <strong>{money(card.value)}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <div className={styles.explanation}>
        <h3>Keep these amounts separate</h3>
        <p><b>GST Reserve</b> is not profit. platr™'s underlying revenue is the fee or commission before GST; GST collected on top is tracked separately for tax reporting. Rider onboarding base fees and Pro subscription base fees are shown separately from their GST.</p>
        <p>Current recorded base fees: Pro subscriptions {money(gst.proSubscriptionBase)} · Rider onboarding {money(gst.riderOnboardingBase)}.</p>
      </div>

      <h3>Monthly GST breakdown · last 12 months</h3>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr>
            <th>Month</th><th>Food GST</th><th>Delivery & fees GST</th><th>Commission GST</th><th>Pro GST</th><th>Rider onboarding GST</th><th>Total tracked</th>
          </tr></thead>
          <tbody>
            {months.length === 0 ? <tr><td colSpan={7}>No GST activity recorded in the last 12 months.</td></tr> : months.map((month) => {
              const order = orderByMonth.get(month);
              const rider = onboardingByMonth.get(month);
              const food = order?.foodGst ?? 0;
              const delivery = order?.deliveryPlatformGst ?? 0;
              const commission = order?.commissionGst ?? 0;
              const pro = order?.proSubscriptionGst ?? 0;
              const riderGst = rider?.gstAmount ?? 0;
              return <tr key={month}>
                <th scope="row">{month}</th>
                <td>{money(food)}</td><td>{money(delivery)}</td><td>{money(commission)}</td><td>{money(pro)}</td><td>{money(riderGst)}</td>
                <td><b>{money(food + delivery + commission + pro + riderGst)}</b></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>Figures are gross recorded GST from paid and delivered food orders, successful Pro subscription payments, and successful rider onboarding payments. Refunds, credit notes, input-tax credits and actual GST payments must be reconciled separately before filing. Confirm the final tax treatment and rates with your CA.</p>
    </section>
  );
};