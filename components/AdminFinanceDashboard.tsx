import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import { schema, type InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { AdminWalletCard } from "./AdminWalletCard";
import { AdminPaymentReconciliation } from "./AdminPaymentReconciliation";
import { AdminRefundFailures } from "./AdminRefundFailures";
import styles from "./AdminFinanceDashboard.module.css";

type Props = {
  finance: AdminFinance;
  days: number;
  onDaysChange: (days: number) => void;
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  isFetching: boolean;
  className?: string;
};

export const AdminFinanceDashboard = ({
  finance, days, onDaysChange, onAction, isPending, isFetching, className,
}: Props) => {
  const [riderId, setRiderId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const summary = finance.summary;
  const money = ziptoConfig.rupees;

  const metrics = [
    ["Customer amount collected", money(summary.customerCollected)],
    ["Refunds", money(summary.refunds)],
    ["Restaurant payable balance", money(summary.restaurantPayableBalance)],
    ["Rider payable balance", money(summary.riderPayableBalance)],
    ["Commission revenue", money(summary.commissionRevenue)],
    ["Platform fee revenue", money(summary.platformFeeRevenue)],
    ["Delivery revenue", money(summary.deliveryRevenue)],
    ["Rider earnings", money(summary.riderEarnings)],
    ["Rider incentives", money(summary.riderIncentives)],
    ["Rider adjustments", money(summary.riderAdjustments)],
    ["Gateway fees (actual)", money(summary.gatewayFeesActual)],
    ["Gateway fees (estimated)", money(summary.gatewayFeesEstimated)],
    ["platr™ delivery subsidy", money(summary.ziptoDeliverySubsidy)],
    ["Taxes collected", money(summary.taxCollected)],
    ["Delivered orders", summary.deliveredOrders.toLocaleString("en-IN")],
    ["Avg contribution per order", money(summary.avgContributionPerOrder)],
  ];

  const addAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = schema.safeParse({
      action: "rider_adjustment",
      riderId: Number(riderId),
      amount: Number(amount),
      note: note.trim(),
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Invalid rider adjustment.");
      return;
    }
    onAction(result.data);
    setAmount("");
    setNote("");
  };

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-busy={isFetching}>
      <AdminRefundFailures failures={finance.refundFailures} />
      <div className={styles.heading}>
        <div>
          <h2>Finance</h2>
          <p>Activity from {new Date(finance.range.from).toLocaleDateString("en-IN")} to {new Date(finance.range.to).toLocaleDateString("en-IN")}. Payable balances and review worklist are all-time.</p>
        </div>
        <label className={styles.range}>
          <span>Reporting period</span>
          <Select value={String(days)} onValueChange={(value) => onDaysChange(Number(value))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[7, 30, 90].map((value) => <SelectItem key={value} value={String(value)}>{value} days</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className={styles.metrics}>
        {metrics.map(([label, value]) => (
          <div className={styles.metric} key={label}>
            <small>{label}</small>
            <strong className={label === "Avg contribution per order" && summary.avgContributionPerOrder < 0 ? styles.negative : ""}>
              {value}
            </strong>
          </div>
        ))}
      </div>

      <AdminPaymentReconciliation />
      <AdminWalletCard wallet={finance.wallet} isFetching={isFetching} />

      <h3>Orders needing economics review</h3>
      {!finance.flaggedOrders.length ? <p>No flagged orders.</p> : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Order</th><th scope="col">Flag</th><th scope="col">Delivery fee</th>
              <th scope="col">Rider pay</th><th scope="col">Subsidy</th>
              <th scope="col">Min fee to cover</th><th scope="col">Contribution</th><th scope="col">Review</th>
            </tr></thead>
            <tbody>
              {finance.flaggedOrders.map((order) => (
                <tr key={order.id}>
                  <th scope="row">#{order.id} · {order.restaurantName}<br /><small>{order.town} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</small></th>
                  <td>{order.economicsFlag === "delivery_shortfall" ? "Delivery fee below rider cost" : order.economicsFlag === "negative_contribution" ? "Loss-making order" : order.economicsFlag}</td>
                  <td>{money(order.deliveryFee)}</td>
                  <td>{money(order.riderPayout)}</td>
                  <td>{money(order.ziptoDeliverySubsidy)}</td>
                  <td>{order.minimumDeliveryFeeToCover === null ? "—" : money(order.minimumDeliveryFeeToCover)}</td>
                  <td className={order.contribution < 0 ? styles.negative : ""}>{money(order.contribution)}</td>
                  <td>{order.economicsReviewedAt ? `Reviewed ${new Date(order.economicsReviewedAt).toLocaleDateString("en-IN")}` : (
                    <Button size="sm" disabled={isPending} onClick={() => onAction({ action: "review_economics", orderId: order.id })}>
                      Mark reviewed
                    </Button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Monthly tax summary (for your CA)</h3>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr>
            <th scope="col">Month</th><th scope="col">Orders</th>
            <th scope="col">Food sales</th><th scope="col">Food GST 5%</th>
            <th scope="col">Delivery/platform GST 18%</th>
            <th scope="col">Commission GST 18%</th>
            <th scope="col">Pro subscription GST 18%</th><th scope="col">Total GST payable</th>
          </tr></thead>
          <tbody>
            {isFetching ? <tr><td colSpan={8}><Skeleton /></td></tr> :
              finance.taxSummary.length === 0 ? <tr><td colSpan={8}>No tax activity in the last 12 months.</td></tr> :
              finance.taxSummary.map((row) => (
                <tr key={row.month}>
                  <th scope="row">{row.month}</th>
                  <td>{row.orderCount.toLocaleString("en-IN")}</td>
                  <td>{money(row.foodSales)}</td>
                  <td>{money(row.foodGst)}</td>
                  <td>{money(row.deliveryPlatformGst)}</td>
                  <td>{money(row.commissionGst)}</td>
                  <td>{money(row.proSubscriptionGst)}<br /><small>{row.proSubscriptionCount.toLocaleString("en-IN")} subscription{row.proSubscriptionCount === 1 ? "" : "s"}</small></td>
                  <td>{money(row.foodGst + row.deliveryPlatformGst + row.commissionGst + row.proSubscriptionGst)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h3>TDS deducted per restaurant</h3>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr>
            <th scope="col">Month</th><th scope="col">Restaurant</th>
            <th scope="col">PAN</th><th scope="col">Food sales</th><th scope="col">TDS</th>
          </tr></thead>
          <tbody>
            {isFetching ? <tr><td colSpan={5}><Skeleton /></td></tr> :
              finance.tdsByRestaurant.length === 0 ? <tr><td colSpan={5}>No restaurant payout TDS in the last 12 months.</td></tr> :
              finance.tdsByRestaurant.map((row) => (
                <tr key={`${row.month}-${row.restaurantId}`}>
                  <th scope="row">{row.month}</th>
                  <td>{row.restaurantName}</td>
                  <td>{row.hasPan ? row.panMasked : <Badge variant="warning">No PAN – 5%</Badge>}</td>
                  <td>{money(row.foodTotal)}</td>
                  <td>{money(row.tdsAmount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p>GST paid by platr™ as e-commerce operator u/s 9(5). TDS u/s 393(1) Income-tax Act 2025. Confirm filings with your CA.</p>

      <h3>Rider balances</h3>
      {!finance.riderBalances.length ? <p>No approved riders yet.</p> : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Rider</th><th scope="col">Pending</th><th scope="col">Eligible</th>
              <th scope="col">In payout</th><th scope="col">Paid total</th>
            </tr></thead>
            <tbody>{finance.riderBalances.map((rider) => (
              <tr key={rider.riderId}>
                <th scope="row">{rider.name} · {rider.town}</th>
                <td>{money(rider.pending)}</td><td>{money(rider.eligible)}</td>
                <td>{money(rider.inPayout)}</td><td>{money(rider.paidTotal)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <form className={styles.adjustment} onSubmit={addAdjustment}>
        <h4>Rider adjustment</h4>
        <div className={styles.fields}>
          <label>
            Rider
            <Select value={riderId} onValueChange={setRiderId} disabled={isPending}>
              <SelectTrigger><SelectValue placeholder="Select a rider" /></SelectTrigger>
              <SelectContent>{finance.riderBalances.map((rider) =>
                <SelectItem key={rider.riderId} value={String(rider.riderId)}>{rider.name} · {rider.town}</SelectItem>
              )}</SelectContent>
            </Select>
          </label>
          <label>Amount ₹ (positive or negative)
            <Input type="number" step="1" min="-5000" max="5000" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={isPending} />
          </label>
          <label>Reason
            <Input value={note} onChange={(event) => setNote(event.target.value)} required minLength={3} maxLength={200} disabled={isPending} />
          </label>
        </div>
        <Button type="submit" disabled={isPending || !riderId}>{isPending ? "Saving…" : "Add adjustment"}</Button>
      </form>
    </section>
  );
};