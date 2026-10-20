import { createHmac, timingSafeEqual } from "node:crypto";
import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { proSubscription } from "../../helpers/proSubscription";
import { HttpError, requireRole } from "../../helpers/requireRole";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { schema, type OutputType } from "./pro_verify_POST.schema";

const razorpayPaymentSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
});

function signatureMatches(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const supplied = Buffer.from(signature, "hex");
  return timingSafeEqual(expected, supplied);
}

async function markFailed(paymentRowId: number): Promise<void> {
  await db
    .updateTable("subscriptionPayments")
    .set({ status: "failed" })
    .where("id", "=", paymentRowId)
    .where("status", "!=", "paid")
    .execute();
}

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const restaurant = await db
      .selectFrom("restaurants")
      .select(["id", "proPaidUntil"])
      .where("ownerUserId", "=", user.id)
      .executeTakeFirst();

    if (!restaurant) {
      throw new HttpError(400, "Complete your restaurant profile first");
    }

    const paymentRow = await db
      .selectFrom("subscriptionPayments")
      .select(["id", "status", "amount"])
      .where("restaurantId", "=", restaurant.id)
      .where("razorpayOrderId", "=", input.razorpayOrderId)
      .executeTakeFirst();

    if (!paymentRow) {
      throw new HttpError(404, "Pro payment order not found");
    }

    if (paymentRow.status === "paid") {
      const state = await proSubscription.restaurantState(restaurant.id);
      return requireRole.json({
        ok: true,
        state: state.awaitingActivation ? "awaiting_activation" : "active",
        proPaidUntil: state.awaitingActivation
          ? null
          : restaurant.proPaidUntil,
      } satisfies OutputType);
    }

    const credentials = getRazorpayCredentials();

    if (!signatureMatches(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
      credentials.secret,
    )) {
      await markFailed(paymentRow.id);
      throw new HttpError(400, "Invalid payment signature");
    }

    const expectedAmount = paymentRow.amount * 100;
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
      throw new HttpError(500, "The recorded Pro payment amount is invalid");
    }

    const paymentPath = `/payments/${encodeURIComponent(input.razorpayPaymentId)}`;
    let response = await razorpayRequest(paymentPath, credentials, "GET");
    let parsed = razorpayPaymentSchema.safeParse(response);

    if (
      !parsed.success ||
      parsed.data.id !== input.razorpayPaymentId ||
      parsed.data.order_id !== input.razorpayOrderId ||
      parsed.data.amount !== expectedAmount ||
      parsed.data.currency !== "INR" ||
      !["captured", "authorized"].includes(parsed.data.status)
    ) {
      await markFailed(paymentRow.id);
      throw new HttpError(400, "Razorpay payment details could not be verified");
    }

    if (parsed.data.status === "authorized") {
      response = await razorpayRequest(
        `${paymentPath}/capture`,
        credentials,
        "POST",
        { amount: expectedAmount, currency: "INR" },
      );
      parsed = razorpayPaymentSchema.safeParse(response);

      if (
        !parsed.success ||
        parsed.data.id !== input.razorpayPaymentId ||
        parsed.data.order_id !== input.razorpayOrderId ||
        parsed.data.amount !== expectedAmount ||
        parsed.data.currency !== "INR" ||
        parsed.data.status !== "captured"
      ) {
        await markFailed(paymentRow.id);
        throw new HttpError(400, "Razorpay payment was not captured");
      }
    }

    const result = await proSubscription.recordPaidPayment({
      restaurantId: restaurant.id,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });

    return requireRole.json({
      ok: true,
      ...result,
    } satisfies OutputType);
  } catch (error) {
    console.error("Restaurant Pro verification failed:", error);
    return requireRole.errorResponse(
      error instanceof HttpError || error instanceof z.ZodError
        ? error
        : new HttpError(500, "Could not verify the Pro payment"),
    );
  }
}