import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, IndianRupee, Percent, ReceiptText, Sparkles, Wallet } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { deliveredInPeriod, orderSettlementStatus, weeklyCommissionSavings, type EarningsPeriod } from "../helpers/merchantAnalytics";
import { getRestaurantPayoutStatusLabel } from "../helpers/restaurantPayoutStatus";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { MerchantPayoutAccount } from "./MerchantPayoutAccount";
import { MerchantDeliveryCompensation } from "./MerchantDeliveryCompensation";
import { MerchantRevenueChart } from "./MerchantRevenueChart";
import { MerchantCard, MerchantEmpty, MerchantStat } from "./MerchantUi";
import styles from "./MerchantFinance.module.css";

export const MerchantFinance = ({ data, className }: { data: OutputType; className?: string }) => {
  const [period, setPeriod] = useState<EarningsPeriod>("weekly");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [now] = useState(() => new Date());
  const delivered = data.orders.filter((order) => order.status === "delivered");
  const selected = deliveredInPeriod(data.orders, period, now);
  const history = [...delivered].sort((a, b) =>
    new Date(b.deliveredAt ?? b.createdAt).getTime() - new Date(a.deliveredAt ?? a.createdAt).getTime(),
  );
  const r = ziptoConfig.rupees;

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <header className={styles.header}><h1>Earnings</h1></header>

      <div className={styles.segments} aria-label="Earnings period">
        {(["today", "weekly", "monthly"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={period === value} className={`${styles.segment} ${period === value ? styles.segmentActive : ""}`} onClick={() => setPeriod(value)}>
            {value === "today" ? "Today" : value === "weekly" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>

      <section className={styles.balance}>
        <span>Total Balance</span>
        <strong>{r(data.nextPayout.pendingAmount + data.nextPayout.pendingDeductions)}</strong>
        <small>Next payout: Fri, {data.nextPayout.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {data.nextPayout.pendingOrders} orders</small>
        <Button className={styles.withdraw} onClick={() => setWithdrawOpen(true)}>Withdraw to Bank</Button>
      </section>
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Your Friday payout</DialogTitle></DialogHeader>
          <p>platr™ sends your balance automatically every Friday. Your next payout is scheduled for {data.nextPayout.date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. On-demand withdrawals are not available.</p>
          <p>Destination: {data.payoutDetails.accountNumberMasked ?? data.payoutDetails.upiId ?? "No payout account saved"}
            {data.payoutDetails.accountNumberMasked && data.payoutDetails.upiId ? ` · ${data.payoutDetails.upiId}` : ""}
          </p>
          <MerchantPayoutAccount details={data.payoutDetails} panMasked={data.restaurant?.panMasked ?? null} hasPan={data.restaurant?.hasPan ?? false} />
        </DialogContent>
      </Dialog>

      <MerchantRevenueChart orders={data.orders} period={period} now={now} />

      <section className={styles.settlement}>
        <div className={styles.settlementHeading}><h2>Settlement</h2><span>platr™&apos;s Ultra-Low Commission</span></div>
        <div className={styles.savings}>
          <Sparkles size={28} aria-hidden="true" />
          <div><strong>Savings This Week: <em>{r(weeklyCommissionSavings(data.orders, now))}</em></strong>
            <p>Estimated vs a 25% commission many big platforms charge.</p>
          </div>
        </div>
      </section>

      <div className={styles.stats}>
        <MerchantStat label="Orders" value={selected.length} icon={<ReceiptText size={18} />} />
        <MerchantStat label="Food sales" value={r(selected.reduce((sum, order) => sum + order.itemsTotal, 0))} icon={<IndianRupee size={18} />} />
        <MerchantStat label="Your payout" value={r(selected.reduce((sum, order) => sum + order.restaurantPayout, 0))} icon={<Wallet size={18} />} />
        <MerchantStat label="Commission" value={r(selected.reduce((sum, order) => sum + order.commissionAmount, 0))} icon={<Percent size={18} />} />
      </div>

      <MerchantCard>
        <h2 className={styles.h3}>Order History</h2>
        {history.length === 0 ? (
          <MerchantEmpty title="No delivered orders yet" text="Your delivered orders will appear here." />
        ) : (
          <>
            <div className={styles.history}>
              {(showAll ? history : history.slice(0, 10)).map((order) => {
                const status = orderSettlementStatus(order, data.payouts);
                return (
                  <div className={styles.historyRow} key={order.id}>
                    <div><strong>#ZIP-{order.id}</strong><small>Total price {r(order.total)}</small></div>
                    <div className={styles.historyRight}>
                      <span className={`${styles.historyStatus} ${status === "Settled" ? styles.settled : status === "Refunded" ? styles.refunded : styles.upcoming}`}>{status}</span>
                      <strong>{r(order.restaurantPayout)}</strong>
                      <small>{new Date(order.deliveredAt ?? order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small>
                    </div>
                  </div>
                );
              })}
            </div>
            {history.length > 10 && <Button variant="ghost" onClick={() => setShowAll((value) => !value)}>{showAll ? "Show less" : "Show all"}</Button>}
          </>
        )}
      </MerchantCard>

      <h2 className={styles.detailsHeading}>Payout details</h2>
      <MerchantPayoutAccount details={data.payoutDetails} panMasked={data.restaurant?.panMasked ?? null} hasPan={data.restaurant?.hasPan ?? false} />
      <Collapsible className={styles.breakdown}>
        <CollapsibleTrigger asChild><Button variant="secondary">Detailed breakdown</Button></CollapsibleTrigger>
        <CollapsibleContent>
          <div className={styles.breakdownContent}>
            <MerchantCard>
              <h3 className={styles.h3}>Payout history</h3>
              {data.payouts.length === 0 ? <MerchantEmpty title="No payouts yet" text="Your online order settlements will appear here." /> : (
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Payout date</th><th>Period</th><th>Orders</th><th>Food</th><th>Commission</th><th>Adjustments</th><th>Income-tax TDS (0.1% / 5% without PAN)</th><th>Amount after TDS</th><th>Status</th><th>UTR</th></tr></thead>
                  <tbody>{data.payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td>{payout.payoutDate.toLocaleDateString("en-IN")}</td>
                      <td>{payout.periodStart.toLocaleDateString("en-IN")} – {payout.periodEnd.toLocaleDateString("en-IN")}</td>
                      <td>{payout.orderCount}</td><td>{r(payout.foodTotal)}</td><td>{r(payout.commissionTotal)}</td>
                      <td>{r(payout.adjustmentTotal)}</td><td>−{r(payout.tdsAmount)}</td>
                      <td className={styles.payout}>{r(payout.amount)}</td>
                      <td>{getRestaurantPayoutStatusLabel(payout.status)}</td><td>{payout.utrReference ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </MerchantCard>
            <MerchantCard>
              <h3 className={styles.h3}>Food complaint deductions</h3>
              {data.adjustments.length === 0 ? <MerchantEmpty title="No deductions yet" text="Approved food complaints and their payout adjustments will appear here." /> : (
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Date</th><th>Order</th><th>Reason</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>{data.adjustments.map((adjustment) => (
                    <tr key={adjustment.id}>
                      <td>{adjustment.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td>{adjustment.orderId === null ? "—" : `#ZIP-${adjustment.orderId}`}</td>
                      <td className={styles.reason}>{adjustment.reason}</td><td>{r(adjustment.amount)}</td>
                      <td>{adjustment.payoutId === null ? "Will be adjusted in next Friday payout" : "Adjusted in payout"}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </MerchantCard>
            <MerchantDeliveryCompensation compensations={data.compensations} />
            <MerchantCard>
              <h3 className={styles.h3}>Delivered orders</h3>
              {delivered.length === 0 ? <MerchantEmpty icon={<CalendarDays size={28} />} title="No delivered orders yet" text="Each delivered order will show its payout breakdown here." /> : (
                <div className={styles.tableWrap}><table className={styles.table}>
                  <thead><tr><th>Order</th><th>Date</th><th>Food</th><th>Discount</th><th>Commission</th><th>GST on commission</th><th>Payment</th><th>Your payout</th></tr></thead>
                  <tbody>{delivered.map((order) => (
                    <tr key={order.id}>
                      <td>#ZIP-{order.id}</td>
                      <td>{new Date(order.deliveredAt ?? order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td>{r(order.itemsTotal)}</td><td>−{r(order.restaurantDiscount)}</td>
                      <td>−{r(order.commissionAmount)} <small>({order.commissionPercent}%)</small></td>
                      <td>−{r(order.commissionTax)}{order.restaurantWithholding > 0 && <small> · Legacy withholding −{r(order.restaurantWithholding)}</small>}</td>
                      <td>{order.paymentMethod === "cod" ? "Cash" : "Online"}</td>
                      <td className={styles.payout}>{r(order.restaurantPayout)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </MerchantCard>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <MerchantCard className={styles.policy}>
        <p>Order earnings are food subtotal minus restaurant discount, plan commission and commission GST. Approved food complaints deduct 50% of the food value from the next payout. Income-tax TDS of 0.1% is deducted on the weekly payout (5% without PAN). Delivery fees, rider pay and subscription charges are separate.</p>
        <p>Online-paid delivered orders are included in the weekly Friday payout (orders up to Thursday 11:59 PM). Payouts are held until valid bank or UPI details are provided. See the <Link to="/terms#merchant-payouts">payout policy</Link>. For questions, <Link to="/support">contact platr™ Support</Link>.</p>
      </MerchantCard>
    </div>
  );
};