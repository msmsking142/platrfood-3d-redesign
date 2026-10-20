import type { InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { Button } from "./Button";
import styles from "./AdminLaunchMode.module.css";

export const AdminLaunchMode = ({
  launchMode,
  sitePaused,
  onAction,
  isPending,
  compact = false,
  className,
}: {
  launchMode: boolean;
  sitePaused: boolean;
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  compact?: boolean;
  className?: string;
}) => {
  const toggle = () => {
    const next = !launchMode;
    if (
      confirm(
        next
          ? "Switch the public website back to Launching soon?"
          : "Go live now? Customers will be able to register and order, and all pending Pro payments will activate today (30 days each) with an email to each merchant.",
      )
    ) {
      onAction({ action: "set_launch_mode", launchMode: next });
    }
  };

  return (
    <div className={`${compact ? styles.compact : styles.card} ${className ?? ""}`}>
      {!compact && <h3>Launch mode</h3>}
      <p className={styles.status}>Launch mode: {launchMode ? "ON" : "OFF"}</p>
      {!compact && (
        <p>
          {launchMode
            ? "Website shows 'Launching soon' to the public. Customer registration is closed. Customers can't place orders. Restaurants & riders can still sign up and use their dashboards."
            : "The public website shows restaurants and menus."}
        </p>
      )}
      <Button size="sm" variant={launchMode ? "primary" : "secondary"} disabled={isPending} onClick={toggle}>
        {isPending ? "Saving…" : launchMode ? "Go live now" : "Switch back to Launching soon"}
      </Button>
      <p className={styles.status}>Pause website (everyone): {sitePaused ? "ON" : "OFF"}</p>
      {!compact && (
        <p>When paused, everyone except admins sees only the Launching soon page. New sign-ups are closed.</p>
      )}
      <Button
        size="sm"
        variant={sitePaused ? "primary" : "secondary"}
        disabled={isPending}
        onClick={() => {
          if (confirm(sitePaused
            ? "Resume the website for customers, restaurants and riders? New registrations will be allowed according to launch mode."
            : "Pause the website for everyone except admins and close all new registrations?")) {
            onAction({ action: "set_site_paused", sitePaused: !sitePaused });
          }
        }}
      >
        {isPending ? "Saving…" : sitePaused ? "Resume website" : "Pause website"}
      </Button>
    </div>
  );
};