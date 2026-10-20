import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Dot, XAxis, YAxis } from "recharts";
import type { OrderView } from "../helpers/orderView";
import { revenueSeries, type EarningsPeriod } from "../helpers/merchantAnalytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./Chart";
import styles from "./MerchantRevenueChart.module.css";

export function MerchantRevenueChart({
  orders,
  period,
  now,
  className,
}: {
  orders: OrderView[];
  period: EarningsPeriod;
  now: Date;
  className?: string;
}) {
  const gradientId = `merchant-revenue-${useId().replace(/:/g, "")}`;
  const series = revenueSeries(orders, period, now);
  const maximum = Math.max(...series.map((point) => point.revenue));

  return (
    <section className={`${styles.card} ${className ?? ""}`}>
      <h3>
        {period === "today"
          ? "Today's Revenue"
          : period === "weekly"
            ? "Weekly Revenue"
            : "Monthly Revenue"}
      </h3>
      <ChartContainer className={styles.chart} config={{ revenue: { label: "Your payout", color: "var(--merchant-yellow)" } }}>
        <AreaChart data={series} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--merchant-yellow)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--merchant-yellow)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />} />
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--merchant-black)"
            strokeWidth={3}
            fill={`url(#${gradientId})`}
            dot={(props) =>
              maximum > 0 && props.payload.revenue === maximum
                ? <Dot key={props.key} cx={props.cx} cy={props.cy} r={5} fill="var(--merchant-black)" />
                : <Dot key={props.key} cx={props.cx} cy={props.cy} r={0} fill="transparent" />
            }
            activeDot={{ r: 6, fill: "var(--merchant-black)" }}
          />
        </AreaChart>
      </ChartContainer>
      <p>Based on your recent orders</p>
    </section>
  );
}