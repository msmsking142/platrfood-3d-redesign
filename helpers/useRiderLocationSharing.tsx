import { useEffect, useState } from "react";
import { postRiderLocation } from "../endpoints/rider/location_POST.schema";
import { distanceInMeters } from "./geoDistance";

export type RiderLocationStatus =
  | "off"
  | "starting"
  | "sharing"
  | "denied"
  | "unsupported"
  | "error";

type Position = {
  lat: number;
  lng: number;
  accuracy: number;
};

export function useRiderLocationSharing(enabled: boolean): {
  status: RiderLocationStatus;
  lastSentAt: Date | null;
} {
  const [status, setStatus] = useState<RiderLocationStatus>("off");
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      setLastSentAt(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    let active = true;
    let sending = false;
    let watchId: number | null = null;
    let latest: Position | null = null;
    let sent: Position | null = null;
    let lastSuccessfulAt = 0;
    let lastAttemptAt = 0;

    setStatus("starting");
    setLastSentAt(null);

    const send = async (position: Position, periodic = false) => {
      if (!active || sending) return;
      const now = Date.now();
      const moved =
        sent !== null &&
        distanceInMeters(sent.lat, sent.lng, position.lat, position.lng) > 30;
      const firstSend = sent === null && lastAttemptAt === 0;

      if (
        !firstSend &&
        !moved &&
        now - lastAttemptAt < 8000 &&
        !(periodic && now - lastSuccessfulAt >= 30_000)
      ) {
        return;
      }
      if (periodic && lastSuccessfulAt > 0 && now - lastSuccessfulAt < 30_000)
        return;

      sending = true;
      lastAttemptAt = now;
      try {
        await postRiderLocation(position);
        if (!active) return;
        sent = position;
        lastSuccessfulAt = Date.now();
        setLastSentAt(new Date(lastSuccessfulAt));
        setStatus("sharing");
      } catch (error) {
        console.error("Could not share rider location:", error);
        if (active) setStatus("error");
      } finally {
        sending = false;
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          latest = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          void send(latest);
        },
        (error) => {
          console.error("Rider geolocation failed:", error);
          if (active) {
            setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    } catch (error) {
      console.error("Could not start rider geolocation:", error);
      setStatus("error");
    }

    const resendTimer = window.setInterval(() => {
      if (latest && Date.now() - lastSuccessfulAt >= 30_000) {
        void send(latest, true);
      }
    }, 5000);

    return () => {
      active = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.clearInterval(resendTimer);
    };
  }, [enabled]);

  return { status, lastSentAt };
}