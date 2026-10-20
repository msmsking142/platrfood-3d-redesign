import superjson from "superjson";
import { db } from "../../helpers/db";
import { liveOrderRoute } from "../../helpers/liveOrderRoute";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./order_route_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const order = await db
      .selectFrom("orders")
      .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
      .leftJoin("riders", "riders.id", "orders.riderId")
      .select([
        "orders.customerUserId",
        "orders.status",
        "orders.riderId",
        "orders.deliveryLat",
        "orders.deliveryLng",
        "restaurants.lat as restaurantLat",
        "restaurants.lng as restaurantLng",
        "riders.lastLat as riderLat",
        "riders.lastLng as riderLng",
        "riders.lastLocationAt as riderLocationAt",
      ])
      .where("orders.id", "=", input.orderId)
      .executeTakeFirst();

    if (!order || (user.role !== "admin" && order.customerUserId !== user.id)) {
      throw new HttpError(404, "Order not found");
    }

    if (
      !["accepted", "preparing", "ready", "picked_up"].includes(order.status)
    ) {
      return requireRole.json({
        route: null,
        reason: "not_tracking",
      } satisfies OutputType);
    }

    if (order.riderId === null) {
      return requireRole.json({
        route: null,
        reason: "no_rider",
      } satisfies OutputType);
    }

    if (
      order.riderLat === null ||
      order.riderLng === null ||
      order.riderLocationAt === null
    ) {
      return requireRole.json({
        route: null,
        reason: "no_location",
      } satisfies OutputType);
    }

    const route = await liveOrderRoute.get({
      orderId: input.orderId,
      status: order.status,
      rider: {
        lat: order.riderLat,
        lng: order.riderLng,
        at: order.riderLocationAt,
      },
      restaurant:
        order.restaurantLat !== null && order.restaurantLng !== null
          ? { lat: order.restaurantLat, lng: order.restaurantLng }
          : null,
      destination:
        order.deliveryLat !== null && order.deliveryLng !== null
          ? { lat: order.deliveryLat, lng: order.deliveryLng }
          : null,
    });

    return requireRole.json({ route, reason: null } satisfies OutputType);
  } catch (error) {
    console.error(
      "Customer live route request failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return requireRole.errorResponse(error);
  }
}