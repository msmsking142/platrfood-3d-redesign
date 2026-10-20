import styles from "./GooglePlayComingSoon.module.css";

export const GooglePlayComingSoon = ({
  className,
}: {
  className?: string;
}) => (
  <div className={`${styles.container} ${className || ""}`}>
    <div
      className={styles.badge}
      aria-label="platr™ app coming soon on Google Play"
    >
      <svg
        className={styles.logo}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <path fill="#4285F4" d="M4 3v26l13-13z" />
        <path fill="#34A853" d="M4 3l18 9-5 4z" />
        <path fill="#FBBC04" d="M22 12l7 4-7 4-5-4z" />
        <path fill="#EA4335" d="M4 29l13-13 5 4z" />
      </svg>
      <span className={styles.label}>
        <span className={styles.smallText}>Coming soon on</span>
        <span className={styles.storeName}>Google Play</span>
      </span>
      <span className={styles.soonTag}>Soon</span>
    </div>
    <p className={styles.note}>
      Uttarakhand ka Apna Food Delivery App
    </p>
  </div>
);