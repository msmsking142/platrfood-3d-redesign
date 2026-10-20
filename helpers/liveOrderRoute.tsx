// BACKEND ONLY. Do not import this helper into client-side code.
import { distanceInMeters } from "./geoDistance";
import { db } from "./db";
import { logGoogleRoutesHttpError, logInvalidGoogleRoute } from "./googleRoutesDiagnostics";

import type { LiveOrderRoute } from "../endpoints/customer/order_route_POST.schema";
import type { OrderStatus } from "./schema";

type Coordinates = { lat: number; lng: number };
type RiderLocation = Coordinates & { at: Date };
type Target = LiveOrderRoute["target"];

type RouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{ duration?: string; distanceMeters?: number }>;
  }>;
};

const FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters";

function emptyRoute(
  target: Target,
  available: boolean,
  stale: boolean,
  computedAt: Date | null = null,
): LiveOrderRoute {
  return {
    target,
    encodedPolyline: null,
    distanceM: null,
    durationS: null,
    legToRestaurantS: null,
    computedAt,
    originLat: null,
    originLng: null,
    stale,
    available,
  };
}

function durationSeconds(value: string | undefined): number {
  if (!value || !/^\d+(?:\.\d+)?s$/.test(value)) {
    logInvalidGoogleRoute("invalid duration");
    throw new Error("Invalid route duration");
  }
  const seconds = Number(value.slice(0, -1));
  if (!Number.isFinite(seconds)) {
    logInvalidGoogleRoute("invalid duration");
    throw new Error("Invalid route duration");
  }
  return Math.round(seconds);
}

