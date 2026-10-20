import { Home, Search, ShoppingBag, ClipboardList, UserRound } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { customerCartStore } from "../helpers/customerCartStore";
import { useAuth } from "../helpers/useAuth";
import styles from "./CustomerBottomNav.module.css";

export function CustomerBottomNav({ customerApp = false, className }: {
  customerApp?: boolean;
  className?: string;
}) {
  const { restaurantId, count } = customerCartStore.useCartBadge();
  const { authState } = useAuth();
  const location = useLocation();
  const isSearch = new URLSearchParams(location.search).get("search") === "1";
  const isCart =
    restaurantId !== null &&
    location.pathname === `/r/${restaurantId}` &&
    new URLSearchParams(location.search).get("cart") === "1";

  const homeActive = location.pathname === "/" && !isSearch;
  const searchActive = location.pathname === "/" && isSearch;
  const ordersActive = location.pathname === "/orders";
  const profileActive =
    location.pathname.startsWith("/account") ||
    location.pathname === "/login";

  const tabClass = (active: boolean) =>
    `${styles.tab} ${active ? styles.active : ""}`;

  return (
    <nav className={`${styles.nav} ${customerApp ? styles.customerNav : ""} ${className ?? ""}`} aria-label="Customer navigation">
      <NavLink to="/" end className={tabClass(homeActive)} aria-current={homeActive ? "page" : undefined}>
        <span className={styles.iconWrap}><Home size={22} aria-hidden="true" /></span>
        <span className={styles.label}>Home</span>
      </NavLink>
      <NavLink to="/?search=1" className={tabClass(searchActive)} aria-current={searchActive ? "page" : undefined}>
        <span className={styles.iconWrap}><Search size={22} aria-hidden="true" /></span>
        <span className={styles.label}>Search</span>
      </NavLink>
      <NavLink
        to={restaurantId === null ? "/" : `/r/${restaurantId}?cart=1`}
        className={tabClass(isCart)}
        aria-current={isCart ? "page" : undefined}
        onClick={() => {
          if (restaurantId === null) toast("Your cart is empty");
        }}
      >
        <span className={styles.iconWrap}>
          <ShoppingBag size={22} aria-hidden="true" />
          {count > 0 && <span className={styles.badge} aria-label={`${count} items in cart`}>{count}</span>}
        </span>
        <span className={styles.label}>Cart</span>
      </NavLink>
      <NavLink to="/orders" className={tabClass(ordersActive)} aria-current={ordersActive ? "page" : undefined}>
        <span className={styles.iconWrap}><ClipboardList size={22} aria-hidden="true" /></span>
        <span className={styles.label}>Orders</span>
      </NavLink>
      <NavLink
        to={authState.type === "authenticated" ? "/account" : "/login"}
        className={tabClass(profileActive)}
        aria-current={profileActive ? "page" : undefined}
      >
        <span className={styles.iconWrap}><UserRound size={22} aria-hidden="true" /></span>
        <span className={styles.label}>Profile</span>
      </NavLink>
    </nav>
  );
}