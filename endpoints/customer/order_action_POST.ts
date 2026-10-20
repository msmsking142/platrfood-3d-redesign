import superjson from "superjson";
import { db } from "../../helpers/db";
import { createCustomerRazorpayOrder } from "../../helpers/customerRazorpayOrder";
import { orderPayments } from "../../helpers/orderPayments";
import { notifyZipto } from "../../helpers/notifyZipto";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./order_action_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse(await request.text()));

    if (input.action === "cancel") {
      const cancelled = await db
        .updateTable("orders")
        .set({
          status: "cancelled",
          cancelReason: "Cancelled by customer",
          updatedAt: new Date(),
        })
        .where("id", "=", input.orderId)
        .where("customerUserId", "=", user.id)
        .where("status", "=", "placed")
        .returning("id")
        .executeTakeFirst();

      if (!cancelled) {
        const order = await db
          .selectFrom("orders")
          .select("id")
          .where("id", "=", input.orderId)
          .where("customerUserId", "=", user.id)
          .executeTakeFirst();
        throw new HttpError(
          order ? 400 : 404,
          order
            ? "Order can only be cancelled before the restaurant accepts it"
            : "Order not found",
        );
      }

      await notifyZipto(cancelled.id);
      try {
        await orderPayments.refundIfPaid(cancelled.id, "Cancelled by customer");
      } catch (error) {
        console.error(`Automatic refund failed for order ${cancelled.id}:`, error);
        throw new HttpError(
          502,
          "Order cancelled. Refund could not start automatically – platr™ will refund you within 5-7 working days.",
        );
      }
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    const payment = await db.transaction().execute(async (transaction) => {
      const order = await transaction
        .selectFrom("orders")
        .select([
          "id",
          "customerUserId",
          "paymentMethod",
          "paymentStatus",
          "status",
          "total",
          "deliveryPhone",
        ])
        .where("id", "=", input.orderId)
        .forUpdate()
        .executeTakeFirst();

      if (!order || order.customerUserId !== user.id) {
        throw new HttpError(404, "Order not found");
      }
      if (
        order.paymentMethod !== "upi" ||
        order.paymentStatus !== "pending" ||
        order.status !== "placed"
      ) {
        throw new HttpError(409, "This order is no longer eligible for online payment");
      }

      const receipt = `zipto-order-${order.id}-r${Date.now() % 100000}`;
      const nextPayment = await createCustomerRazorpayOrder(
        order.id,
        order.total,
        receipt,
        {
          name: user.displayName,
          email: user.email,
          contact: order.deliveryPhone,
        },
      );

      const updated = await transaction
        .updateTable("orders")
        .set({
          razorpayOrderId: nextPayment.razorpayOrderId,
          updatedAt: new Date(),
        })
        .where("id", "=", order.id)
        .where("status", "=", "placed")
        .where("paymentStatus", "=", "pending")
        .returning("id")
        .executeTakeFirst();

      if (!updated) {
        throw new HttpError(409, "This order is no longer eligible for online payment");
      }
      return nextPayment;
    });

    return requireRole.json({ ok: true, payment } satisfies OutputType);
  } catch (error) {
    console.error("Customer order action failed:", error);
    return requireRole.errorResponse(error);
  }
}