import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeHelp,
  ClipboardList,
  History,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { postRiderAction } from "../endpoints/rider/action_POST.schema";
import { useMerchantOrderAlerts } from "../helpers/useMerchantOrderAlerts";
import { ziptoSound } from "../helpers/ziptoSound";
import { useRiderLocationSharing } from "../helpers/useRiderLocationSharing";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { CallSupportButton } from "./CallSupportButton";
import { RiderEarnings } from "./RiderEarnings";
import { RiderHelp } from "./RiderHelp";
import { RiderOrders } from "./RiderOrders";
import { RiderOverview } from "./RiderOverview";
import { RiderProfile } from "./RiderProfile";
import { RiderVerification } from "./RiderVerification";
import { StatusPill } from "./StatusPill";
import { Switch } from "./Switch";
import { ZiptoLogo } from "./ZiptoLogo";
import styles from "./RiderDashboard.module.css";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "history", label: "History", icon: History },
  { id: "earnings", label: "Earnings", icon: Wallet },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "help", label: "Help", icon: BadgeHelp },
  { id: "verification", label: "Verification", icon: ShieldCheck },
] as const;

type Section = (typeof sections)[number]["id"];

const isSection = (value: string | null): value is Section =>
  sections.some((section) => section.id === value);

export const RiderDashboard = ({
  data,
  className,
}: {
  data: OutputType;
  className?: string;
}) => {
  const rider = data.rider;
  const [adminNoteReply, setAdminNoteReply] = useState("");
  if (!rider) throw new Error("RiderDashboard requires a registered rider");

  const [params, setParams] = useSearchParams();
  const requestedSection = params.get("section");
  const feePaid = rider.onboardingFeePaidAt !== null;
  const section: Section = !feePaid
    ? "verification"
    : isSection(requestedSection)
    ? requestedSection
    : "overview";

  const onlineAction = ziptoHooks.useAction(
    postRiderAction,
    [ziptoHooks.keys.riderDashboard],
  );
  const noteAction = ziptoHooks.useAction(postRiderAction, [ziptoHooks.keys.riderDashboard], "Note marked as read");
  const availableIds =
    rider.status === "approved" && rider.isOnline
      ? data.available.map((order) => order.id)
      : [];
  const alerts = useMerchantOrderAlerts(availableIds, "rider");
  const sharing = useRiderLocationSharing(
    rider.status === "approved" &&
      rider.isOnline &&
      data.mine.some((order) =>
                ["accepted", "preparing", "ready", "picked_up"].includes(order.status),
      ),
  );

  const go = (nextSection: Section) => {
    const next = new URLSearchParams(params);
    if (nextSection === "overview") next.delete("section");
    else next.set("section", nextSection);
    setParams(next);
  };

  useEffect(() => {
    if (!feePaid && params.get("section") !== "verification") {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("section", "verification");
        return next;
      }, { replace: true });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section, feePaid, params, setParams]);
  useEffect(() => { setAdminNoteReply(""); }, [data.adminNote?.updatedAt]);

  const toggleOnline = () => {
    ziptoSound.playToggle(!rider.isOnline);
    onlineAction.mutate({
      action: "set_online",
      isOnline: !rider.isOnline,
    });
  };

  const content = (() => {
    switch (section) {
      case "orders":
        return <RiderOrders data={data} onGoOnline={toggleOnline} onlinePending={onlineAction.isPending} />;
      case "history":
      case "earnings":
        return <RiderEarnings data={data} mode={section} />;
      case "verification":
        return <RiderVerification data={data} onGoOnline={toggleOnline} onlinePending={onlineAction.isPending} />;
      case "profile":
        return <RiderProfile data={data} />;
      case "help":
        return <RiderHelp />;
      default:
        return (
          <RiderOverview
            data={data}
            locationStatus={sharing.status}
            onNavigate={go}
            onToggleOnline={toggleOnline}
            onlinePending={onlineAction.isPending}
          />
        );
    }
  })();

  return (
    <div className={`${styles.layout} riderMint ${className ?? ""}`}>
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderRow}>
          <div className={styles.mobileBrand}>
            <span className={styles.mobileLogoBadge}><ZiptoLogo fit="tight" size={30} /></span>
            <span>Rider Centre</span>
          </div>
          <div className={styles.mobileHeaderControls}>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.mobileSoundButton}
              aria-label={`Order sound ${alerts.soundEnabled ? "on" : "off"}`}
              aria-pressed={alerts.soundEnabled}
              onClick={() => {
                ziptoSound.playToggle(!alerts.soundEnabled);
                alerts.setSoundEnabled((enabled) => !enabled);
              }}
            >
              {alerts.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </Button>
            {rider.status === "approved" ? (
              <div className={styles.mobileSwitchRow}>
                <label
                  htmlFor="rider-mobile-online"
                  className={rider.isOnline ? styles.onlineLabel : ""}
                >
                  {rider.isOnline ? "Online" : "Offline"}
                </label>
                <Switch
                  id="rider-mobile-online"
                  checked={rider.isOnline}
                  disabled={onlineAction.isPending}
                  onCheckedChange={toggleOnline}
                />
              </div>
            ) : (
              <Link className={styles.mobileVerificationLink} to="/rider?section=verification">
                Verification needed
              </Link>
            )}
          </div>
        </div>
        <div className={styles.mobileActions}>
          {alerts.notificationPermission === "default" && (
            <Button variant="link" size="sm" onClick={() => void alerts.requestNotifications()}>
              Enable desktop alerts
            </Button>
          )}
          <CallSupportButton label="Call support" variant="outline" size="sm" />
        </div>
      </header>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.logoBadge}><ZiptoLogo fit="tight" size={46} /></span>
          <span className={styles.brandTag}>Rider Centre</span>
        </div>

        <div className={styles.riderIdentity}>
          <strong title={rider.name}>{rider.name}</strong>
          <span>{rider.town} · {rider.vehicleType}</span>
          <StatusPill status={rider.status} />
        </div>

        <nav className={styles.nav} aria-label="Rider dashboard sections">
          {sections.filter(({ id }) => feePaid || id === "verification").map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.navItem} ${active ? styles.navActive : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => go(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className={styles.navLabel}>{label}</span>
                {id === "orders" && rider.isOnline && data.available.length > 0 && (
                  <span className={styles.badge} aria-label={`${data.available.length} available orders`}>
                    {data.available.length}
                  </span>
                )}
                {id === "verification" && rider.status !== "approved" && (
                  <span className={styles.warnDot} aria-label="Verification needed" />
                )}
              </button>
            );
          })}
        </nav>

        <div className={styles.sideControls}>
          {rider.status === "approved" ? (
            <div className={styles.switchRow}>
              <div>
                <label
                  htmlFor="rider-sidebar-online"
                  className={rider.isOnline ? styles.onlineLabel : ""}
                >
                  {rider.isOnline ? "Online" : "Offline"}
                </label>
                <small>{rider.isOnline ? "Receiving orders" : "Not receiving orders"}</small>
              </div>
              <Switch
                id="rider-sidebar-online"
                checked={rider.isOnline}
                disabled={onlineAction.isPending}
                onCheckedChange={toggleOnline}
              />
            </div>
          ) : (
            <div className={styles.verificationLink}>
              <AlertCircle size={16} aria-hidden="true" />
              <span>Verification needed</span>
              <Link to="/rider?section=verification">View steps</Link>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={styles.soundButton}
            aria-pressed={alerts.soundEnabled}
            onClick={() => {
              ziptoSound.playToggle(!alerts.soundEnabled);
              alerts.setSoundEnabled((enabled) => !enabled);
            }}
          >
            {alerts.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Order sound {alerts.soundEnabled ? "on" : "off"}
          </Button>
          {alerts.notificationPermission === "default" && (
            <Button variant="link" size="sm" className={styles.alertButton} onClick={() => void alerts.requestNotifications()}>
              Enable desktop alerts
            </Button>
          )}
          <CallSupportButton label="Call support" variant="outline" size="sm" />
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

      <nav className={styles.bottomNav} aria-label="Rider dashboard sections">
        {sections.filter(({ id }) => feePaid || id === "verification").map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.bottomTab} ${active ? styles.bottomTabActive : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => go(id)}
            >
              <span className={styles.bottomIcon}>
                <Icon size={20} aria-hidden="true" />
                {id === "orders" && rider.isOnline && data.available.length > 0 && (
                  <span className={styles.bottomBadge} aria-label={`${data.available.length} available orders`}>
                    {data.available.length > 99 ? "99+" : data.available.length}
                  </span>
                )}
              </span>
              <span className={styles.bottomLabel}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};