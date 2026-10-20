import {
  ArrowRight, Bike, CalendarClock, ChartNoAxesCombined, IndianRupee,
  LifeBuoy, ReceiptText, ShieldCheck, Star, UtensilsCrossed, Wallet,
} from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Switch } from "./Switch";
import { StatusPill } from "./StatusPill";
import { MerchantCard, MerchantSectionHeader } from "./MerchantUi";
import styles from "./MerchantOverview.module.css";

type Section = "orders" | "menu" | "verification" | "subscription" | "finance" | "outlet" | "help" | "overview" | "reviews";

export const MerchantOverview = ({
  data,
  onNavigate,
  onSetOpen,
  openPending,
  className,
}: {
  data: OutputType;
  onNavigate: (section: Section) => void;
  onSetOpen: (isOpen: boolean) => void;
  openPending: boolean;
  className?: string;
}) => {
  const r = data.restaurant!;
  const settings = ziptoHooks.useSettings();
  const newCount = data.orders.filter((o) => o.status === "placed").length;
  const activeCount = data.orders.filter((o) =>
    ziptoConfig.activeStatuses.some((status) => status === o.status),
  ).length;
  const available = data.menu.filter((item) => item.isAvailable).length;
  const canToggle = r.status === "approved" && !openPending;

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div className={styles.desktopIntro}>
        <MerchantSectionHeader eyebrow="Overview" title={`Namaste, ${r.name}`} />
        <MerchantCard className={styles.statusCard}>
          <div>
            <strong>{r.isOpen ? "Open for orders" : "Outlet is closed"}</strong>
            <p>{r.status === "approved" ? `Customers in ${r.town} can order when your outlet is open.` : "You can open once platr™ approves your verification."}</p>
          </div>
          <div className={styles.statusRight}>
            <StatusPill status={r.status} />
            <Switch
              checked={r.isOpen}
              disabled={!canToggle}
              onCheckedChange={onSetOpen}
              aria-label="Open or close outlet"
              title={r.status !== "approved" ? "Available after platr™ approves your verification" : undefined}
            />
          </div>
        </MerchantCard>
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>Quick Stats</h2>
        <div className={styles.stats}>
          {[
            { label: "Today's Orders", value: String(data.stats.todayOrders), Icon: ReceiptText },
            { label: "Revenue", value: ziptoConfig.rupees(data.stats.todaySales), Icon: IndianRupee },
            { label: "Average prep time", value: `${r.avgPrepMinutes} min`, Icon: CalendarClock },
          ].map(({ label, value, Icon }) => (
            <div key={label} className={styles.statCard}>
              <span className={styles.statIcon}><Icon size={20} aria-hidden="true" /></span>
              <span className={styles.statLabel}>{label}</span>
              <strong className={styles.statValue}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      {newCount > 0 ? (
        <button type="button" className={styles.urgentAlert} onClick={() => onNavigate("orders")}>
          <strong>Recent Alert</strong>
          <span>You have {newCount} new order{newCount === 1 ? "" : "s"} pending approval!</span>
        </button>
      ) : (
        <div className={styles.clearAlert} role="status">All caught up — no orders waiting</div>
      )}

      <div className={styles.navigationGrid}>
        {[
          { label: "Active Orders", section: "orders", Icon: ReceiptText },
          { label: "Menu Management", section: "menu", Icon: UtensilsCrossed },
          { label: "Business Insights", section: "finance", Icon: ChartNoAxesCombined },
          { label: "Payouts & Bank", section: "finance", Icon: Wallet },
          { label: "Customer Reviews", section: "reviews", Icon: Star },
          { label: "Support", section: "help", Icon: LifeBuoy },
        ].map(({ label, section, Icon }) => (
          <button
            key={label}
            type="button"
            className={styles.navigationCard}
            onClick={() => onNavigate(section as Section)}
          >
            <span className={styles.navIcon}><Icon size={24} aria-hidden="true" /></span>
            <span>{label}</span>
            {section === "orders" && activeCount > 0 && (
              <span className={styles.badge} aria-label={`${activeCount} active orders`}>
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>Quick actions</h2>
        <div className={styles.actions}>

          <button type="button" className={styles.actionCard} onClick={() => onNavigate("menu")}>
            <UtensilsCrossed size={22} aria-hidden="true" />
            <span>Update Menu</span>
          </button>
          <button type="button" className={styles.actionCard} onClick={() => onNavigate("orders")}>
            <Bike size={22} aria-hidden="true" />
            <span>View Rider Status</span>
          </button>
        </div>
      </section>

      <div className={styles.lowerGrid}>
        <MerchantCard className={styles.attentionCard}>
          <h2 className={styles.heading}>Needs attention</h2>
          <div className={styles.attentionRow}>
            <UtensilsCrossed size={20} aria-hidden="true" />
            <span>{data.menu.length ? `${available} of ${data.menu.length} dishes available` : "Your menu is empty"}</span>
            <Button size="sm" variant="outline" onClick={() => onNavigate("menu")}>Edit menu</Button>
          </div>
          <div className={styles.attentionRow}>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>Verification {r.status}</span>
            <Button size="sm" variant="outline" onClick={() => onNavigate("verification")}>View</Button>
          </div>
        </MerchantCard>

        <MerchantCard className={styles.planCard}>
          <span>Your plan</span>
          <h2>platr™ {r.plan === "pro" ? "Pro" : "Basic"}</h2>
          {settings.isFetching && !settings.data ? (
            <Skeleton className={styles.pricingSkeleton} />
          ) : settings.isError || !settings.data ? (
            <p role="alert">Plan pricing is unavailable. Please try again later.</p>
          ) : (
            <p>
              {r.plan === "pro"
                ? `${ziptoConfig.rupees(settings.data.proMonthlyFee)} + GST / 30 days · ${settings.data.proCommissionPercent}% commission`
                : `₹0 monthly fee · ${settings.data.basicCommissionPercent}% commission per order`}
            </p>
          )}
          <button type="button" className={styles.planLink} onClick={() => onNavigate("subscription")}>
            Compare plans <ArrowRight size={16} aria-hidden="true" />
          </button>
        </MerchantCard>
      </div>
    </div>
  );
};