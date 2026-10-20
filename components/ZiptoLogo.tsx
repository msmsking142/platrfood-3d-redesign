import styles from "./ZiptoLogo.module.css";

export const ZiptoLogo = ({
  className,
  size = 28,
  tone,
  fit = "default",
}: {
  className?: string;
  tone?: "ink" | "light";
  size?: number;
  fit?: "default" | "tight";
  tagline?: boolean;
  variant?: "wordmark" | "icon";
  }) => (
  <span className={`${styles.logoWrap} ${fit === "tight" ? styles.tight : ""} ${tone === "light" ? styles.lightTone : ""} ${className || ""}`}>
    <img
      className={`${styles.icon} ${styles.defaultLogo}`}
      src={fit === "tight" ? "/_cdn/static/platr-logo-tight.png" : "/_cdn/static/e9c5c08f-aa1a-4cc1-becd-9daf9cf922a0-platr-logo-transparent.png"}
      alt="platr™ — affordable for all"
      width={fit === "tight" ? Math.round(size * 2.8) : size * 3.4}
      height={size}
    />
    <img
      className={`${styles.icon} ${styles.darkLogo}`}
      src={fit === "tight" ? "/_cdn/static/platr-logo-dark-tight.png" : "/_cdn/static/16fe5f3a-8a99-4df2-846f-7d73c4d64024.png"}
      alt=""
      aria-hidden="true"
      width={fit === "tight" ? Math.round(size * 2.8) : size * 3.4}
      height={size}
    />
    <sup className={styles.trademark} aria-hidden="true">™</sup>
  </span>
);