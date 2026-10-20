import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bike,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import type { RiderLocationStatus } from "../helpers/useRiderLocationSharing";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { MerchantCard, MerchantSectionHeader, MerchantStat } from "./MerchantUi";
import { StatusPill } from "./StatusPill";
import { Switch } from "./Switch";
import styles from "./RiderOverview.module.css";

type Section = "overview" | "orders" | "history" | "earnings" | "verification" | "profile" | "help";

export const RiderOverview = ({
  data,
  locationStatus,
  onNavigate,
  onToggleOnline,
  onlinePending,
  className,
}: {
  data: OutputType;
  locationStatus: RiderLocationStatus;
  onNavigate: (section: Section) => void;
  onToggleOnline: () => void;
  onlinePending: boolean;
  className?: string;
}) => {
  const rider = data.rider;
  if (!rider) throw new Error("RiderOverview requires a registered rider");

  const active = data.mine.find((order) =>
    ["accepted", "preparing", "ready", "picked_up"].includes(order.status),
  );
  const verificationText =
    rider.status === "suspended"
      ? "Your rider account is suspended. Please email support."
      : rider.status === "rejected"
        ? rider.reviewNote || "Your documents need another look. Re-upload them for review."
        : rider.documentsSubmittedAt
          ? "Documents submitted. platr™ is reviewing them, usually within 24 hours."
          : "Upload your driving licence and selfie to start verification.";

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader
        eyebrow="Rider Centre"
        title={`Namaste, ${rider.name.trim().split(/\s+/)[0]} 👋`}
        subtitle={`${rider.town} · ${rider.vehicleType} · Deliver local. Earn fairly.`}
      />

      {rider.status !== "approved" ? (
        <MerchantCard tone="gold" className={styles.verificationCard}>
          <ShieldCheck size={32} aria-hidden="true" />
          <div>
            <h2>Verification needed</h2>
            <p>{verificationText}</p>
          </div>
          <Button asChild size="lg">
            <Link to="/rider?section=verification">View verification</Link>
          </Button>
        </MerchantCard>
      ) : (
        <MerchantCard
          tone="plain"
          className={`${styles.onlineCard} ${rider.isOnline ? styles.online : styles.offline}`}
        >
          <div>
            <span className={`${styles.eyebrow} ${rider.isOnline ? styles.onDuty : ""}`}>
              {rider.isOnline ? "You're on duty" : "Ready when you are"}
            </span>
            <h2>{rider.isOnline ? "You're online – orders aa rahe hain" : "Go online to start earning"}</h2>
            <p>{rider.isOnline ? "Nearby orders in your town will show up in Orders." : "Switch on to see available local deliveries."}</p>
          </div>
          <div className={styles.onlineSwitch}>
            <label htmlFor="rider-overview-online">{rider.isOnline ? "Online" : "Offline"}</label>
            <Switch
              id="rider-overview-online"
              checked={rider.isOnline}
              disabled={onlinePending}
              onCheckedChange={onToggleOnline}
            />
          </div>
        </MerchantCard>
      )}

      {rider.status === "approved" && rider.isOnline && (
        <div className={`${styles.location} ${locationStatus === "sharing" ? styles.locationSharing : ""}`} role={locationStatus === "denied" || locationStatus === "error" || locationStatus === "unsupported" ? "alert" : "status"}>
          <MapPin size={17} aria-hidden="true" />
          {locationStatus === "sharing"
            ? "Live location shared with restaurant"
            : locationStatus === "denied"
              ? "Allow location access so the restaurant can see you on the way."
              : locationStatus === "error"
                ? "Could not share location. Check your connection and location settings."
                : locationStatus === "unsupported"
                  ? "Live location is not available in this browser."
                  : locationStatus === "starting"
                    ? "Connecting live location…"
                    : "Location sharing starts when you have an active pickup."}
        </div>
      )}

      <div className={styles.stats}>
        <MerchantStat className={styles.statCard} label="Deliveries today" value={data.stats.todayDeliveries.toLocaleString("en-IN")} icon={<Bike size={19} />} />
        <MerchantStat className={styles.earnedStat} label="Earned today" value={ziptoConfig.rupees(data.stats.todayEarnings)} tone="green" icon={<IndianRupee size={19} />} />
        <MerchantStat className={styles.statCard} label="This week" value={ziptoConfig.rupees(data.stats.weekEarnings)} icon={<Wallet size={19} />} />
        <MerchantStat className={styles.statCard} label="COD to deposit" value={ziptoConfig.rupees(data.stats.cashToDeposit)} tone="gold" icon={<ClipboardList size={19} />} />
      </div>

      {active && (
        <MerchantCard className={styles.activeCard}>
          <div className={styles.activeHead}>
            <div>
              <span className={styles.eyebrow}>Current delivery</span>
              <h2>Order #{active.id} · {active.restaurantName}</h2>
            </div>
            <StatusPill status={active.status} />
          </div>
          <p>{active.restaurantAddress} → {active.deliveryAddress}</p>
          <strong>{ziptoConfig.rupees(active.riderPayout)} payout</strong>
          <Button size="lg" onClick={() => onNavigate("orders")}>
            {active.status === "ready" ? "Mark picked up" : active.status === "picked_up" ? "Complete delivery" : "View delivery"}
          </Button>
        </MerchantCard>
      )}

      {!active && rider.status === "approved" && (
        <MerchantCard className={styles.nextCard}>
          {rider.isOnline ? <CheckCircle2 size={22} aria-hidden="true" /> : <AlertCircle size={22} aria-hidden="true" />}
          <p>{rider.isOnline ? "You're all set. New local orders will appear in Orders." : "You're offline. Go online whenever you're ready to deliver."}</p>
          <Button variant="secondary" onClick={() => onNavigate("orders")}>View orders</Button>
        </MerchantCard>
      )}
    </div>
  );
};