function validCoordinates(point: Coordinates | null): point is Coordinates {
  return (
    point !== null &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export const liveOrderRoute = {
  async get({
    orderId,
    rider,
    restaurant,
    destination,
    status,
  }: {
    orderId: number;
    rider: RiderLocation;
    restaurant: Coordinates | null;
    destination: Coordinates | null;
    status: OrderStatus;
  }): Promise<LiveOrderRoute> {
    const target: Target =
      status === "picked_up" ? "destination" : "restaurant";
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();

    // An unconfigured integration must never create or update a cache row.
    if (!key) return emptyRoute(target, false, false);

    const cached = await db
      .selectFrom("orderRouteCache")
      .selectAll()
      .where("orderId", "=", orderId)
      .executeTakeFirst();

    const matchingCache = cached?.target === target ? cached : null;
    const now = new Date();
    const riderAgeMs = now.getTime() - rider.at.getTime();

    if (!Number.isFinite(riderAgeMs) || riderAgeMs > 120_000) {
      return matchingCache
        ? {
            target,
            encodedPolyline: matchingCache.failed ? null : matchingCache.encodedPolyline,
            distanceM: matchingCache.distanceM,
            durationS: matchingCache.durationS,
            legToRestaurantS: matchingCache.legToRestaurantS,
            computedAt: matchingCache.computedAt,
            originLat: matchingCache.originLat,
            originLng: matchingCache.originLng,
            stale: true,
            available: true,
          }
        : emptyRoute(target, true, true);
    }

    const endpoint = target === "restaurant" ? restaurant : destination;
    if (!validCoordinates(rider) || !validCoordinates(endpoint)) {
      return emptyRoute(target, true, false);
    }

    if (matchingCache) {
      const cacheAgeMs = now.getTime() - matchingCache.computedAt.getTime();
      if (matchingCache.failed && cacheAgeMs >= 0 && cacheAgeMs < 300_000) {
        return emptyRoute(target, true, false, matchingCache.computedAt);
      }

      if (
        !matchingCache.failed &&
        cacheAgeMs >= 0 &&
        (cacheAgeMs < 90_000 ||
          (cacheAgeMs < 600_000 &&
            distanceInMeters(
              matchingCache.originLat,
              matchingCache.originLng,
              rider.lat,
              rider.lng,
            ) < 250))
      ) {
        return {
          target,
          encodedPolyline: matchingCache.encodedPolyline,
          distanceM: matchingCache.distanceM,
          durationS: matchingCache.durationS,
          legToRestaurantS: matchingCache.legToRestaurantS,
          computedAt: matchingCache.computedAt,
          originLat: matchingCache.originLat,
          originLng: matchingCache.originLng,
          stale: false,
          available: true,
        };
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const toWaypoint = (point: Coordinates) => ({
        location: {
          latLng: { latitude: point.lat, longitude: point.lng },
        },
      });

      const hasRestaurantWaypoint =
        target === "restaurant" && validCoordinates(destination);
      const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({
            origin: toWaypoint(rider),
            destination: toWaypoint(
              hasRestaurantWaypoint ? destination : endpoint,
            ),
            ...(hasRestaurantWaypoint
              ? { intermediates: [toWaypoint(endpoint)] }
              : {}),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
            units: "METRIC",
          }),
        },
      );

      if (!response.ok) {
        await logGoogleRoutesHttpError(response);
        throw new Error("Routes API request failed");
      }

      const payload = (await response.json()) as RouteResponse;
      const route = payload.routes?.[0];
      const distanceM = route?.distanceMeters;
      const encodedPolyline = route?.polyline?.encodedPolyline;
      const firstLeg = route?.legs?.[0];

      if (
        typeof distanceM !== "number" ||
        !Number.isFinite(distanceM) ||
        distanceM < 0 ||
        !encodedPolyline ||
        !firstLeg ||
        typeof firstLeg.distanceMeters !== "number" ||
        !Number.isFinite(firstLeg.distanceMeters) ||
        firstLeg.distanceMeters < 0 ||
        (hasRestaurantWaypoint && route.legs?.length !== 2)
      ) {
        const reason =
          !encodedPolyline
            ? "missing polyline"
            : hasRestaurantWaypoint && route?.legs?.length !== 2
              ? `legs length ${route?.legs?.length ?? 0}`
              : !firstLeg
                ? "missing first leg"
                : typeof firstLeg.distanceMeters !== "number" ||
                    !Number.isFinite(firstLeg.distanceMeters) ||
                    firstLeg.distanceMeters < 0
                  ? "invalid first leg distance"
                  : "invalid route distance";
        logInvalidGoogleRoute(reason);
        throw new Error(reason);
      }

      const durationS = durationSeconds(route.duration);
      const legToRestaurantS =
        target === "restaurant"
          ? durationSeconds(firstLeg.duration)
          : null;

      await db
        .insertInto("orderRouteCache")
        .values({
          orderId,
          target,
          originLat: rider.lat,
          originLng: rider.lng,
          encodedPolyline,
          distanceM,
          durationS,
          legToRestaurantS,
          computedAt: now,
          failed: false,
        })
        .onConflict((conflict) =>
          conflict.column("orderId").doUpdateSet({
            target,
            originLat: rider.lat,
            originLng: rider.lng,
            encodedPolyline,
            distanceM,
            durationS,
            legToRestaurantS,
            computedAt: now,
            failed: false,
          }),
        )
        .execute();

      return {
        target,
        encodedPolyline,
        distanceM,
        durationS,
        legToRestaurantS,
        computedAt: now,
        originLat: rider.lat,
        originLng: rider.lng,
        stale: false,
        available: true,
      };
    } catch (error) {
      // Never log provider URLs, response bodies, or credentials.
      console.error(
        "Google Routes live order route failed",
        error instanceof Error ? error.name : "Unknown error",
      );

      await db
        .insertInto("orderRouteCache")
        .values({
          orderId,
          target,
          originLat: rider.lat,
          originLng: rider.lng,
          encodedPolyline: null,
          distanceM: null,
          durationS: null,
          legToRestaurantS: null,
          computedAt: now,
          failed: true,
        })
        .onConflict((conflict) =>
          conflict.column("orderId").doUpdateSet({
            target,
            originLat: rider.lat,
            originLng: rider.lng,
            encodedPolyline: null,
            distanceM: null,
            durationS: null,
            legToRestaurantS: null,
            computedAt: now,
            failed: true,
          }),
        )
        .execute();

      return emptyRoute(target, true, false, now);
    } finally {
      clearTimeout(timeout);
    }
  },
};