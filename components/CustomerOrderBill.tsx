import type { OrderView } from "../helpers/orderView";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Skeleton } from "./Skeleton";
import styles from "./CustomerOrderBill.module.css";

type CustomerOrderBillProps = {
  order: OrderView;
  money: (amount: number) => string;
  className?: string;
};

export function CustomerOrderBill({
  order,
  money,
  className,
}: CustomerOrderBillProps) {
  const settings = ziptoHooks.useSettings();
  const distanceNote =
    order.distanceSource === "estimated"
      ? order.distanceM === null
        ? "~ estimate"
        : `~${(order.distanceM / 1000).toFixed(1)} km estimate`
      : order.distanceM === null
        ? null
        : `${(order.distanceM / 1000).toFixed(1)} km`;

  return (
    <div className={`${styles.bill} ${className ?? ""}`}>
      <div className={styles.row}>
        <span>Item total</span><span>{money(order.itemsTotal)}</span>
      </div>
      {order.restaurantDiscount > 0 && (
        <div className={styles.row}>
          <span>Restaurant discount</span>
          <span>−{money(order.restaurantDiscount)}</span>
        </div>
      )}
      <div className={styles.row}>
        <span>
          Delivery fee
          {(distanceNote || order.peakFee > 0) && (
            <small className={styles.note}>
              {[distanceNote, order.peakFee > 0
                ? `incl. ${money(order.peakFee)} peak-time`
                : null].filter(Boolean).join(" · ")}
            </small>
          )}
        </span>
        <span>{money(order.deliveryFee)}</span>
      </div>
      {order.surgeFee > 0 && (
        <div className={styles.row}>
          <span>Surge fee</span><span>{money(order.surgeFee)}</span>
        </div>
      )}
      {order.smallOrderFee > 0 && (
        <div className={styles.row}>
          <span>Small-order fee</span><span>{money(order.smallOrderFee)}</span>
        </div>
      )}
      <div className={styles.row}>
        <span>Platform fee</span><span>{money(order.platformFee)}</span>
      </div>
      {order.ziptoDiscount > 0 && (
        <div className={styles.row}>
          <span>platr™ delivery offer</span>
          <span>−{money(order.ziptoDiscount)}</span>
        </div>
      )}
      {order.foodTax > 0 && (
        <div className={styles.row}>
          <span>GST on food</span><span>{money(order.foodTax)}</span>
        </div>
      )}
      {order.deliveryTax > 0 && (
        <div className={styles.row}>
          <span>GST on delivery &amp; fees</span>
          <span>{money(order.deliveryTax)}</span>
        </div>
      )}
      <div className={`${styles.row} ${styles.total}`}>
        <strong>{order.paymentMethod === "cod" || order.paymentStatus === "pending"
          ? "Total payable"
          : "Total paid"}</strong>
        <strong>{money(order.total)}</strong>
      </div>
      {settings.isFetching && <Skeleton />}
      {settings.error && !settings.isFetching && <small className={styles.settingsError} role="alert">Could not load platr™ GSTIN: {settings.error.message}</small>}
      {!settings.isFetching && settings.data?.ziptoGstin && (
        <small className={styles.note}>platr™ GSTIN: {settings.data.ziptoGstin}</small>
      )}
    </div>
  );
}