import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, ReceiptText, UtensilsCrossed, ShieldCheck, Crown,
  IndianRupee, Store, LifeBuoy, AlertCircle, Volume2, VolumeX, Star,
} from "lucide-react";
import { toast } from "sonner";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { useMerchantAvailability } from "../helpers/useMerchantAvailability";
import { useMerchantOrderAlerts } from "../helpers/useMerchantOrderAlerts";
import { ziptoSound } from "../helpers/ziptoSound";
import { Button } from "./Button";
import { CallSupportButton } from "./CallSupportButton";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";
import { ZiptoLogo } from "./ZiptoLogo";
import { MerchantBottomNav } from "./MerchantBottomNav";
import { MerchantMoreSheet } from "./MerchantMoreSheet";
import { MerchantReviews } from "./MerchantReviews";
import { MerchantOnboarding } from "./MerchantOnboarding";
import { MerchantOverview } from "./MerchantOverview";
import { MerchantOrders } from "./MerchantOrders";
import { MerchantMenuEditor } from "./MerchantMenuEditor";
import { MerchantVerification } from "./MerchantVerification";
import { MerchantSubscription } from "./MerchantSubscription";
import { MerchantFinance } from "./MerchantFinance";
import { MerchantOutlet } from "./MerchantOutlet";
import { MerchantHelp } from "./MerchantHelp";
import styles from "./MerchantDashboard.module.css";

export const MERCHANT_SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ReceiptText },
  { id: "menu", label: "Menu Editor", icon: UtensilsCrossed },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "subscription", label: "Subscription", icon: Crown },
  { id: "finance", label: "Finance", icon: IndianRupee },
  { id: "reviews", label: "Customer Reviews", icon: Star },
  { id: "outlet", label: "Outlet Information", icon: Store },
  { id: "help", label: "Help Centre", icon: LifeBuoy },
] as const;
export type MerchantSectionId = (typeof MERCHANT_SECTIONS)[number]["id"];

const isSection = (s: string | null): s is MerchantSectionId =>
  MERCHANT_SECTIONS.some((x) => x.id === s);

