import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { OrderView } from "./orderView";
import { ziptoSound } from "./ziptoSound";

export function useCustomerOrderAlerts(
  orders: OrderView[] | undefined,
): void {
  const previousStatuses = useRef<Map<number, OrderView["status"]> | null>(
    null,
  );

  useEffect(() => {
    if (orders === undefined) return;

    const next = new Map(
      orders.map((order) => [order.id, order.status] as const),
    );
    const previous = previousStatuses.current;
    previousStatuses.current = next;

    // The first resolved list establishes a baseline, not an alert.
    if (previous === null) return;

    for (const order of orders) {
      const oldStatus = previous.get(order.id);
      if (oldStatus === undefined || oldStatus === order.status) continue;

      let kind: "good" | "bad";

      switch (order.status) {
        case "accepted":
          toast.success("Restaurant ne order accept kar liya 🎉");
          notifyCustomerOrder(order.id, "Order accepted", "The restaurant has accepted your platr™ order.");
          kind = "good";
          break;
        case "picked_up":
          toast.success("Rider on the way 🛵");
          notifyCustomerOrder(order.id, "Rider is on the way", "Your platr™ order has been picked up for delivery.");
          kind = "good";
          break;
        case "delivered":
          toast.success("Order delivered! Enjoy your meal 😋");
          notifyCustomerOrder(order.id, "Order delivered", "Your platr™ order has been delivered. Enjoy your meal!");
          kind = "good";
          break;
        case "cancelled":
        case "rejected":
          toast.error(
            `Order #${order.id} was ${
              order.status === "cancelled" ? "cancelled" : "rejected"
            }`,
          );
          notifyCustomerOrder(order.id, "Order update", `Your platr™ order #${order.id} was ${order.status}.`);
          kind = "bad";
          break;
        default:
          continue;
      }

      ziptoSound.playStatusChime(kind);
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [orders]);
}

function notifyCustomerOrder(orderId: number, title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: `zipto-customer-order-${orderId}` });
  } catch (error) {
    console.error("Could not show customer order notification:", error);
  }
}