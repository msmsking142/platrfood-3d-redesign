import { publish } from "@floot/realtime";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { channels } from "../../helpers/realtimeChannels";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./location_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, ["rider"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const rider = await db
      .selectFrom("riders")
      .select(["id", "status"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!rider) throw new HttpError(400, "Complete your rider profile first");
    if (rider.status !== "approved") {
      throw new HttpError(400, "Your rider account is waiting for platr™ approval");
    }

    const now = new Date();
    await db
      .updateTable("riders")
      .set({
        lastLat: input.lat,
        lastLng: input.lng,
        lastLocationAt: now,
      })
      .where("id", "=", rider.id)
      .execute();

    const orders = await db
      .selectFrom("orders")
      .select(["id", "restaurantId", "status"])
      .where("riderId", "=", rider.id)
      .where("status", "in", ["accepted", "preparing", "ready", "picked_up"])
      .execute();

    await Promise.all(
      orders.flatMap((order) => {
        const targets = [channels.orderLive(order.id)];
        if (order.status !== "picked_up") {
          targets.push(channels.restaurantLive(order.restaurantId));
        }
        return targets.map(async (channel) => {
          try {
            await publish(channel, {
              type: "rider_location",
              orderId: order.id,
              riderId: rider.id,
              lat: input.lat,
              lng: input.lng,
              accuracy: input.accuracy,
              at: now.toISOString(),
            });
          } catch (error) {
            console.error("Failed to publish rider location", {
              orderId: order.id,
              channel,
              error,
            });
          }
        });
      })
    );

    return requireRole.json({
      ok: true,
      sharedWith: orders.length,
    } satisfies OutputType);
  } catch (error) {
    console.error("Rider location update failed", error);
    return requireRole.errorResponse(error);
  }
}