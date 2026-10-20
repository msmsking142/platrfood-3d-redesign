import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { postMapsReverseGeocode } from "../endpoints/maps/reverse_geocode_POST.schema";
import { useAuth } from "./useAuth";
import { useCallbackRef } from "./useCallbackRef";
import { ziptoConfig } from "./ziptoConfig";

const LOCATION_KEY = "zipto_delivery_location";
const TOWN_KEY = "zipto_town";

const locationSchema = z.object({
  kind: z.enum(["current", "address", "town"]),
  label: z.string().min(1),
  line: z.string().min(1),
  town: z.string().min(1),
  addressId: z.number().int().positive().optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
}).strict();

export type DeliveryLocation = z.infer<typeof locationSchema>;

function readLocation(): DeliveryLocation {
  if (typeof window === "undefined") {
    return {
      kind: "town",
      label: "Rudrapur",
      line: "Rudrapur, Uttarakhand",
      town: "Rudrapur",
    };
  }

  try {
    const stored = window.localStorage.getItem(LOCATION_KEY);
    if (stored) {
      const parsed = locationSchema.safeParse(JSON.parse(stored));
      if (parsed.success) return parsed.data;
      console.error("Invalid saved delivery location:", parsed.error);
    }

    const town = window.localStorage.getItem(TOWN_KEY)?.trim() || "Rudrapur";
    return { kind: "town", label: town, line: `${town}, Uttarakhand`, town };
  } catch (error) {
    console.error("Could not read delivery location:", error);
    return {
      kind: "town",
      label: "Rudrapur",
      line: "Rudrapur, Uttarakhand",
      town: "Rudrapur",
    };
  }
}

function matchingTown(value: string | null): string | null {
  const candidate = value?.trim().toLocaleLowerCase("en-IN");
  if (!candidate) return null;

  return (
    ziptoConfig.towns.find((town) =>
      candidate.includes(town.toLocaleLowerCase("en-IN"))
    ) ??
    ziptoConfig.towns.find((town) =>
      town.toLocaleLowerCase("en-IN").includes(candidate)
    ) ??
    null
  );
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 1;
}

export function useDeliveryLocation() {
  const { authState } = useAuth();
  const [location, updateLocation] = useState<DeliveryLocation>(readLocation);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);

  const setLocation = useCallbackRef((next: DeliveryLocation) => {
    const validated = locationSchema.parse(next);
    updateLocation(validated);

    try {
      window.localStorage.setItem(LOCATION_KEY, JSON.stringify(validated));
      window.localStorage.setItem(TOWN_KEY, validated.town);
    } catch (error) {
      console.error("Could not persist delivery location:", error);
      toast.error("Location could not be saved on this device.");
    }
  });

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key === LOCATION_KEY ||
        (event.key === TOWN_KEY && !window.localStorage.getItem(LOCATION_KEY))
      ) {
        updateLocation(readLocation());
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const useCurrentLocation = useCallbackRef(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocating(true);

    try {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        throw new Error("Location access is not available on this device.");
      }

      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 0,
          });
        },
      );

      let line = "Near you";
      let town = location.town;

      if (authState.type === "authenticated") {
        try {
          const address = await postMapsReverseGeocode({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          line = address.formattedAddress || line;
          town = matchingTown(address.town) ??
            matchingTown(address.formattedAddress) ??
            town;
        } catch (error) {
          console.error("Current-location address lookup failed:", error);
        }
      }

      setLocation({
        kind: "current",
        label: "Current location",
        line,
        town,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch (error) {
      console.error("Current-location request failed:", error);
      toast.error(
        isPermissionDenied(error)
          ? "Location permission denied. Enable it in your device settings."
          : error instanceof Error
            ? error.message
            : "Could not get your current location.",
      );
      throw error;
    } finally {
      inFlight.current = false;
      setLocating(false);
    }
  });

  return { location, setLocation, useCurrentLocation, locating };
}