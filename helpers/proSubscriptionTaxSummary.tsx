import type { OutputType } from "../endpoints/admin/finance_GET.schema";

type TaxSummaryRow = OutputType["taxSummary"][number];
type OrderTaxRow = Omit<
  TaxSummaryRow,
  "proSubscriptionGst" | "proSubscriptionBase" | "proSubscriptionCount"
>;

type SubscriptionTaxRow = {
  month: string;
  proSubscriptionGst: number | null;
  proSubscriptionBase: number | null;
  proSubscriptionCount: number;
};

export function mergeProSubscriptionTaxSummary(
  orderRows: OrderTaxRow[],
  subscriptionRows: SubscriptionTaxRow[],
): TaxSummaryRow[] {
  const byMonth = new Map<string, TaxSummaryRow>();

  for (const row of orderRows) {
    byMonth.set(row.month, {
      ...row,
      proSubscriptionGst: 0,
      proSubscriptionBase: 0,
      proSubscriptionCount: 0,
    });
  }

  for (const row of subscriptionRows) {
    const existing = byMonth.get(row.month);
    byMonth.set(row.month, {
      month: row.month,
      orderCount: existing?.orderCount ?? 0,
      foodSales: existing?.foodSales ?? 0,
      foodGst: existing?.foodGst ?? 0,
      deliveryPlatformGst: existing?.deliveryPlatformGst ?? 0,
      commissionGst: existing?.commissionGst ?? 0,
      proSubscriptionGst: Number(row.proSubscriptionGst ?? 0),
      proSubscriptionBase: Number(row.proSubscriptionBase ?? 0),
      proSubscriptionCount: Number(row.proSubscriptionCount),
    });
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}