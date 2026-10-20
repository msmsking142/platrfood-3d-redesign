import type { OrderView } from "../helpers/orderView";
import { ziptoConfig } from "../helpers/ziptoConfig";
import styles from "./RestaurantSettlement.module.css";

export const RestaurantSettlement = ({
  order,
  compact = false,
  className,
}: {
  order: OrderView;
  compact?: boolean;
  className?: string;
}) => (
  <div className={`${styles.settlement} ${compact ? styles.compact : ""} ${className || ""}`}>
    <div className={styles.row}>
      <span>Food subtotal</span>
      <span>{ziptoConfig.rupees(order.itemsTotal)}</span>
    </div>
    {order.restaurantDiscount > 0 && (
      <div className={styles.row}>
        <span>Restaurant-funded discount</span>
        <span>−{ziptoConfig.rupees(order.restaurantDiscount)}</span>
      </div>
    )}
    <div className={styles.row}>
      <span>
        Commission ({order.commissionPercent}%{" "}
        {order.restaurantPlan === "basic" ? "Basic" : "Pro"})
      </span>
      <span>−{ziptoConfig.rupees(order.commissionAmount)}</span>
    </div>
    {order.commissionTax > 0 && (
      <div className={styles.row}>
        <span>GST on commission</span>
        <span>−{ziptoConfig.rupees(order.commissionTax)}</span>
      </div>
    )}
    {order.restaurantWithholding > 0 && (
      <div className={styles.row}>
        <span>Income-tax TDS (0.1%)</span>
        <span>−{ziptoConfig.rupees(order.restaurantWithholding)}</span>
      </div>
    )}
    {order.restaurantWithholding === 0 && (
      <small className={styles.footnote}>Income-tax TDS (0.1%) – deducted on weekly payout (5% without PAN).</small>
    )}
    <div className={`${styles.row} ${styles.net}`}>
      <strong>Restaurant net earnings</strong>
      <strong>{ziptoConfig.rupees(order.restaurantPayout)}</strong>
    </div>
    <small className={styles.footnote}>
      Delivery fees, platform fees and rider pay are never deducted from you.
      Subscription fees are billed separately.
    </small>
  </div>
);