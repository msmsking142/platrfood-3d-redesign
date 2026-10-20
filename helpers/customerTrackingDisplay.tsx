import type { LiveOrderRoute } from "../endpoints/customer/order_route_POST.schema";
import type { OrderView } from "./orderView";
import { distanceInMeters } from "./geoDistance";

export type LocationAge = "unavailable" | "fresh" | "stale" | "lost";

export function getLocationAge(
  at: Date | string | null,
  now: number,
): { state: LocationAge; seconds: number | null } {
  if (at === null) return { state: "unavailable", seconds: null };

  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) return { state: "unavailable", seconds: null };

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return {
    state: seconds < 120 ? "fresh" : seconds <= 600 ? "stale" : "lost",
    seconds,
  };
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}

export function formatOrderTime(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getTrackingDisplay(
  order: OrderView,
  route: LiveOrderRoute | null | undefined,
  location: { lat: number; lng: number; at: Date | string } | null,
  now: number,
): { headline: string; subline: string | null; arrivingSoon: boolean } {
  const age = getLocationAge(location?.at ?? null, now);
  const routeAge =
    route?.computedAt == null
      ? null
      : Math.max(0, Math.floor((now - new Date(route.computedAt).getTime()) / 1000));
  const usableRoute =
    age.state !== "lost" &&
    age.state !== "unavailable" &&
    route?.available === true &&
    !route.stale &&
    routeAge !== null &&
    Number.isFinite(routeAge);

  const etaMinutes =
    usableRoute && order.status === "picked_up" && route.durationS !== null
      ? Math.max(1, Math.round((route.durationS - routeAge) / 60))
      : null;

  const nearDestination =
    order.status === "picked_up" &&
    age.state === "fresh" &&
    location !== null &&
    order.deliveryLat !== null &&
    order.deliveryLng !== null &&
    distanceInMeters(
      location.lat,
      location.lng,
      order.deliveryLat,
      order.deliveryLng,
    ) <= 300;

  const arrivingSoon = nearDestination || (etaMinutes !== null && etaMinutes <= 2);

  if (arrivingSoon) {
    return {
      headline: "Arriving soon",
      subline: age.seconds === null ? null : `Rider location updated ${formatElapsed(age.seconds)}`,
      arrivingSoon: true,
    };
  }

  if (etaMinutes !== null && route && routeAge !== null) {
    const distance =
      route.distanceM === null
        ? null
        : `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(route.distanceM / 1000)} km away`;
    return {
      headline: `Arriving in approximately ${etaMinutes} min`,
      subline: [distance, `route updated ${formatElapsed(routeAge)}`]
        .filter((part) => part !== null)
        .join(" · "),
      arrivingSoon: false,
    };
  }

  if (
    usableRoute &&
    order.status !== "picked_up" &&
    route.legToRestaurantS !== null &&
    routeAge !== null
  ) {
    const minutes = Math.max(1, Math.round((route.legToRestaurantS - routeAge) / 60));
    return {
      headline: "Rider is heading to the restaurant",
      subline: `Reaches restaurant in ~${minutes} min`,
      arrivingSoon: false,
    };
  }

  if (order.status === "placed") {
    return {
      headline: "Waiting for the restaurant to confirm",
      subline: null,
      arrivingSoon: false,
    };
  }
  if (order.status === "ready" && order.riderId === null) {
    return {
      headline: "Finding a delivery partner",
      subline: null,
      arrivingSoon: false,
    };
  }
  if (order.status === "accepted" || order.status === "preparing") {
    return {
      headline: "Restaurant is preparing your food",
      subline: null,
      arrivingSoon: false,
    };
  }
  return {
    headline: "Your order is on the way",
    subline: "Live ETA unavailable right now",
    arrivingSoon: false,
  };
}