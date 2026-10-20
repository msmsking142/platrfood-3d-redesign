import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { History, IndianRupee, Wallet } from "lucide-react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { riderOrderDate } from "../helpers/riderOrderUtils";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./Chart";
import { MerchantCard, MerchantEmpty, MerchantSectionHeader, MerchantStat } from "./MerchantUi";
import { RiderEarningsLedger } from "./RiderEarningsLedger";
import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import styles from "./RiderEarnings.module.css";

type HistoryFilter = "all" | "delivered" | "cancelled";

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00`),
  );

export const RiderEarnings = ({
  data,
  mode,
  className,
}: {
  data: OutputType;
  mode: "history" | "earnings";
  className?: string;
}) => {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const visible = data.mine.filter((order) =>
    filter === "all"
      ? true
      : filter === "delivered"
        ? order.status === "delivered"
        : ["cancelled", "rejected"].includes(order.status),
  );
  const daily = [...data.stats.daily].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = daily.slice(-14).map((day) => ({
    ...day,
    label: dayLabel(day.date),
  }));

  if (mode === "history") {
    return (
      <div className={`${styles.wrap} ${className ?? ""}`}>
        <MerchantSectionHeader
          eyebrow="Delivery log"
          title="My deliveries"
          subtitle="Your accepted, completed and cancelled orders in one place."
        />
        <div className={styles.filters} aria-label="Filter delivery history">
          {(["all", "delivered", "cancelled"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.chip} ${filter === option ? styles.chipActive : ""}`}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : option === "delivered" ? "Delivered" : "Cancelled"}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <MerchantEmpty
            icon={<History size={32} />}
            title="No deliveries here yet"
            text={filter === "all" ? "Orders you accept will appear here." : "No orders match this filter."}
          />
        ) : (
          <div className={styles.historyList}>
            {visible.map((order) => (
              <MerchantCard key={order.id} className={styles.historyItem}>
                <div>
                  <span className={styles.date}>{riderOrderDate(order.createdAt)} · Order #{order.id}</span>
                  <h2>{order.restaurantName}</h2>
                  <p>{order.deliveryAddress}</p>
                </div>
                <div className={styles.historyEnd}>
                  <StatusPill status={order.status} />
                  <strong>{ziptoConfig.rupees(order.riderPayout)}</strong>
                </div>
              </MerchantCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader
        eyebrow="Payouts"
        title="Earnings"
        subtitle={`platr™ pays you per delivery: ${ziptoConfig.rupees(data.payRules.basePay)} base (first ${data.payRules.baseKm} km) + ${ziptoConfig.rupees(data.payRules.perKm)}/km after that + ${ziptoConfig.rupees(data.payRules.incentive)} incentive.`}
      />
      {!data.payoutDetails.hasDetails && (
        <MerchantCard>
          <p>Add your UPI ID or bank account in Profile to receive payouts.</p>
          <Button asChild><Link to="/rider?section=profile">Add payout details</Link></Button>
        </MerchantCard>
      )}
      <RiderEarningsLedger earnings={data.earnings} payouts={data.payouts} holdHours={data.payRules.holdHours} />
      <div className={styles.stats}>
        <MerchantStat label="Today" value={ziptoConfig.rupees(data.stats.todayEarnings)} tone="green" icon={<IndianRupee size={18} />} />
        <MerchantStat label="This week" value={ziptoConfig.rupees(data.stats.weekEarnings)} icon={<Wallet size={18} />} />
        <MerchantStat label="This month" value={ziptoConfig.rupees(data.stats.monthEarnings)} />
        <MerchantStat label="Lifetime" value={ziptoConfig.rupees(data.stats.totalEarnings)} tone="green" />
        <MerchantStat label="Bonus earned" value={ziptoConfig.rupees(data.stats.bonusEarned)} tone="gold" />
        <MerchantStat label="Total deliveries" value={data.stats.totalDeliveries.toLocaleString("en-IN")} />
      </div>

      <MerchantCard className={styles.codCard}>
        <div>
          <span>COD to deposit today</span>
          <strong>{ziptoConfig.rupees(data.stats.cashToDeposit)}</strong>
        </div>
        <p>Cash collected for orders belongs to platr™ and must be deposited.</p>
      </MerchantCard>

      <MerchantCard>
        <h2 className={styles.heading}>Last 14 days</h2>
        {chartData.length ? (
          <ChartContainer
            config={{ earnings: { label: "Earnings", color: "var(--success)" } }}
            className={styles.chart}
          >
            <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => ziptoConfig.rupees(Number(value))} />} />
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={42} tickFormatter={(value: number) => ziptoConfig.rupees(value)} />
              <Bar dataKey="earnings" fill="var(--color-earnings)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className={styles.emptyChart}>Your daily earnings chart will appear after your first delivery.</p>
        )}
      </MerchantCard>

      <MerchantCard>
        <h2 className={styles.heading}>Daily ledger</h2>
        {daily.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Deliveries</th><th scope="col">Earnings</th><th scope="col">COD collected</th></tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{dayLabel(day.date)}</th>
                    <td>{day.deliveries.toLocaleString("en-IN")}</td>
                    <td>{ziptoConfig.rupees(day.earnings)}</td>
                    <td>{ziptoConfig.rupees(day.cod)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyChart}>No daily entries yet.</p>
        )}
      </MerchantCard>

      <MerchantCard tone="gold">
        <h2 className={styles.heading}>How payouts work</h2>
        <p className={styles.explainer}>
          platr™ pays you per delivery: {ziptoConfig.rupees(data.payRules.basePay)} base (first {data.payRules.baseKm} km)
          {" + "}{ziptoConfig.rupees(data.payRules.perKm)}/km after that
          {" + "}{ziptoConfig.rupees(data.payRules.incentive)} incentive.
          Restaurant commission and payment gateway charges are never deducted from your pay.
          Earnings become eligible {data.payRules.holdHours}h after delivery and are paid weekly after platr™ reviews and approves the batch.
          If an order is cancelled after you pick it up, you get full pay; if cancelled after you accept but before pickup,
          you get {ziptoConfig.rupees(data.payRules.cancelAfterAcceptPay)}.
          COD cash collected belongs to platr™ and is settled separately.
        </p>
      </MerchantCard>
    </div>
  );
};