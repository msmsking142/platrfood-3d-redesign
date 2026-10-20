// BACKEND ONLY. Shared order listing with items, restaurant, rider and customer.
import { db } from "./db";
import type { OrderView } from "./orderView";

type Filter =
  | { customerUserId: number }
  | { restaurantId: number }
  | { riderId: number }
  | { availableInTown: string }
  | { all: true };

export async function orderQueries(filter: Filter, limit = 50): Promise<OrderView[]> {
  let q = db
    .selectFrom("orders")
    .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
    .innerJoin("users as customer", "customer.id", "orders.customerUserId")
    .leftJoin("riders", "riders.id", "orders.riderId")
    .leftJoin("users as riderUser", "riderUser.id", "riders.userId")
    .select([
      "orders.id",
      "orders.customerUserId",
      "orders.status",
      "orders.town",
      "orders.deliveryAddress",
      "orders.deliveryPhone",
      "orders.recipientName",
      "orders.deliveryLat",
      "orders.deliveryLng",
      "customer.allowRestaurantCalls as customerAllowsCalls",
      "orders.notes",
      "orders.itemsTotal",
      "orders.distanceM",
      "orders.distanceSource",
      "orders.deliveryBaseFee",
      "orders.deliveryDistanceFee",
      "orders.peakFee",
      "orders.surgeFee",
      "orders.smallOrderFee",
      "orders.deliveryTax",
      "orders.foodTax",
      "orders.ziptoDiscount",
      "orders.restaurantDiscount",
      "orders.commissionTax",
      "orders.restaurantWithholding",
      "orders.riderBasePay",
      "orders.riderDistancePay",
      "orders.deliveryFee",
      "orders.platformFee",
      "orders.total",
      "orders.restaurantPlan",
      "orders.commissionPercent",
      "orders.commissionAmount",
      "orders.restaurantPayout",
      "orders.riderBonus",
      "orders.riderPayout",
      "orders.paymentMethod",
      "orders.paymentStatus",
      "orders.upiReference",
      "orders.cancelReason",
      "orders.restaurantAcceptedAt",
      "orders.preparingAt",
      "orders.readyAt",
      "orders.riderAssignedAt",
      "orders.riderSearchStage",
      "orders.riderSearchRadiusM",
      "orders.riderSearchDeadlineAt",
      "orders.riderSearchIncentive",
      "orders.deliveryAtRiskAt",
      "orders.cancelCode",
      "orders.noRiderCancelledAt",
      "orders.createdAt",
      "orders.deliveredAt",
      "orders.riderId",
      "restaurants.id as restaurantId",
      "restaurants.name as restaurantName",
      "restaurants.address as restaurantAddress",
      "restaurants.phone as restaurantPhone",
      "restaurants.lat as restaurantLat",
      "restaurants.lng as restaurantLng",
      "customer.displayName as customerName",
      "riderUser.displayName as riderName",
      "riders.phone as riderPhone",
      "riders.vehicleType as riderVehicleType",
      "riders.lastLat as riderLat",
      "riders.lastLng as riderLng",
      "riders.lastLocationAt as riderLocationAt",
    ]);
  if ("customerUserId" in filter) q = q.where("orders.customerUserId", "=", filter.customerUserId);
  if ("restaurantId" in filter) q = q.where("orders.restaurantId", "=", filter.restaurantId);
  if ("riderId" in filter) q = q.where("orders.riderId", "=", filter.riderId);
  if ("availableInTown" in filter)
    q = q
      .where("orders.town", "=", filter.availableInTown)
      .where("orders.riderId", "is", null)
      .where("orders.status", "in", ["accepted", "preparing", "ready"])
      .where((eb) => eb.or([
        eb("orders.paymentMethod", "!=", "upi"),
        eb("orders.paymentStatus", "!=", "pending"),
      ]));
  const orders = await q.orderBy("orders.createdAt", "desc").limit(limit).execute();
  if (orders.length === 0) return [];
  const items = await db
    .selectFrom("orderItems")
    .select(["orderId", "name", "price", "quantity"])
    .where("orderId", "in", orders.map((o) => o.id))
    .execute();
  return orders.map((o) => ({
    ...o,
    items: items.filter((i) => i.orderId === o.id).map(({ orderId, ...rest }) => rest),
  }));
}