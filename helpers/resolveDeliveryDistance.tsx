// BACKEND ONLY. Do not import this helper into client-side code.
import {
  deliveryPricing,
  type DistanceSource,
  type PricingSettings,
} from "./deliveryPricing";
import { googleMaps } from "./googleMaps";

export async function resolveDeliveryDistance(args: {
  restaurantId: number;
  restaurantLat: number | null;
  restaurantLng: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
  settings: PricingSettings;
}): Promise<{ distanceM: number; source: DistanceSource; road: boolean }> {
  const {
    restaurantId,
    restaurantLat,
    restaurantLng,
    customerLat,
    customerLng,
    settings,
  } = args;

  if (
    restaurantLat != null &&
    restaurantLng != null &&
    customerLat != null &&
    customerLng != null &&
    googleMaps.isConfigured()
  ) {
    try {
      const result = await googleMaps.roadDistance({
        restaurantId,
        originLat: restaurantLat,
        originLng: restaurantLng,
        destLat: customerLat,
        destLng: customerLng,
      });

      if (result) {
        return { distanceM: result.distanceM, source: "gps", road: true };
      }
    } catch (error) {
      console.error("Could not resolve road delivery distance:", error);
    }
  }

  const fallback = deliveryPricing.resolveDistance(
    { restaurantLat, restaurantLng, customerLat, customerLng },
    settings,
  );
  return { ...fallback, road: false };
}