import { db } from "./db";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { ziptoConfig } from "./ziptoConfig";

type EmailRow = { label: string; value: string };
type EmailContent = {
  heading: string;
  intro: string;
  rows?: EmailRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const orderEmails = {
  renderZiptoEmail({
    heading,
    intro,
    rows = [],
    ctaLabel,
    ctaUrl,
    footerNote,
  }: EmailContent): { html: string; text: string } {
    const helpLine = `Need help? ${ziptoConfig.supportUrl} · platr™, Uttarakhand`;
    const replyLine = "This is an automated message; replies go to platr™ Support.";
    const text = [
      heading,
      "",
      intro,
      ...rows.map(({ label, value }) => `${label}: ${value}`),
      ...(ctaLabel && ctaUrl ? ["", `${ctaLabel}: ${ctaUrl}`] : []),
      ...(footerNote ? ["", footerNote] : []),
      "",
      helpLine,
      replyLine,
    ].join("\n");

    const html = `
      <div style="background:#fbf6ea;padding:24px;font-family:Arial,Poppins,sans-serif;color:#17130d">
        <div style="max-width:520px;margin:0 auto;background:#fff">
          <div style="background:#ffc400;padding:20px 24px;font-size:26px;font-weight:bold">platr™</div>
          <div style="padding:24px">
            <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${escapeHtml(heading)}</h1>
            <p style="line-height:1.6">${escapeHtml(intro)}</p>
            ${rows.map(({ label, value }) => `
              <p style="line-height:1.5;margin:8px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>
            `).join("")}
            ${ctaLabel && ctaUrl ? `
              <p style="margin:24px 0"><a href="${escapeHtml(ctaUrl)}" style="background:#17130d;color:#fff;text-decoration:none;padding:12px 20px;display:inline-block">${escapeHtml(ctaLabel)}</a></p>
            ` : ""}
            ${footerNote ? `<p style="line-height:1.6">${escapeHtml(footerNote)}</p>` : ""}
          </div>
          <div style="padding:20px 24px;font-size:12px;line-height:1.6;color:#73695a">
            <p>Need help? <a href="${escapeHtml(ziptoConfig.supportUrl)}">${escapeHtml(ziptoConfig.supportUrl)}</a> · platr™, Uttarakhand</p>
            <p>${escapeHtml(replyLine)}</p>
          </div>
        </div>
      </div>`;
    return { html, text };
  },

  async sendForOrder(orderId: number): Promise<void> {
    const order = await db
      .selectFrom("orders")
      .select([
        "id", "status", "paymentMethod", "paymentStatus", "total",
        "itemsTotal", "deliveryFee", "platformFee", "foodTax", "deliveryTax",
        "deliveryAddress", "town", "cancelReason", "riderId", "restaurantId",
        "customerUserId", "createdAt",
      ])
      .where("id", "=", orderId)
      .executeTakeFirstOrThrow();

    if (order.paymentMethod === "upi" && order.paymentStatus === "pending") return;

    const [items, customer, restaurant, rider] = await Promise.all([
      db.selectFrom("orderItems")
        .select(["name", "quantity", "price"])
        .where("orderId", "=", order.id)
        .orderBy("id")
        .execute(),
      db.selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", order.customerUserId)
        .executeTakeFirstOrThrow(),
      db.selectFrom("restaurants")
        .innerJoin("users as owner", "owner.id", "restaurants.ownerUserId")
        .select([
          "restaurants.name as name",
          "restaurants.address as address",
          "owner.email as ownerEmail",
          "owner.displayName as ownerName",
        ])
        .where("restaurants.id", "=", order.restaurantId)
        .executeTakeFirstOrThrow(),
      order.riderId === null
        ? Promise.resolve(null)
        : db.selectFrom("riders")
            .innerJoin("users as riderUser", "riderUser.id", "riders.userId")
            .select([
              "riderUser.email as email",
              "riderUser.displayName as displayName",
            ])
            .where("riders.id", "=", order.riderId)
            .executeTakeFirstOrThrow(),
    ]);

    const tasks: Promise<boolean>[] = [];
    const queue = (
      to: string,
      subject: string,
      content: EmailContent,
      key: string,
      kind: string,
    ) => {
      tasks.push(sendZiptoEmail({
        to,
        subject,
        ...orderEmails.renderZiptoEmail(content),
        dedupeKey: `order:${order.id}:${key}`,
        kind,
        orderId: order.id,
      }));
    };
    const customerName = customer.displayName || "there";
    const ordersUrl = `${ziptoConfig.siteUrl}/orders`;
    const partnerUrl = `${ziptoConfig.siteUrl}/partner`;
    const riderUrl = `${ziptoConfig.siteUrl}/rider`;
    const itemRows = items.map((item) => ({
      label: `${item.quantity} × ${item.name}`,
      value: ziptoConfig.rupees(item.quantity * item.price),
    }));

    if (order.status === "placed") {
      queue(customer.email, `Order confirmed – platr™ order #${order.id}`, {
        heading: `Order #${order.id} confirmed`,
        intro: `Hi ${customerName}, your order from ${restaurant.name} is confirmed.`,
        rows: [
          { label: "Placed", value: order.createdAt.toLocaleString("en-IN") },
          ...itemRows,
          { label: "Items", value: ziptoConfig.rupees(order.itemsTotal) },
          { label: "Delivery fee", value: ziptoConfig.rupees(order.deliveryFee) },
          { label: "Platform fee", value: ziptoConfig.rupees(order.platformFee) },
          { label: "Taxes", value: ziptoConfig.rupees(order.foodTax + order.deliveryTax) },
          { label: "Total", value: ziptoConfig.rupees(order.total) },
          {
            label: "Payment",
            value: order.paymentMethod === "wallet"
              ? "platr™ Wallet"
              : order.paymentMethod === "upi" ? "Online" : "Cash on delivery",
          },
          { label: "Delivery address", value: order.deliveryAddress },
        ],
        ctaLabel: "View your order",
        ctaUrl: ordersUrl,
      }, "customer:placed", "order_customer");

      queue(restaurant.ownerEmail, `New order #${order.id} – please accept`, {
        heading: `New order #${order.id}`,
        intro: `Hi ${restaurant.ownerName || "partner"}, a new order needs your attention.`,
        rows: [...itemRows, { label: "Total food value", value: ziptoConfig.rupees(order.itemsTotal) }],
        ctaLabel: "Manage order",
        ctaUrl: partnerUrl,
      }, "restaurant:new", "order_restaurant");
    }

    if (order.status === "accepted") {
      queue(customer.email, `Restaurant accepted your order #${order.id}`, {
        heading: "Your order was accepted",
        intro: `${restaurant.name} is getting order #${order.id} ready.`,
        ctaLabel: "Track order",
        ctaUrl: ordersUrl,
      }, "customer:accepted", "order_customer");

      if (order.riderId === null) {
        const availableRiders = await db
          .selectFrom("riders")
          .innerJoin("users as riderUser", "riderUser.id", "riders.userId")
          .select(["riders.id as id", "riderUser.email as email"])
          .where("riders.town", "=", order.town)
          .where("riders.status", "=", "approved")
          .where("riders.isOnline", "=", true)
          .orderBy("riders.id")
          .limit(15)
          .execute();

        for (const candidate of availableRiders) {
          queue(candidate.email, `New delivery available in ${order.town} – order #${order.id}`, {
            heading: "New delivery available",
            intro: `Order #${order.id} is available in ${order.town}. Open the rider app to see if it is still available.`,
            rows: [
              { label: "Restaurant", value: restaurant.name },
              { label: "Pickup address", value: restaurant.address },
            ],
            ctaLabel: "View deliveries",
            ctaUrl: riderUrl,
          }, `rider_offer:${candidate.id}`, "order_rider");
        }
      }
    }

    if (order.status === "picked_up") {
      queue(customer.email, `Your order #${order.id} is on the way`, {
        heading: "Your food is on the way",
        intro: `Order #${order.id} has been picked up${rider?.displayName ? ` by ${rider.displayName.trim().split(/\s+/)[0]}` : ""}.`,
        ctaLabel: "Track order",
        ctaUrl: ordersUrl,
      }, "customer:picked_up", "order_customer");
    }

    if (order.status === "delivered") {
      queue(customer.email, `Delivered – order #${order.id}`, {
        heading: "Delivered!",
        intro: `Order #${order.id} has arrived. Enjoy your food!`,
        footerNote: "Please rate your order. Have a food problem? Report it from your orders within 24 hours.",
        ctaLabel: "Rate or report an issue",
        ctaUrl: ordersUrl,
      }, "customer:delivered", "order_customer");

      if (rider && order.riderId !== null) {
        queue(rider.email, `Delivery completed – order #${order.id}`, {
          heading: "Delivery completed",
          intro: `Thanks for delivering order #${order.id}.`,
          ctaLabel: "Open rider app",
          ctaUrl: riderUrl,
        }, `rider:delivered:${order.riderId}`, "order_rider");
      }
    }

    if (order.status === "cancelled" || order.status === "rejected") {
      const refundNote = order.paymentMethod === "wallet"
        ? "Your payment is refunded to your platr™ Wallet."
        : order.paymentMethod === "upi" && (
          order.paymentStatus === "paid" || order.paymentStatus === "refunded"
        )
          ? "Your refund will go to your original payment method; bank times vary."
          : undefined;

      queue(
        customer.email,
        order.status === "cancelled"
          ? `Order #${order.id} cancelled`
          : `Order #${order.id} was declined by the restaurant`,
        {
          heading: order.status === "cancelled" ? "Order cancelled" : "Order declined",
          intro: `Order #${order.id} ${order.status === "cancelled" ? "was cancelled" : "was declined by the restaurant"}.`,
          rows: order.cancelReason ? [{ label: "Reason", value: order.cancelReason }] : [],
          footerNote: refundNote,
          ctaLabel: "View orders",
          ctaUrl: ordersUrl,
        },
        "customer:closed",
        "order_customer",
      );

      if (order.status === "cancelled") {
        queue(restaurant.ownerEmail, `Order #${order.id} was cancelled`, {
          heading: "Order cancelled",
          intro: `Order #${order.id} was cancelled. Please do not prepare it.`,
          ctaLabel: "Manage orders",
          ctaUrl: partnerUrl,
        }, "restaurant:cancelled", "order_restaurant");
      }

      if (rider && order.riderId !== null) {
        queue(rider.email, `Order #${order.id} was cancelled – do not pick up`, {
          heading: "Order cancelled",
          intro: `Order #${order.id} is no longer active. Please do not pick it up.`,
          ctaLabel: "Open rider app",
          ctaUrl: riderUrl,
        }, `rider:cancelled:${order.riderId}`, "order_rider");
      }
    }

    if (
      rider &&
      order.riderId !== null &&
      (order.status === "accepted" || order.status === "preparing" || order.status === "ready")
    ) {
      queue(rider.email, `Order #${order.id} assigned to you`, {
        heading: "Delivery assigned",
        intro: `You have been assigned order #${order.id}.`,
        rows: [
          { label: "Restaurant", value: restaurant.name },
          { label: "Pickup address", value: restaurant.address },
          { label: "Delivery address", value: `${order.deliveryAddress}, ${order.town}` },
        ],
        ctaLabel: "View delivery",
        ctaUrl: riderUrl,
      }, `rider:assigned:${order.riderId}`, "order_rider");

      queue(restaurant.ownerEmail, `Rider assigned for order #${order.id}`, {
        heading: "Rider assigned",
        intro: `${rider.displayName || "A rider"} has been assigned to order #${order.id}.`,
        ctaLabel: "Manage order",
        ctaUrl: partnerUrl,
      }, `restaurant:rider_assigned:${order.riderId}`, "order_restaurant");
    }

    await Promise.all(tasks);
  },
};