export const MerchantDashboard = ({ className }: { className?: string }) => {
  const [params, setParams] = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminNoteReply, setAdminNoteReply] = useState("");
  const raw = params.get("section");
  const section: MerchantSectionId = isSection(raw) ? raw : "overview";
  const q = ziptoHooks.useRestaurantDashboard();
  const noteAction = ziptoHooks.useAction((x: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(x), [ziptoHooks.keys.restaurantDashboard], "Note marked as read");
  const availability = useMerchantAvailability();
  const alerts = useMerchantOrderAlerts(
    q.data?.orders.filter((order) => order.status === "placed").map((order) => order.id) ?? [],
  );

  const go = (id: MerchantSectionId) => {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("section");
    else next.set("section", id);
    setParams(next);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  if (q.isPending) {
    return (
      <div className={`merchantNavy ${styles.loading} ${className ?? ""}`}>
        <Skeleton className={styles.skelSide} />
        <Skeleton className={styles.skelMain} />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className={`merchantNavy ${styles.errorBox} ${className ?? ""}`}>
        <AlertCircle size={28} />
        <h2>Could not load your dashboard</h2>
        <p>{q.error instanceof Error ? q.error.message : "Please check your connection and try again."}</p>
        <Button disabled={q.isFetching} onClick={() => void q.refetch()}>
          {q.isFetching ? "Trying…" : "Try again"}
        </Button>
      </div>
    );
  }

  const data = q.data;
  useEffect(() => { setAdminNoteReply(""); }, [data.adminNote?.updatedAt]);
  if (!data.restaurant) return <div className={`merchantNavy ${className ?? ""}`}><MerchantOnboarding /></div>;
  const r = data.restaurant;
  const newOrders = data.orders.filter((o) => o.status === "placed").length;
  const moreSections = MERCHANT_SECTIONS.filter((item) =>
    ["verification", "subscription", "outlet", "reviews", "help"].includes(item.id),
  );
  const moreActive = moreSections.some((item) => item.id === section);

  const content = (() => {
    switch (section) {
      case "orders": return <MerchantOrders data={data} />;
      case "menu": return <MerchantMenuEditor data={data} />;
      case "verification": return <MerchantVerification data={data} />;
      case "subscription": return <MerchantSubscription data={data} />;
      case "finance": return <MerchantFinance data={data} />;
      case "reviews": return <MerchantReviews data={data} />;
      case "outlet": return <MerchantOutlet data={data} />;
      case "help": return <MerchantHelp />;
      default:
        return (
          <MerchantOverview
            data={data}
            onNavigate={go}
            onSetOpen={availability.setOpen}
            openPending={availability.isPending}
          />
        );
    }
  })();

  return (
    <div className={`merchantNavy ${styles.layout} ${className ?? ""}`}>
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderRow}>
          <div className={styles.mobileBrand}>
            <ZiptoLogo size={34} tone="light" />
            <span>Merchant Partner</span>
          </div>
          <button
            type="button"
            className={`${styles.onlineToggle} ${r.isOpen ? styles.online : ""}`}
            role="switch"
            aria-label="Outlet online"
            aria-checked={r.isOpen}
            aria-disabled={r.status !== "approved" || availability.isPending}
            disabled={availability.isPending}
            onClick={() => {
              if (r.status !== "approved") {
                toast("Your outlet can go online after platr™ approves your verification", {
                  action: { label: "View status", onClick: () => go("verification") },
                });
                return;
              }
              availability.setOpen(!r.isOpen);
            }}
          >
            <span className={styles.toggleLabel}>{r.isOpen ? "ONLINE" : "OFFLINE"}</span>
            <span className={`${styles.toggleKnob} ${availability.isPending ? styles.togglePending : ""}`} aria-hidden="true" />
          </button>
        </div>
        <strong className={styles.mobileOutlet}>{r.name}, {r.town}</strong>
      </header>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <ZiptoLogo size={44} tone="light" />
          <span className={styles.brandTag}>Merchant Centre</span>
        </div>
        <div className={styles.outlet}>
          <b title={r.name}>{r.name}</b>
          <div className={styles.outletMeta}>
            <span className={`${styles.dot} ${r.isOpen ? styles.dotOpen : ""}`} />
            {r.isOpen ? "Open" : "Closed"} · <StatusPill status={r.status} />
          </div>
        </div>
        <nav className={styles.nav} aria-label="Merchant dashboard">
          {MERCHANT_SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => go(s.id)}
              >
                <Icon size={18} />
                <span className={styles.navLabel}>{s.label}</span>
                {s.id === "orders" && newOrders > 0 && <span className={styles.navBadge}>{newOrders}</span>}
                {s.id === "verification" && r.status !== "approved" && <span className={styles.navWarn} />}
              </button>
            );
          })}
        </nav>
        <div className={styles.alertControls}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              ziptoSound.playToggle(!alerts.soundEnabled);
              alerts.setSoundEnabled((enabled) => !enabled);
            }}
            aria-pressed={alerts.soundEnabled}
          >
            {alerts.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Order sound {alerts.soundEnabled ? "on" : "off"}
          </Button>
          {alerts.notificationPermission === "default" && (
            <Button variant="link" size="sm" onClick={() => void alerts.requestNotifications()}>
              Enable desktop alerts
            </Button>
          )}
        </div>
        <div className={styles.sideHelp}>
          <b>Need a hand?</b>
          <span>Call platr™ support for help with orders or your account.</span>
          <CallSupportButton label="Call support" variant="outline" size="sm" />
          <Link to="/partner?section=help">Contact support →</Link>
        </div>
      </aside>

      <div className={styles.content} key={section}>
        {data.adminNote?.note && (() => {
          const unread = !data.adminNote.readAt || new Date(data.adminNote.updatedAt).getTime() > new Date(data.adminNote.readAt).getTime();
          return <section style={{ marginBottom: 18, padding: 16, borderRadius: 14, border: unread ? "2px solid #dc2626" : "1px solid #d6dbe3", background: unread ? "#fff1f2" : "#fff", color: unread ? "#991b1b" : "#20242c", boxShadow: unread ? "0 4px 14px rgba(220,38,38,.12)" : "none" }}>
            <strong style={{ display: "block", marginBottom: 6 }}>{unread ? "🔴 IMPORTANT — Note from Platr admin · Please read" : "Note from Platr admin"}</strong>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", color: unread ? "#991b1b" : "#20242c" }}>{data.adminNote.note}</p>
            <small style={{ display: "block", marginTop: 8 }}>Updated {new Date(data.adminNote.updatedAt).toLocaleString("en-IN")} · {unread ? "Unread" : "Read"}</small>
            {unread && <Button size="sm" variant="outline" disabled={noteAction.isPending} onClick={() => noteAction.mutate({ action: "mark_admin_note_read" })}>Mark note as read</Button>}
            {data.adminNote.partnerReply && <p style={{ margin: "12px 0 0", padding: 10, borderRadius: 8, background: "#f3f4f6", color: "#20242c" }}><strong>Your last reply:</strong><br />{data.adminNote.partnerReply}</p>}
            <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>Reply to admin
              <textarea value={adminNoteReply} onChange={(e) => setAdminNoteReply(e.target.value)} maxLength={1000} rows={3} placeholder="Write your reply here…" style={{ display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, color: "#111827", background: "#fff", boxSizing: "border-box" }} />
            </label>
            <Button size="sm" disabled={!adminNoteReply.trim() || noteAction.isPending} onClick={() => noteAction.mutate({ action: "reply_admin_note", reply: adminNoteReply.trim() }, { onSuccess: () => setAdminNoteReply("") })}>Send reply to admin</Button>
          </section>;
        })()}
        {content}
      </div>
      <MerchantBottomNav
        active={section}
        onNavigate={(id) => go(id as MerchantSectionId)}
        newOrders={newOrders}
        onMore={() => setMoreOpen(true)}
        moreActive={moreActive}
      />
      <MerchantMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        sections={moreSections}
        onNavigate={go}
        soundEnabled={alerts.soundEnabled}
        setSoundEnabled={alerts.setSoundEnabled}
        notificationPermission={alerts.notificationPermission}
        requestNotifications={alerts.requestNotifications}
      />
    </div>
  );
};