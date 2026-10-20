import { db } from "./db";
import { activeCallStatuses, deliveryCallStatuses } from "./callActiveStatuses";
import { HttpError } from "./requireRole";
import type { User } from "./User";
import type { InputType } from "../endpoints/call/start_POST.schema";

// BACKEND ONLY. Authorize the caller against the order and resolve the recipient.
export async function resolveCallStartParticipants(user: User, input: InputType) {
  if (!["user", "restaurant", "rider"].includes(user.role)) {
    throw new HttpError(403, "You don't have access to this");
  }

  const order = await db
    .selectFrom("orders")
    .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
    .leftJoin("riders", "riders.id", "orders.riderId")
    .select([
      "orders.id",
      "orders.status",
      "orders.riderId",
      "orders.customerUserId",
      "restaurants.ownerUserId",
      "restaurants.name as restaurantName",
      "riders.userId as riderUserId",
    ])
    .where("orders.id", "=", input.orderId)
    .executeTakeFirst();

  if (!order) throw new HttpError(404, "Order not found");

  const callerRole: "customer" | "restaurant" | "rider" =
    user.role === "user" && order.customerUserId === user.id
      ? "customer"
      : user.role === "restaurant" && order.ownerUserId === user.id
        ? "restaurant"
        : user.role === "rider" && order.riderUserId === user.id
          ? "rider"
          : (() => {
              throw new HttpError(404, "Order not found");
            })();

  if (input.target === callerRole) {
    throw new HttpError(400, "You can't call yourself");
  }

  const involvesRider = callerRole === "rider" || input.target === "rider";
  if (involvesRider && order.riderId === null) {
    throw new HttpError(400, "No rider assigned yet");
  }
  if (
    !(involvesRider ? deliveryCallStatuses : activeCallStatuses).includes(
      order.status
    )
  ) {
    throw new HttpError(
      400,
      "Calling is only available while the order is active"
    );
  }

  const attempts = await db
    .selectFrom("calls")
    .select(({ fn }) => fn.count<number>("id").as("count"))
    .where("callerUserId", "=", user.id)
    .where("createdAt", ">=", new Date(Date.now() - 10 * 60 * 1000))
    .executeTakeFirstOrThrow();

  if (Number(attempts.count) >= 6) {
    throw new HttpError(
      429,
      "Too many call attempts. Please wait a few minutes."
    );
  }

  const calleeUserId =
    input.target === "customer"
      ? order.customerUserId
      : input.target === "restaurant"
        ? order.ownerUserId
        : order.riderUserId;

  if (calleeUserId === null) {
    throw new HttpError(410, "This person is no longer available on platr™");
  }

  const callee = await db
    .selectFrom("users")
    .select(["displayName", "allowRestaurantCalls"])
    .where("id", "=", calleeUserId)
    .where("deletedAt", "is", null)
    .executeTakeFirst();

  if (!callee) {
    throw new HttpError(410, "This person is no longer available on platr™");
  }
  if (
    callerRole === "restaurant" &&
    input.target === "customer" &&
    !callee.allowRestaurantCalls
  ) {
    throw new HttpError(403, "Customer has not allowed restaurant calls");
  }

  const firstName = callee.displayName.trim().split(/\s+/)[0];
  const callerFirstName = user.displayName.trim().split(/\s+/)[0];

  return {
    calleeUserId,
    calleeName:
      input.target === "restaurant"
        ? order.restaurantName
        : input.target === "rider"
          ? firstName || "Rider"
          : callerRole === "restaurant"
            ? "Customer"
            : firstName || "Customer",
    callerName:
      callerRole === "restaurant"
        ? order.restaurantName
        : callerRole === "rider"
          ? callerFirstName || "Rider"
          : input.target === "restaurant"
            ? "Customer"
            : callerFirstName || "Customer",
    callerRole,
  };
}