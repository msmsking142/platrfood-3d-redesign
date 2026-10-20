import superjson from "superjson";
import { db } from "../../helpers/db";
import { deliveryPricing } from "../../helpers/deliveryPricing";
import { proSubscription } from "../../helpers/proSubscription";
import { pricingSettings } from "../../helpers/pricingSettings";
import { resolveDeliveryDistance } from "../../helpers/resolveDeliveryDistance";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type CustomerQuote } from "./quote_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const input = schema.parse(superjson.parse(await request.text()));

    const restaurant = await db
      .selectFrom("restaurants")
.select(["id", "town", "plan", "proPaidUntil", "lat", "lng"])
      .where("id", "=", input.restaurantId)
      .where("status", "=", "approved")
      .executeTakeFirst();

    if (!restaurant) {
      throw new HttpError(404, "Restaurant not found");
    }

    const menuItems = await db
      .selectFrom("menuItems")
      .select(["id", "price"])
      .where("restaurantId", "=", restaurant.id)
      .where("isAvailable", "=", true)
      .where("id", "in", input.items.map((item) => item.menuItemId))
      .execute();

    const pricesById = new Map(menuItems.map((item) => [item.id, item.price]));
    const itemsTotal = input.items.reduce((total, item) => {
      const price = pricesById.get(item.menuItemId);
      if (price === undefined) {
        throw new HttpError(400, "Some items are no longer available");
      }
      return total + price * item.quantity;
    }, 0);

    const { settings, areaActive } = await pricingSettings.load(restaurant.town);
    const availability = await deliveryProtection.availability(restaurant.town);
    const { distanceM, source: distanceSource } =
      await resolveDeliveryDistance({
        restaurantId: restaurant.id,
        restaurantLat: restaurant.lat,
        restaurantLng: restaurant.lng,
        customerLat: input.deliveryLat,
        customerLng: input.deliveryLng,
        settings,
      });

    const quotedAt = new Date();
    const quote = deliveryPricing.quote({
      itemsTotal,
      plan: proSubscription.effectivePlan(restaurant.plan, restaurant.proPaidUntil),
      distanceM,
      distanceSource,
      paymentMethod: input.paymentMethod,
      at: quotedAt,
      settings,
    });

    return requireRole.json({
      itemsTotal: quote.itemsTotal,
      total: quote.total,
      lineItems: quote.lineItems,
      distanceM: quote.distanceM,
      distanceSource: quote.distanceSource,
      outOfRange: quote.outOfRange,
      maxDeliveryKm: settings.maxDeliveryM / 1000,
      serviceAvailable: areaActive && availability.available,
      unavailableReason: availability.reason,
      platformFee: quote.platformFee,
      quotedAt,
    } satisfies CustomerQuote);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}