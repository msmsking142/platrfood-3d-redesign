import { ziptoConfig } from "../helpers/ziptoConfig";
import styles from "./StatusPill.module.css";

export const StatusPill = ({ status, className }: { status: string; className?: string }) => (
  <span className={`${styles.pill} ${styles[status] || ""} ${className || ""}`}>
    {ziptoConfig.orderStatusLabel[status] ??
      status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
  </span>
);