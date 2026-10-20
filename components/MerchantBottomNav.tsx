import {
  Ellipsis,
  IndianRupee,
  LayoutDashboard,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";
import styles from "./MerchantBottomNav.module.css";

type MerchantBottomNavProps = {
  active: string;
  onNavigate: (id: string) => void;
  newOrders: number;
  onMore: () => void;
  moreActive: boolean;
  className?: string;
};

export const MerchantBottomNav = ({
  active,
  onNavigate,
  newOrders,
  onMore,
  moreActive,
  className,
}: MerchantBottomNavProps) => {
  const tabs = [
    { id: "overview", label: "Dashboard", Icon: LayoutDashboard },
    { id: "orders", label: "Orders", Icon: ReceiptText },
    { id: "menu", label: "Menu", Icon: UtensilsCrossed },
    { id: "finance", label: "Earning", Icon: IndianRupee },
  ] as const;

  return (
    <nav
      className={`${styles.nav} ${className ?? ""}`}
      aria-label="Merchant navigation"
    >
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id && !moreActive;

        return (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <span className={styles.iconWrap}>
              <Icon size={20} aria-hidden="true" />
              {id === "orders" && newOrders > 0 && (
                <span
                  className={styles.badge}
                  aria-label={`${newOrders} new orders`}
                >
                  {newOrders > 99 ? "99+" : newOrders}
                </span>
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}

      <button
        type="button"
        className={`${styles.tab} ${moreActive ? styles.active : ""}`}
        aria-current={moreActive ? "page" : undefined}
        aria-expanded={moreActive}
        onClick={onMore}
      >
        <span className={styles.iconWrap}>
          <Ellipsis size={20} aria-hidden="true" />
        </span>
        <span className={styles.label}>More</span>
      </button>
    </nav>
  );
};