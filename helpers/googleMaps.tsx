// BACKEND ONLY. Never import this helper into client-side code.
import { db } from "./db";
import { HttpError } from "./requireRole";

const TIMEOUT_MS = 5_000;
const CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

type Coordinates = { lat: number; lng: number };
type AddressComponent = { longText?: string; types?: string[] };

type PlaceDetails = Coordinates & {
  formattedAddress: string;
  town: string | null;
};

function configuredKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

function logFailure(operation: string, error: unknown): void {
  // Do not log Error.message: provider/network errors can contain request URLs.
  console.error(
    `Google Maps ${operation} failed`,
    error instanceof Error ? error.name : "Unknown error",
  );
}

async function googleRequest<T>(
  operation: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Google Maps ${operation} returned HTTP ${response.status}`);
      throw new Error("Google Maps request failed");
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function townFromComponents(
  components: AddressComponent[] | undefined,
  useFallbacks: boolean,
): string | null {
  const types = useFallbacks
    ? ["locality", "administrative_area_level_3", "sublocality"]
    : ["locality"];

  for (const type of types) {
    const value = components?.find((component) =>
      component.types?.includes(type),
    )?.longText;
    if (value) return value;
  }
  return null;
}

function roundedCoordinate(value: number): number {
  return Math.round(value * 10_000);
}

function parseDuration(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

export const googleMaps = {
  isConfigured(): boolean {
    return configuredKey() !== null;
  },

  async roadDistance({
    restaurantId,
    originLat,
    originLng,
    destLat,
    destLng,
  }: {
    restaurantId: number;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }): Promise<{ distanceM: number; durationS: number | null } | null> {
    const key = configuredKey();
    if (!key) {
      console.error("Google Maps road distance unavailable: key not configured");
      return null;
    }

    const originLatE4 = roundedCoordinate(originLat);
    const originLngE4 = roundedCoordinate(originLng);
    const destLatE4 = roundedCoordinate(destLat);
    const destLngE4 = roundedCoordinate(destLng);

    try {
      const cached = await db
        .selectFrom("routeDistanceCache")
        .select(["distanceM", "durationS"])
        .where("restaurantId", "=", restaurantId)
        .where("originLatE4", "=", originLatE4)
        .where("originLngE4", "=", originLngE4)
        .where("destLatE4", "=", destLatE4)
        .where("destLngE4", "=", destLngE4)
        .where("createdAt", ">=", new Date(Date.now() - CACHE_AGE_MS))
        .orderBy("createdAt", "desc")
        .executeTakeFirst();

      if (cached) return cached;

      const result = await googleRequest<{
        routes?: { distanceMeters?: number; duration?: string }[];
      }>(
        "road distance",
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: originLatE4 / 10_000,
                  longitude: originLngE4 / 10_000,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destLatE4 / 10_000,
                  longitude: destLngE4 / 10_000,
                },
              },
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
            units: "METRIC",
          }),
        },
      );

      const route = result.routes?.[0];
      if (
        typeof route?.distanceMeters !== "number" ||
        !Number.isFinite(route.distanceMeters) ||
        route.distanceMeters < 0
      ) {
        throw new Error("Invalid route response");
      }

      const distanceM = route.distanceMeters;
      const durationS = parseDuration(route.duration);
      const now = new Date();

      await db
        .insertInto("routeDistanceCache")
        .values({
          restaurantId,
          originLatE4,
          originLngE4,
          destLatE4,
          destLngE4,
          distanceM,
          durationS,
          createdAt: now,
        })
        .onConflict((conflict) =>
          conflict
            .columns([
              "restaurantId",
              "originLatE4",
              "originLngE4",
              "destLatE4",
              "destLngE4",
            ])
            .doUpdateSet({ distanceM, durationS, createdAt: now }),
        )
        .execute();

      return { distanceM, durationS };
    } catch (error) {
      logFailure("road distance", error);
      return null;
    }
  },

  async autocomplete(
    input: string,
    sessionToken: string,
  ): Promise<
    { placeId: string; primaryText: string; secondaryText: string }[]
  > {
    const key = configuredKey();
    if (!key) {
      console.error("Google Maps autocomplete unavailable: key not configured");
      throw new HttpError(503, "Address search is not available right now");
    }

    try {
      const result = await googleRequest<{
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }[];
      }>(
        "autocomplete",
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
          },
          body: JSON.stringify({
            input,
            sessionToken,
            includedRegionCodes: ["in"],
            languageCode: "en",
            locationRestriction: {
              rectangle: {
                low: { latitude: 28.7, longitude: 77.55 },
                high: { latitude: 31.5, longitude: 81.05 },
              },
            },
          }),
        },
      );

      if (result.suggestions !== undefined && !Array.isArray(result.suggestions)) {
        throw new Error("Invalid autocomplete response");
      }

      return (result.suggestions ?? [])
        .flatMap((suggestion) => {
          const prediction = suggestion.placePrediction;
          const placeId = prediction?.placeId;
          const primaryText = prediction?.structuredFormat?.mainText?.text;
          if (!placeId || !primaryText) return [];
          return [{
            placeId,
            primaryText,
            secondaryText:
              prediction.structuredFormat?.secondaryText?.text ?? "",
          }];
        })
        .slice(0, 5);
    } catch (error) {
      logFailure("autocomplete", error);
      throw new HttpError(502, "Address search is temporarily unavailable");
    }
  },

  async placeDetails(
    placeId: string,
    sessionToken: string,
  ): Promise<PlaceDetails> {
    const key = configuredKey();
    if (!key) {
      console.error("Google Maps place details unavailable: key not configured");
      throw new HttpError(503, "Address search is not available right now");
    }

    try {
      const result = await googleRequest<{
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        addressComponents?: AddressComponent[];
      }>(
        "place details",
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "location,formattedAddress,addressComponents",
          },
        },
      );

      const lat = result.location?.latitude;
      const lng = result.location?.longitude;
      if (
        typeof lat !== "number" ||
        !Number.isFinite(lat) ||
        typeof lng !== "number" ||
        !Number.isFinite(lng) ||
        !result.formattedAddress
      ) {
        throw new Error("Invalid place details response");
      }

      return {
        lat,
        lng,
        formattedAddress: result.formattedAddress,
        town: townFromComponents(result.addressComponents, true),
      };
    } catch (error) {
      logFailure("place details", error);
      throw new HttpError(502, "Address details are temporarily unavailable");
    }
  },

  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<{ formattedAddress: string; town: string | null } | null> {
    const key = configuredKey();
    if (!key) {
      console.error("Google Maps reverse geocode unavailable: key not configured");
      return null;
    }

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${lat},${lng}`);
      url.searchParams.set("key", key);
      url.searchParams.set("region", "in");
      url.searchParams.set("language", "en");

      const result = await googleRequest<{
        status?: string;
        results?: {
          formatted_address?: string;
          address_components?: {
            long_name?: string;
            types?: string[];
          }[];
        }[];
      }>("reverse geocode", url.toString(), { method: "GET" });

      if (result.status !== "OK" || !result.results?.[0]?.formatted_address) {
        console.error(
          "Google Maps reverse geocode returned no usable address",
          result.status ?? "Missing status",
        );
        return null;
      }

      const first = result.results[0];
      const locality = first.address_components?.find((component) =>
        component.types?.includes("locality"),
      )?.long_name;

      return {
        formattedAddress: first.formatted_address!,
        town: locality ?? null,
      };
    } catch (error) {
      logFailure("reverse geocode", error);
      return null;
    }
  },
};