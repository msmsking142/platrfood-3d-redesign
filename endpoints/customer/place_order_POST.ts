import superjson from "superjson";
import { publish } from "@floot/realtime";
import { db } from "../../helpers/db";
import { deliveryPricing } from "../../helpers/deliveryPricing";
import { proSubscription } from "../../helpers/proSubscription";
import { pricingSettings } from "../../helpers/pricingSettings";
import { resolveDeliveryDistance } from "../../helpers/resolveDeliveryDistance";
import { channels } from "../../helpers/realtimeChannels";
import type { Json } from "../../helpers/schema";
import { schema, type OutputType } from "./place_order_POST.schema";
import type { CustomerQuote } from "./quote_POST.schema";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { notifyZipto } from "../../helpers/notifyZipto";
import { createCustomerRazorpayOrder } from "../../helpers/customerRazorpayOrder";
import { financialLedger } from "../../helpers/financialLedger";
import { ziptoWallet } from "../../helpers/ziptoWallet";
import { deliveryProtection } from "../../helpers/deliveryProtection";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const rawInput = superjson.parse<unknown>(await request.text());
    if (
      typeof rawInput === "object" &&
      rawInput !== null &&
      "paymentMethod" in rawInput &&
      rawInput.paymentMethod === "cod"
    ) {
      throw new HttpError(
        400,
        "Cash on delivery is not available. Please pay online.",
      );
    }
    const input = schema.parse(rawInput);

    const restaurant = await db
      .selectFrom("restaurants")
      .select([
        "id",
        "town",
        "plan",
        "proPaidUntil",
        "isOpen",
        "status",
        "fssaiExpiryDate",
        "lat",
        "lng",
      ])
      .where("id", "=", input.restaurantId)
      .executeTakeFirst();

    if (!restaurant || restaurant.status !== "approved")
      throw new HttpError(404, "Restaurant not found");
    if (
      !restaurant.fssaiExpiryDate ||
      new Date(restaurant.fssaiExpiryDate) <= new Date()
    )
      throw new HttpError(
        400,
        "This restaurant’s FSSAI licence has expired or is missing. Please choose another restaurant.",
      );
    if (!restaurant.isOpen)
      throw new HttpError(400, "Restaurant is closed right now");

    const ids = input.items.map((item) => item.menuItemId);
    const menu = await db
      .selectFrom("menuItems")
      .select(["id", "name", "price", "isAvailable"])
      .where("restaurantId", "=", restaurant.id)
      .where("id", "in", ids)
      .execute();

    const byId = new Map(menu.map((item) => [item.id, item]));
    const lines = input.items.map((item) => {
      const menuItem = byId.get(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable)
        throw new HttpError(400, "Some items are no longer available");
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
      };
    });
    const itemsTotal = lines.reduce(
      (total, line) => total + line.price * line.quantity,
      0,
    );

    const ctx = await pricingSettings.load(restaurant.town);
    if (ctx.row.launchMode && user.role !== "admin")
      throw new HttpError(403, "platr™ is launching soon! Ordering opens shortly.");
    if (!ctx.areaActive)
      throw new HttpError(
        400,
        `platr™ is not delivering in ${restaurant.town} yet`,
      );

    const availability = await deliveryProtection.availability(restaurant.town);
    if (!availability.available) {
      throw new HttpError(503, availability.reason ?? "Delivery is temporarily unavailable");
    }

    // This improves the error shown at checkout; payOrder's locked balance
    // check remains authoritative when the order is created.
    const walletBalance =
      input.paymentMethod === "wallet"
        ? (
            await db
              .selectFrom("users")
              .select("walletBalance")
              .where("id", "=", user.id)
              .executeTakeFirstOrThrow()
          ).walletBalance
        : null;

    const { distanceM, source: distanceSource, road } =
      await resolveDeliveryDistance({
        restaurantId: restaurant.id,
        restaurantLat: restaurant.lat,
        restaurantLng: restaurant.lng,
        customerLat: input.deliveryLat,
        customerLng: input.deliveryLng,
        settings: ctx.settings,
      });

    const effectivePlan = proSubscription.effectivePlan(
      restaurant.plan,
      restaurant.proPaidUntil,
    );
    const quote = deliveryPricing.quote({
      itemsTotal,
      plan: effectivePlan,
      distanceM,
      distanceSource,
      paymentMethod: input.paymentMethod,
      at: new Date(),
      settings: ctx.settings,
    });

    if (quote.outOfRange)
      throw new HttpError(
        400,
        `This address is beyond the ${ctx.settings.maxDeliveryM / 1000} km delivery range for this restaurant`,
      );

    if (quote.total !== input.expectedTotal) {
      const customerQuote = {
        itemsTotal: quote.itemsTotal,
        total: quote.total,
        lineItems: quote.lineItems,
        distanceM: quote.distanceM,
        distanceSource: quote.distanceSource,
        outOfRange: quote.outOfRange,
        maxDeliveryKm: ctx.settings.maxDeliveryM / 1000,
        serviceAvailable: ctx.areaActive && availability.available,
        unavailableReason: availability.reason,
        platformFee: quote.platformFee,
        quotedAt: new Date(),
      } satisfies CustomerQuote;

      return new Response(
        superjson.stringify({
          error:
            "The price changed before payment: platr™ pricing was updated (e.g. distance, peak-time or menu price). Please review and confirm the new total.",
          code: "PRICE_CHANGED",
          quote: customerQuote,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (walletBalance !== null && walletBalance < quote.total) {
      throw new HttpError(400, "Wallet balance is too low. Please add money.");
    }

    const pricingSnapshot = JSON.parse(
      JSON.stringify({
        lineItems: quote.lineItems,
        restaurantSettlement: quote.restaurantSettlement,
        rider: quote.rider,
        economics: quote.economics,
        distanceRoad: road,
        settingsUpdatedAt: ctx.row.updatedAt,
      }),
    ) as Json;

    const orderId = await db.transaction().execute(async (trx) => {
      const order = await trx
        .insertInto("orders")
        .values({
          customerUserId: user.id,
          restaurantId: restaurant.id,
          town: restaurant.town,
          deliveryAddress: input.deliveryAddress,
          deliveryPhone: input.deliveryPhone,
          recipientName: input.orderFor === "other" ? input.recipientName : null,
          notes: input.notes || null,
          itemsTotal: quote.itemsTotal,
          deliveryFee: quote.deliveryFee,
          platformFee: quote.platformFee,
          total: quote.total,
          restaurantPlan: effectivePlan,
          commissionPercent: quote.restaurantSettlement.commissionPercent,
          commissionAmount: quote.restaurantSettlement.commissionAmount,
          restaurantPayout: quote.restaurantSettlement.net,
          riderBonus: quote.rider.incentive,
          riderPayout: quote.rider.total,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === "wallet" ? "paid" : "pending",
          distanceM: quote.distanceM,
          distanceSource: quote.distanceSource,
          deliveryLat: input.deliveryLat ?? null,
          deliveryLng: input.deliveryLng ?? null,
          deliveryBaseFee: quote.deliveryBaseFee,
          deliveryDistanceFee: quote.deliveryDistanceFee,
          peakFee: quote.peakFee,
          surgeFee: quote.surgeFee,
          smallOrderFee: quote.smallOrderFee,
          deliveryTax: quote.deliveryTax,
          foodTax: quote.foodTax,
          ziptoDiscount: quote.ziptoDiscount,
          restaurantDiscount: quote.restaurantDiscount,
          commissionTax: quote.restaurantSettlement.commissionTax,
          restaurantWithholding: quote.restaurantSettlement.withholding,
          riderBasePay: quote.rider.basePay,
          riderDistancePay: quote.rider.distancePay,
          gatewayFeeEstimate:
            input.paymentMethod === "wallet"
              ? 0
              : quote.economics.gatewayFeeEstimate,
          deliveryOpsCost: quote.economics.deliveryOpsCost,
          ziptoDeliverySubsidy: quote.economics.ziptoDeliverySubsidy,
          contribution: quote.economics.contribution,
          economicsFlag: quote.economics.economicsFlag,
          pricingSnapshot,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("orderItems")
        .values(lines.map((line) => ({ ...line, orderId: order.id })))
        .execute();

      if (input.paymentMethod === "wallet") {
        await ziptoWallet.payOrder(trx, {
          userId: user.id,
          orderId: order.id,
          amount: quote.total,
        });
      }

      return order.id;
    });

    if (quote.economics.economicsFlag) {
      try {
        await publish(channels.admin(), { type: "admin" });
      } catch (error) {
        console.error(
          `Could not publish economics alert for order ${orderId}:`,
          error,
        );
      }
    }

    if (input.paymentMethod === "upi") {
      try {
        const payment = await createCustomerRazorpayOrder(
          orderId,
          quote.total,
          `zipto-order-${orderId}`,
          {
            name: user.displayName,
            email: user.email,
            contact: input.deliveryPhone,
          },
        );

        await db
          .updateTable("orders")
          .set({
            razorpayOrderId: payment.razorpayOrderId,
            updatedAt: new Date(),
          })
          .where("id", "=", orderId)
          .where("status", "=", "placed")
          .where("paymentStatus", "=", "pending")
          .executeTakeFirstOrThrow();

        return requireRole.json({
          orderId,
          total: quote.total,
          payment,
        } satisfies OutputType);
      } catch (error) {
        console.error(
          `Could not start online payment for order ${orderId}:`,
          error,
        );
        try {
          await db
            .updateTable("orders")
            .set({
              status: "cancelled",
              cancelReason: "Online payment could not be started",
              updatedAt: new Date(),
            })
            .where("id", "=", orderId)
            .where("status", "=", "placed")
            .where("paymentStatus", "=", "pending")
            .execute();
        } catch (cancelError) {
          console.error(
            `Could not cancel order ${orderId} after payment setup failed:`,
            cancelError,
          );
        }
        throw new HttpError(
          502,
          "Online payment could not be started. Your order was not sent to the restaurant.",
        );
      }
    }

    try {
      await financialLedger.onPaymentCaptured(orderId, {});
    } catch (error) {
      console.error(
        `Could not record wallet payment for order ${orderId}:`,
        error,
      );
    }
    await ziptoWallet.publishWallet(user.id);
    await notifyZipto(orderId);
    return requireRole.json({
      orderId,
      total: quote.total,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}