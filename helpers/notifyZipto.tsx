// BACKEND ONLY. Fire realtime "something changed" signals so screens refetch.
import { publish } from "@floot/realtime";
import { channels } from "./realtimeChannels";
import { db } from "./db";
import { orderEmails } from "./orderEmails";
import { endOrderCalls } from "./endOrderCalls";

export async function notifyZipto(orderId: number) {
  const order = await db
    .selectFrom("orders")
    .select(["id", "customerUserId", "restaurantId", "riderId", "town", "status"])
    .where("id", "=", orderId)
    .executeTakeFirst();
  if (!order) return;
  if (["delivered", "cancelled", "rejected"].includes(order.status)) {
    try {
      await endOrderCalls(order.id);
    } catch (error) {
      console.error(`Could not end calls for order ${order.id}:`, error);
    }
  }
  const msg = { type: "order", orderId: order.id, status: order.status };
  const targets = [
    channels.customer(order.customerUserId),
    channels.restaurant(order.restaurantId),
    channels.ridersTown(order.town),
    channels.admin(),
  ];
  if (order.riderId) targets.push(channels.rider(order.riderId));
  await Promise.all(
    targets.map((c) =>
      publish(c, msg).catch((e: unknown) => console.error("publish failed", c, e))
    )
  );
  try {
    await orderEmails.sendForOrder(orderId);
  } catch (error) {
    console.error(`Could not send order emails for order ${orderId}:`, error);
  }
}