import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { orderQueries } from "../../helpers/orderQueries";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { OutputType } from "./orders_GET.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    try {
      await deliveryProtection.sweep({ customerUserId: user.id });
    } catch (error) {
      console.error(`No-rider sweep failed for customer ${user.id}:`, error);
    }
    const orders = await orderQueries({ customerUserId: user.id }, 30);
    const orderIds = orders.map((order) => order.id);

    const [settings, count, ratings, complaints] = await Promise.all([
      db.selectFrom("appSettings")
        .select(["foodComplaintRefundLimit", "foodComplaintWindowHours"])
        .where("id", "=", 1)
        .executeTakeFirstOrThrow(),
      db.selectFrom("foodComplaints")
        .select(db.fn.count<number>("id").as("used"))
        .where("customerUserId", "=", user.id)
        .where("status", "in", ["pending", "approved"])
        .executeTakeFirstOrThrow(),
      orderIds.length
        ? db.selectFrom("orderRatings")
          .select(["orderId", "rating", "comment"])
          .where("customerUserId", "=", user.id)
          .where("orderId", "in", orderIds)
          .execute()
        : Promise.resolve([]),
      orderIds.length
        ? db.selectFrom("foodComplaints")
          .select([
            "orderId", "id", "status", "reason", "refundAmount",
            "refundStatus", "refundMethod", "adminNote", "createdAt",
          ])
          .where("customerUserId", "=", user.id)
          .where("orderId", "in", orderIds)
          .execute()
        : Promise.resolve([]),
    ]);

    const ratingByOrder = new Map(ratings.map(({ orderId, ...rating }) => [orderId, rating]));
    const complaintByOrder = new Map(complaints.map(({ orderId, ...complaint }) => [orderId, complaint]));
    const now = Date.now();
    const used = Number(count.used);
    const result: OutputType = {
      orders: orders.map((order) => {
        const complaint = complaintByOrder.get(order.id) ?? null;
        return {
          ...order,
          riderPhone: null,
          restaurantPhone: "",
          rating: ratingByOrder.get(order.id) ?? null,
          complaint,
          complaintEligible:
            order.status === "delivered" &&
            (order.paymentMethod === "upi" || order.paymentMethod === "wallet") &&
            order.paymentStatus === "paid" &&
            order.deliveredAt !== null &&
            now >= order.deliveredAt.getTime() &&
            now - order.deliveredAt.getTime() <= settings.foodComplaintWindowHours * 60 * 60 * 1000 &&
            complaint === null,
        };
      }),
      complaintSummary: {
        limit: settings.foodComplaintRefundLimit,
        used,
        remaining: Math.max(0, settings.foodComplaintRefundLimit - used),
        windowHours: settings.foodComplaintWindowHours,
      },
    };
    return requireRole.json(result);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}