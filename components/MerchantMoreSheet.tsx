import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogOut, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../helpers/useAuth";
import { ziptoSound } from "../helpers/ziptoSound";
import type { MerchantSectionId } from "./MerchantDashboard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./Sheet";
import styles from "./MerchantMoreSheet.module.css";

type MerchantMoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly {
    id: MerchantSectionId;
    label: string;
    icon: LucideIcon;
  }[];
  onNavigate: (section: MerchantSectionId) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  notificationPermission: NotificationPermission | "unsupported";
  requestNotifications: () => Promise<void>;
  className?: string;
};

export const MerchantMoreSheet = ({
  open,
  onOpenChange,
  sections,
  onNavigate,
  soundEnabled,
  setSoundEnabled,
  notificationPermission,
  requestNotifications,
  className,
}: MerchantMoreSheetProps) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={`${styles.sheet} ${className ?? ""}`}>
        <SheetHeader>
          <SheetTitle className={styles.title}>More</SheetTitle>
          <SheetDescription className={styles.description}>Manage your merchant account and preferences.</SheetDescription>
        </SheetHeader>
        <div className={styles.rows}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={styles.row}
              onClick={() => {
                onNavigate(id);
                onOpenChange(false);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.row}
            aria-pressed={soundEnabled}
            onClick={() => {
              ziptoSound.playToggle(!soundEnabled);
              setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>Order sound {soundEnabled ? "on" : "off"}</span>
          </button>
          {notificationPermission === "default" && (
            <button
              type="button"
              className={styles.row}
              onClick={() => void requestNotifications()}
            >
              <Volume2 size={18} aria-hidden="true" />
              <span>Enable desktop alerts</span>
            </button>
          )}
          <button
            type="button"
            className={`${styles.row} ${styles.logout}`}
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await logout();
                onOpenChange(false);
                navigate("/");
              } catch (error) {
                console.error("Merchant logout failed:", error);
                toast.error(error instanceof Error ? error.message : "Could not log out");
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{loggingOut ? "Logging out…" : "Log out"}</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};