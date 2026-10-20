import { ReactNode } from "react";
import styles from "./MerchantUi.module.css";

/** Shared building blocks for the merchant dashboard sections. */
export const MerchantSectionHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) => (
  <header className={`${styles.sectionHeader} ${className || ""}`}>
    <div>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
);

export const MerchantCard = ({
  children,
  className,
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "gold" | "ink" | "warn";
}) => <section className={`${styles.card} ${styles[tone]} ${className || ""}`}>{children}</section>;

export const MerchantStat = ({
  label,
  value,
  hint,
  tone = "plain",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "plain" | "gold" | "green" | "blue";
  icon?: ReactNode;
  className?: string;
}) => (
  <div className={`${styles.stat} ${styles["stat_" + tone]} ${className || ""}`}>
    <div className={styles.statTop}>
      <span>{label}</span>
      {icon}
    </div>
    <strong className={styles.statValue}>{value}</strong>
    {hint && <small className={styles.statHint}>{hint}</small>}
  </div>
);

export const MerchantEmpty = ({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) => (
  <div className={styles.empty}>
    {icon}
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export const MerchantField = ({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) => (
  <label className={`${styles.field} ${className || ""}`}>
    <span className={styles.fieldLabel}>{label}</span>
    {children}
    {hint && <small className={styles.fieldHint}>{hint}</small>}
  </label>
);