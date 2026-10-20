import { Link } from "react-router-dom";
import { Button } from "./Button";
import { GooglePlayComingSoon } from "./GooglePlayComingSoon";
import { ZiptoLogo } from "./ZiptoLogo";

import styles from "./SitePausedScreen.module.css";

export const SitePausedScreen = ({
  className,
  onLogout,
}: {
  className?: string;
  onLogout?: () => Promise<void>;
}) => (
  <section className={`${styles.screen} ${className ?? ""}`} aria-labelledby="site-paused-title">
    <ZiptoLogo size={64} />
    <span className={styles.badge}>Launching soon</span>
    <h1 id="site-paused-title">platr™ aa raha hai! 🚀</h1>
    <h2>Launching soon – poore Uttarakhand mein! 🏔️</h2>
    <p>Hum jald hi aa rahe hain. Thoda intezaar karein!</p>
    <GooglePlayComingSoon />
    <p>
      Need help? <Link to="/support">Contact platr™ Support</Link>
    </p>
    <p>
      <Link to="/terms">Terms of Service</Link> · <Link to="/privacy-policy">Privacy Policy</Link>
    </p>
    {onLogout && (
      <Button variant="secondary" size="sm" onClick={() => void onLogout()}>
        Log out
      </Button>
    )}
  </section>
);