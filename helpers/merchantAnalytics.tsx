import type { OrderView } from "./orderView";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";

export type EarningsPeriod = "today" | "weekly" | "monthly";

export function deliveredInPeriod(
  orders: OrderView[],
  period: EarningsPeriod,
  now: Date,
): OrderView[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "weekly") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "monthly") {
    start.setDate(start.getDate() - 27);
  }

  return orders.filter((order) => {
    if (order.status !== "delivered") return false;
    const date = new Date(order.deliveredAt ?? order.createdAt);
    return date >= start && date <= now;
  });
}

export function revenueSeries(
  orders: OrderView[],
  period: EarningsPeriod,
  now: Date,
): { label: string; revenue: number }[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const count = period === "today" ? 12 : period === "weekly" ? 7 : 4;

  if (period === "weekly") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "monthly") {
    start.setDate(start.getDate() - 27);
  }

  const series = Array.from({ length: count }, (_, index) => ({
    label:
      period === "today"
        ? `${String(index * 2).padStart(2, "0")}:00`
        : period === "weekly"
          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]
          : `W${index + 1}`,
    revenue: 0,
  }));

  for (const order of orders) {
    if (order.status !== "delivered") continue;
    const date = new Date(order.deliveredAt ?? order.createdAt);
    if (date < start || date > now) continue;

    const index =
      period === "today"
        ? Math.floor(date.getHours() / 2)
        : period === "weekly"
          ? (date.getDay() + 6) % 7
          : Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));

    if (series[index]) series[index].revenue += order.restaurantPayout;
  }

  return series;
}

export function weeklyCommissionSavings(orders: OrderView[], now: Date): number {
  return Math.round(
    deliveredInPeriod(orders, "weekly", now).reduce(
      (sum, order) =>
        sum + Math.max(0, order.itemsTotal * (25 - order.commissionPercent) / 100),
      0,
    ),
  );
}

export function orderSettlementStatus(
  order: OrderView,
  payouts: OutputType["payouts"],
): "Refunded" | "Settled" | "In next payout" {
  if (order.paymentStatus === "refunded") return "Refunded";
  const deliveredAt = new Date(order.deliveredAt ?? order.createdAt);
  return payouts.some(
    (payout) => payout.status === "paid" && deliveredAt <= new Date(payout.periodEnd),
  )
    ? "Settled"
    : "In next payout";
}