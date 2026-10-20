import { getUrl } from "@floot/storage";
import { db } from "../../helpers/db";
import { foodComplaints } from "../../helpers/foodComplaints";
import { requireRole } from "../../helpers/requireRole";
import {
  schema,
  type ComplaintView,
  type OutputType,
} from "./complaints_GET.schema";

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const url = new URL(request.url);
    const input = schema.parse({
      status: url.searchParams.get("status") ?? undefined,
    });

    const settings = await db.selectFrom("appSettings")
      .select([
        "foodComplaintRefundLimit",
        "foodComplaintRefundBps",
        "foodComplaintWindowHours",
      ])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();

    let query = db.selectFrom("foodComplaints")
      .innerJoin("orders", "orders.id", "foodComplaints.orderId")
      .innerJoin("restaurants", "restaurants.id", "foodComplaints.restaurantId")
      .innerJoin("users", "users.id", "foodComplaints.customerUserId")
      .select([
        "foodComplaints.id",
        "foodComplaints.orderId",
        "foodComplaints.status",
        "foodComplaints.reason",
        "foodComplaints.description",
        "foodComplaints.imageFiles",
        "foodComplaints.refundAmount",
        "foodComplaints.refundStatus",
        "foodComplaints.refundMethod",
        "foodComplaints.refundError",
        "foodComplaints.razorpayRefundId",
        "foodComplaints.adminNote",
        "foodComplaints.createdAt",
        "foodComplaints.reviewedAt",
        "orders.itemsTotal",
        "orders.total",
        "orders.paymentMethod",
        "orders.deliveredAt",
        "restaurants.id as restaurantId",
        "restaurants.name as restaurantName",
        "users.id as customerId",
        "users.displayName as customerName",
        "users.email as customerEmail",
      ]);

    if (input.status === "pending") {
      query = query.where("foodComplaints.status", "=", "pending");
    }

    const rows = await query
      .orderBy((expression) => expression
        .case()
        .when("foodComplaints.status", "=", "pending")
        .then(0)
        .else(1)
        .end())
      .orderBy("foodComplaints.createdAt", "desc")
      .limit(100)
      .execute();

    const complaintIds = rows.map((row) => row.orderId);
    const customerIds = [...new Set(rows.map((row) => row.customerId))];

    const [items, counts] = await Promise.all([
      complaintIds.length
        ? db.selectFrom("orderItems")
            .select(["orderId", "name", "quantity", "price"])
            .where("orderId", "in", complaintIds)
            .execute()
        : [],
      customerIds.length
        ? db.selectFrom("foodComplaints")
            .select([
              "customerUserId",
              db.fn.count<number>("id").as("count"),
            ])
            .where("customerUserId", "in", customerIds)
            .where("status", "in", ["pending", "approved"])
            .groupBy("customerUserId")
            .execute()
        : [],
    ]);

    const itemsByOrder = new Map<number, ComplaintView["order"]["items"]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push({ name: item.name, qty: item.quantity, price: item.price });
      itemsByOrder.set(item.orderId, list);
    }
    const usedByCustomer = new Map(
      counts.map((row) => [row.customerUserId, Number(row.count)]),
    );

    const complaints: ComplaintView[] = await Promise.all(rows.map(async (row) => {
      const imageUrls = await Promise.all(row.imageFiles.map(async (filename) => {
        const image = await getUrl({
          visibility: "private",
          filename,
          expiresInSeconds: 3600,
        });
        if (!image.ok) {
          throw new Error(`Could not load complaint photo: ${image.error.message}`);
        }
        return image.url;
      }));
      return {
        id: row.id,
        orderId: row.orderId,
        status: row.status,
        reason: row.reason,
        description: row.description,
        imageUrls,
        refundAmount: row.status === "pending"
          ? Math.min(
              row.total,
              foodComplaints.refundAmountFor(
                row.itemsTotal,
                settings.foodComplaintRefundBps,
              ),
            )
          : row.refundAmount,
        refundStatus: row.refundStatus,
        refundMethod: row.refundMethod,
        refundError: row.refundError,
        razorpayRefundId: row.razorpayRefundId,
        adminNote: row.adminNote,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt,
        order: {
          itemsTotal: row.itemsTotal,
          total: row.total,
          paymentMethod: row.paymentMethod,
          deliveredAt: row.deliveredAt,
          items: itemsByOrder.get(row.orderId) ?? [],
        },
        restaurant: {
          id: row.restaurantId,
          name: row.restaurantName,
        },
        customer: {
          id: row.customerId,
          name: row.customerName,
          email: row.customerEmail,
          usedRefunds: usedByCustomer.get(row.customerId) ?? 0,
          limit: settings.foodComplaintRefundLimit,
        },
      };
    }));

    return requireRole.json({
      complaints,
      settings: {
        limit: settings.foodComplaintRefundLimit,
        refundBps: settings.foodComplaintRefundBps,
        windowHours: settings.foodComplaintWindowHours,
      },
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}