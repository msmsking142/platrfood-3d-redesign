import superjson from "superjson";
import { db } from "../../helpers/db";
import { HttpError, requireRole } from "../../helpers/requireRole";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { schema, type OutputType } from "./pro_order_POST.schema";
import { z } from "zod";

const razorpayOrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
});

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    schema.parse(superjson.parse(await request.text()));

    const restaurant = await db
      .selectFrom("restaurants")
      .select(["id", "name", "phone"])
      .where("ownerUserId", "=", user.id)
      .executeTakeFirst();

    if (!restaurant) {
      throw new HttpError(400, "Complete your restaurant profile first");
    }

    const awaitingActivation = await db
      .selectFrom("subscriptionPayments")
      .select("id")
      .where("restaurantId", "=", restaurant.id)
      .where("status", "=", "paid")
      .where("periodStart", "is", null)
      .executeTakeFirst();

    if (awaitingActivation) {
      throw new HttpError(
        409,
        "Your Pro payment is already received and waiting for activation. You don't need to pay again.",
      );
    }

    const settings = await db
      .selectFrom("appSettings")
      .select(["proMonthlyFee", "commissionGstBps"])
      .orderBy("id", "asc")
      .executeTakeFirst();

    const baseAmount = settings?.proMonthlyFee ?? 2499;
    const gstBps = settings?.commissionGstBps ?? 1800;
    const gstAmount = Math.round(baseAmount * gstBps / 10000);
    const total = baseAmount + gstAmount;
    const amount = total * 100;
    if (
      !Number.isSafeInteger(baseAmount) || baseAmount <= 0 ||
      !Number.isSafeInteger(gstBps) || gstBps < 0 ||
      !Number.isSafeInteger(gstAmount) ||
      !Number.isSafeInteger(total) ||
      !Number.isSafeInteger(amount) || amount <= 0
    ) {
      throw new HttpError(500, "The Pro plan fee or GST rate is not configured correctly");
    }

    const credentials = getRazorpayCredentials();
    const receipt = `zipto-pro-${restaurant.id}-${Date.now()}`;
    if (receipt.length > 40) {
      throw new HttpError(500, "Could not generate a valid payment receipt");
    }

    const response = await razorpayRequest(
      "/orders",
      credentials,
      "POST",
      {
        amount,
        currency: "INR",
        receipt,
        notes: {
          restaurantId: String(restaurant.id),
          purpose: "zipto_pro_plan",
          baseAmount: String(baseAmount),
          gstAmount: String(gstAmount),
        },
      },
    );

    const parsed = razorpayOrderSchema.safeParse(response);
    if (
      !parsed.success ||
      parsed.data.amount !== amount ||
      parsed.data.currency !== "INR"
    ) {
      throw new HttpError(502, "Razorpay returned an invalid order");
    }

    await db.insertInto("subscriptionPayments").values({
      restaurantId: restaurant.id,
      razorpayOrderId: parsed.data.id,
      amount: total,
      baseAmount,
      gstAmount,
      status: "created",
    }).execute();

    return requireRole.json({
      orderId: parsed.data.id,
      amount: parsed.data.amount,
      baseAmount,
      gstAmount,
      gstPercent: gstBps / 100,
      currency: parsed.data.currency,
      keyId: credentials.keyId,
      restaurantName: restaurant.name,
      prefill: {
        name: user.displayName,
        email: user.email,
        contact: restaurant.phone,
      },
    } satisfies OutputType);
  } catch (error) {
    console.error("Restaurant Pro order failed:", error);
    return requireRole.errorResponse(
      error instanceof HttpError || error instanceof z.ZodError
        ? error
        : new HttpError(500, "Could not create the Pro payment order"),
    );
  }
}