import superjson from "superjson";
import { publish } from "@floot/realtime";
import { db } from "../../helpers/db";
import { channels } from "../../helpers/realtimeChannels";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./rate_order_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const restaurantId = await db.transaction().execute(async (trx) => {
      const order = await trx.selectFrom("orders")
        .select(["customerUserId", "restaurantId", "status"])
        .where("id", "=", input.orderId)
        .forUpdate()
        .executeTakeFirst();
      if (!order || order.customerUserId !== user.id) {
        throw new HttpError(404, "Order not found");
      }
      if (order.status !== "delivered") {
        throw new HttpError(409, "You can rate an order after delivery");
      }

      const existing = await trx.selectFrom("orderRatings")
        .select("id")
        .where("orderId", "=", input.orderId)
        .executeTakeFirst();
      if (existing) throw new HttpError(409, "You have already rated this order");

      await trx.insertInto("orderRatings")
        .values({
          orderId: input.orderId,
          restaurantId: order.restaurantId,
          customerUserId: user.id,
          rating: input.rating,
          comment: input.comment || null,
        })
        .execute();

      await trx.updateTable("restaurants")
        .set((expression) => ({
          ratingCount: expression("ratingCount", "+", 1),
          ratingSum: expression("ratingSum", "+", input.rating),
        }))
        .where("id", "=", order.restaurantId)
        .executeTakeFirstOrThrow();

      return order.restaurantId;
    });

    try {
      await publish(channels.restaurant(restaurantId), { type: "rating" });
    } catch (error) {
      console.error("Could not publish restaurant rating:", error);
    }
    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}