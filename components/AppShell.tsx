import { ReactNode, useEffect } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogOut, ShoppingBag, Store, Bike, ShieldCheck, Home, Headset, UtensilsCrossed, UserRound } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { ziptoHooks } from "../helpers/ziptoHooks";

import { ziptoConfig } from "../helpers/ziptoConfig";
import { useNativeApp } from "../helpers/useNativeApp";
import { ZiptoLogo } from "./ZiptoLogo";
import { Button } from "./Button";
import { CallSupportButton } from "./CallSupportButton";
import { Skeleton } from "./Skeleton";
import { SitePausedScreen } from "./SitePausedScreen";
import { NotificationAndOverlaySetup } from "./NotificationAndOverlaySetup";
import { CustomerBottomNav } from "./CustomerBottomNav";
import styles from "./AppShell.module.css";

const navByRole: Record<string, { to: string; label: string; icon: ReactNode }[]> = {
  user: [
    { to: "/", label: "Explore", icon: <Home size={18} /> },
    { to: "/orders", label: "My orders", icon: <ShoppingBag size={18} /> },
    { to: "/account", label: "Account", icon: <UserRound size={18} /> },
  ],
  restaurant: [{ to: "/partner", label: "Restaurant dashboard", icon: <Store size={18} /> }, { to: "/partner?section=menu", label: "Menu editor", icon: <UtensilsCrossed size={18} /> }, { to: "/orders", label: "Customer orders", icon: <ShoppingBag size={18} /> }],
  rider: [{ to: "/rider", label: "Rider dashboard", icon: <Bike size={18} /> }, { to: "/orders", label: "My orders", icon: <ShoppingBag size={18} /> }],
  admin: [
    { to: "/admin", label: "Admin", icon: <ShieldCheck size={18} /> },
  ],
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nativeApp = useNativeApp();
  const settings = ziptoHooks.useSettings();
  const user = authState.type === "authenticated" ? authState.user : null;
  const wallet = ziptoHooks.useWallet(user?.role === "user" ? user.id : null);
  const merchantApp = user?.role === "restaurant" && pathname === "/partner";
  const riderApp = user?.role === "rider" && pathname === "/rider";
  const adminApp = user?.role === "admin";
  const customerApp = user?.role === "user" && pathname !== "/login";
  const guestHome = pathname === "/" && authState.type === "unauthenticated";

  useEffect(() => {
        // "dark" also enables the design-system components' built-in dark variants (inputs, skeletons, toasts).
    document.body.classList.toggle("platr-dark", customerApp);
    document.body.classList.toggle("dark", customerApp);
    return () => document.body.classList.remove("platr-dark", "dark");
  }, [customerApp]);

  const showCustomerNav =
    pathname !== "/login" &&
    authState.type !== "loading" &&
    (!user || user.role === "user");

  const nativeCustomerHome = nativeApp && pathname === "/" && showCustomerNav;
  const isException = pathname === "/login" || pathname === "/terms" || pathname === "/privacy-policy";
  const content = isException ? children
    : settings.isFetching && !settings.data
      ? <Skeleton aria-label="Loading website settings" />
      : settings.isError || !settings.data
        ? (
          <div role="alert">
            <p>Could not load website settings. {settings.error instanceof Error ? settings.error.message : "Please try again."}</p>
            <Button onClick={() => void settings.refetch()}>Retry</Button>
          </div>
        )
        : settings.data.sitePaused && authState.type === "loading"
          ? <Skeleton aria-label="Checking access" />
          : settings.data.sitePaused && user?.role !== "admin"
            ? (
              <SitePausedScreen
                onLogout={user ? async () => {
                  await logout();
                  navigate("/");
                } : undefined}
              />
            )
            : children;
  const nav = user ? navByRole[user.role] ?? [] : [];

  return (
    <div className={`${styles.shell} ${showCustomerNav ? styles.withCustomerNav : ""} ${pathname === "/login" ? styles.loginPage : ""} ${merchantApp ? styles.merchantApp : ""} ${riderApp ? styles.riderApp : ""} ${nativeCustomerHome ? styles.nativeCustomerHome : ""} ${adminApp ? styles.adminApp : ""} ${customerApp ? styles.customerApp : ""} ${guestHome ? styles.guestHome : ""}`}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <ZiptoLogo size={46} fit="tight" tone={merchantApp ? "light" : undefined} className={styles.headerBrand} />
          </Link>
          <nav className={styles.nav}>
            {nav.map((n) => (
              <NavLink
                key={n.to + n.label}
                to={n.to}
                end
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}
              >
                {n.icon}
                <span>{n.label}</span>
                {n.to === "/account" && user?.role === "user" && !wallet.isFetching && (
                  wallet.isError
                    ? <span className={styles.walletError} role="alert">Wallet unavailable</span>
                    : wallet.data && <span className={styles.walletChip}>{ziptoConfig.rupees(wallet.data.balance)}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className={styles.right}>

            {user ? (
              <>
                <span className={styles.hello}>Hi, {user.displayName.split(" ")[0]}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Log out"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  <LogOut size={18} />
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Login / Join</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {adminApp && !["/admin", "/terms", "/privacy-policy"].includes(pathname)
          ? <Navigate to="/admin" replace />
          : content}
      </main>
      {user && !adminApp && !settings.data?.sitePaused && (user.role === "user" || user.role === "restaurant" || user.role === "rider") && (
        <NotificationAndOverlaySetup key={`${user.id}-${user.role}`} role={user.role} />
      )}
      {!adminApp && <footer className={styles.footer}>
        <ZiptoLogo size={64} fit="tight" className={styles.footerBrand} />
        <p>platr™ — Uttarakhand ka apna low-commission food app.</p>
        <div className={styles.footerLinks}>
          <CallSupportButton label="Call us" />
          <Button variant="secondary" asChild>
            <Link to="/support"><Headset size={16} /> Contact support</Link>
          </Button>
          <Link to="/terms" className={styles.termsLink}>Terms of Service</Link>
          <Link to="/privacy-policy" className={styles.termsLink}>Privacy Policy</Link>
        </div>
        
      </footer>}
      {showCustomerNav && <CustomerBottomNav customerApp={customerApp} />}
    </div>
  );
};