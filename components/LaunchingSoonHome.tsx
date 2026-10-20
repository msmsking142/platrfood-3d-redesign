import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bike,
  CalendarDays,
  MapPin,
  Store,
  User,
} from "lucide-react";
import type { OutputType as Settings } from "../endpoints/settings_GET.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { GooglePlayComingSoon } from "./GooglePlayComingSoon";
import styles from "./LaunchingSoonHome.module.css";

type LaunchingSoonHomeProps = {
  className?: string;
  settings: Settings;
  showLogin?: boolean;
};

export function LaunchingSoonHome({
  className,
  settings,
  showLogin = false,
}: LaunchingSoonHomeProps) {
  return (
    <div className={`${styles.page} ${className ?? ""}`}>
      <section className={styles.hero} aria-labelledby="launch-headline">
        <div className={styles.heroTop}>
          <img
            className={styles.logo}
            src="/_cdn/static/Platr_TM_Logo.jpg"
            alt="platr™ – affordable for all"
          />
          {showLogin && (
            <Link className={styles.login} to="/login">
              Login
            </Link>
          )}
        </div>

        <div className={styles.heroCopy}>
          <h1 id="launch-headline"><span style={{ color: "#6EE7B7" }}>pl</span>atr<sup style={{ fontSize: "0.35em", verticalAlign: "super", marginLeft: "0.05em", fontWeight: 600 }}>™</sup> aa raha hai</h1>
          <p>
            Food Delivery, Ab Sahi Daam Par!
          </p>
          <span className={styles.launchPill}>
            🚀 Launching soon · Poore Uttarakhand mein
          </span>
          <GooglePlayComingSoon className={styles.playBadge} />
        </div>
      </section>

      <section className={styles.roles} aria-label="Explore platr™">
        <Link
          className={`${styles.roleCard} ${styles.customerCard}`}
          to="/login?as=user"
        >
          <span className={styles.roleIcon} aria-hidden="true">
            <User size={24} />
          </span>
          <span className={styles.roleCopy}>
            <strong>Customer</strong>
            <span>Order food</span>
          </span>
          <ArrowRight className={styles.roleArrow} size={22} aria-hidden="true" />
        </Link>
        <Link
          className={`${styles.roleCard} ${styles.restaurantCard}`}
          to="/login?join=restaurant"
        >
          <span className={styles.roleIcon} aria-hidden="true">
            <Store size={24} />
          </span>
          <span className={styles.roleCopy}>
            <strong>Restaurant</strong>
            <span>
              Sirf {settings.basicCommissionPercent}% commission · ₹0 joining
            </span>
          </span>
          <ArrowRight className={styles.roleArrow} size={22} aria-hidden="true" />
        </Link>
        <Link
          className={`${styles.roleCard} ${styles.riderCard}`}
          to="/login?join=rider"
        >
          <span className={styles.roleIcon} aria-hidden="true">
            <Bike size={24} />
          </span>
          <span className={styles.roleCopy}>
            <strong>Rider</strong>
            <span>Fair pay, weekly payouts</span>
          </span>
          <ArrowRight className={styles.roleArrow} size={22} aria-hidden="true" />
        </Link>
      </section>

      {showLogin && (
        <p className={styles.register}>
          Naya account? <Link to="/login?join=user">Register karein</Link>
        </p>
      )}

      <section className={styles.stats} aria-label="Why choose platr™">
        <div className={styles.stat}>
          <span className={styles.statIcon} aria-hidden="true">₹</span>
          <strong>{settings.platformFee === 0 ? "₹0" : "Clear pricing"}</strong>
          <span>
            {settings.platformFee === 0 ? "Platform fee" : "Upfront fees"}
          </span>
        </div>
        <div className={styles.stat}>
          <CalendarDays size={23} aria-hidden="true" />
          <strong>Weekly payouts</strong>
          <span>For our riders</span>
        </div>
        <div className={styles.stat}>
          <MapPin size={23} aria-hidden="true" />
          <strong>Live tracking</strong>
          <span>Every delivery</span>
        </div>
      </section>

      <div className={styles.notice}>
        <strong>Restaurants aur Riders – yeh mauka mat chhodiye! 🎉</strong>
        
      </div>

      <section className={styles.plans} aria-label="Become a platr™ partner">
        <div className={styles.planCard}>
          <Store size={28} aria-hidden="true" />
          <h2>Restaurant partner</h2>
          <p>
            Basic: ₹0 monthly, {settings.basicCommissionPercent}% commission.
            Pro: {ziptoConfig.rupees(settings.proMonthlyFee)} + GST / 30 days
            + {settings.proCommissionPercent}% commission.
          </p>
          <Button asChild variant="primary" className={styles.restaurantButton}>
            <Link to="/login?join=restaurant">Join as restaurant</Link>
          </Button>
        </div>
        <div className={styles.planCard}>
          <Bike size={28} aria-hidden="true" />
          <h2>Rider partner</h2>
          <p>Base pay + distance pay + incentive on every delivery.</p>
          <Button asChild variant="outline" className={styles.riderButton}>
            <Link to="/login?join=rider">Join as rider</Link>
          </Button>
        </div>
      </section>

      <p className={styles.footer}>Made for Uttarakhand 💛</p>
    </div>
  );
}