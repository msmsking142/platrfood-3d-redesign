import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ziptoSound } from "./ziptoSound";

const SOUND_KEY = "zipto_merchant_sound";

export function useMerchantOrderAlerts(
  orderIds: number[],
  audience: "merchant" | "rider" = "merchant",
) {
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_KEY) !== "off",
  );
  const [audioReady, setAudioReady] = useState(() => ziptoSound.isReady());
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );

  const previousIdsRef = useRef<Set<number> | null>(null);
  const originalTitleRef = useRef(document.title);
  const lockedToastShownRef = useRef(false);
  const idsKey = [...orderIds].sort((a, b) => a - b).join(",");

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  useEffect(
    () =>
      ziptoSound.subscribe((ready) => {
        setAudioReady(ready);
        if (ready) lockedToastShownRef.current = false;
      }),
    [],
  );

  useEffect(() => {
    const ids = new Set(
      idsKey ? idsKey.split(",").map((id) => Number(id)) : [],
    );
    if (notificationPermission === "granted") {
      for (const id of ids) {
        if (previousIdsRef.current?.has(id)) continue;
        try {
          new Notification(
            audience === "rider" ? `New delivery #${id}` : `New order #${id}`,
            {
            body: audience === "rider"
              ? "A new delivery is available near you – tap to accept."
              : "A new order is waiting in your Merchant Centre.",
            tag: `zipto-order-${id}`,
          });
        } catch (error) {
          console.error("Could not show new-order notification:", error);
        }
      }
    }
    previousIdsRef.current = ids;
  }, [idsKey, notificationPermission, audience]);

  useEffect(() => {
    const count = idsKey ? idsKey.split(",").length : 0;
    if (!count) {
      document.title = originalTitleRef.current;
      return;
    }
    let highlighted = false;
    const flash = () => {
      highlighted = !highlighted;
      document.title = highlighted
        ? `🔔 (${count}) New order – platr™`
        : originalTitleRef.current;
    };
    flash();
    const timer = window.setInterval(flash, 1250);
    return () => {
      window.clearInterval(timer);
      document.title = originalTitleRef.current;
    };
  }, [idsKey]);

  useEffect(() => {
    if (!idsKey || !soundEnabled) return;

    const vibrate = () => {
      try {
        navigator.vibrate?.([400, 150, 400, 150, 600]);
      } catch (error) {
        console.error("platr™ order vibration could not be started:", error);
      }
    };

    vibrate();
    const timer = window.setInterval(vibrate, 2200);
    return () => {
      window.clearInterval(timer);
      try {
        navigator.vibrate?.(0);
      } catch (error) {
        console.error("platr™ order vibration could not be stopped:", error);
      }
    };
  }, [idsKey, soundEnabled]);

  useEffect(() => {
    if (!idsKey || !soundEnabled) {
      lockedToastShownRef.current = false;
      return;
    }
    if (!audioReady) {
      if (!lockedToastShownRef.current) {
        toast.info("Tap anywhere to enable order sound");
        lockedToastShownRef.current = true;
      }
      return;
    }

    const ring = () => {
      ziptoSound.playOrderRing();
    };

    ring();
    const timer = window.setInterval(ring, 2200);
    return () => {
      window.clearInterval(timer);
    };
  }, [idsKey, soundEnabled, audioReady]);

  const requestNotifications = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (error) {
      console.error("Could not request desktop alerts:", error);
      toast.error("Could not enable desktop alerts");
    }
  };

  return {
    soundEnabled,
    setSoundEnabled,
    notificationPermission,
    requestNotifications,
  };
}