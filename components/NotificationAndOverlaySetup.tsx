import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Smartphone, X } from "lucide-react";
import { Button } from "./Button";
import { useNativeApp } from "../helpers/useNativeApp";
import styles from "./NotificationAndOverlaySetup.module.css";

type Role = "user" | "restaurant" | "rider";

export const NotificationAndOverlaySetup = ({ role }: { role: Role }) => {
  const nativeApp = useNativeApp();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () => typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [showOverlayHelp, setShowOverlayHelp] = useState(false);
  const [overlayConfirmed, setOverlayConfirmed] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const enableNotifications = async () => {
    setNotificationError("");
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      setNotificationError("This browser does not support web notifications. Install/open platr™ in a supported browser and allow notifications in site settings.");
      return;
    }
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setNotificationError("Could not request notification permission. Open your browser's site settings and allow notifications for platr™.");
    }
  };

  const roleLabel = role === "user" ? "customer" : role === "restaurant" ? "restaurant partner" : "rider";
  const notificationsReady = permission === "granted";

  if (notificationsReady && overlayConfirmed) return null;

  return (
    <section className={styles.wrap} aria-label="Live order alert setup">
      {!notificationsReady && (
        <div className={styles.row}>
          <span className={styles.icon}><BellRing size={20} /></span>
          <div className={styles.copy}>
            <strong>{permission === "denied" ? "Notifications are blocked" : "Turn on order notifications"}</strong>
            <p>{permission === "denied" ? "Allow notifications for platr™ in your browser or phone app settings so you don't miss order updates." : `Enable notifications for your ${roleLabel} account to get order alerts while platr™ is open.`}</p>
            {notificationError && <p role="alert" className={styles.error}>{notificationError}</p>}
          </div>
          {permission !== "denied" && permission !== "unsupported" && <Button size="sm" onClick={() => void enableNotifications()}>Enable</Button>}
        </div>
      )}
      {!overlayConfirmed && (
        <div className={styles.row}>
          <span className={styles.icon}><Smartphone size={20} /></span>
          <div className={styles.copy}>
            <strong>Set up Live Order overlay</strong>
            <p>Check your phone settings so platr™ live-order updates are easier to see while using other apps.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowOverlayHelp(true)}>How to set up</Button>
        </div>
      )}
      {showOverlayHelp && (
        <div className={styles.backdrop} role="presentation" onClick={() => setShowOverlayHelp(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="overlay-title" onClick={(event) => event.stopPropagation()}>
            <button className={styles.close} aria-label="Close instructions" onClick={() => setShowOverlayHelp(false)}><X size={20} /></button>
            <h2 id="overlay-title">Enable Live Order overlay</h2>
            <p className={styles.note}>On Android, open your phone's Settings and look for one of these paths (the wording varies by phone):</p>
            <ol>
              <li>Apps → Special app access → Display over other apps</li>
              <li>Choose platr™, if listed, and allow the permission.</li>
              <li>Also open Settings → Apps → platr™ → Notifications and allow notifications.</li>
              <li>On some phones, allow background activity / auto-start for timely order updates.</li>
            </ol>
            {nativeApp ? <p className={styles.note}>If platr™ is not listed under “Display over other apps”, this app build may not request native overlay permission yet.</p> : <p className={styles.note}>Important: a website/PWA cannot turn on Android's system overlay permission itself. These are manual settings, and the current web app cannot create a system-wide floating window by itself.</p>}
            <div className={styles.actions}>
              <Button onClick={() => { setOverlayConfirmed(true); setShowOverlayHelp(false); }}>I've checked my settings</Button>
              <Button variant="ghost" onClick={() => setShowOverlayHelp(false)}>Do this later</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};