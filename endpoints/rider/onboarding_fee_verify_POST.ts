import { createHmac, timingSafeEqual } from "node:crypto";
import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { riderOnboardingFee } from "../../helpers/riderOnboardingFee";
import { HttpError, requireRole } from "../../helpers/requireRole";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { schema, type OutputType } from "./onboarding_fee_verify_POST.schema";

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
    .updateTable("riderOnboardingPayments")
    .set({ status: "failed" })
    .where("id", "=", paymentRowId)
    .where("status", "!=", "paid")
    .execute();
}

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["rider"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const rider = await db
      .selectFrom("riders")
      .select("id")
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!rider) {
      throw new HttpError(400, "Complete your rider profile first");
    }

    const paymentRow = await db
      .selectFrom("riderOnboardingPayments")
      .select(["id", "status", "amountPaise", "paidAt"])
      .where("riderId", "=", rider.id)
      .where("razorpayOrderId", "=", input.razorpayOrderId)
      .executeTakeFirst();

    if (!paymentRow) {
      throw new HttpError(404, "Onboarding fee payment order not found");
    }

    if (paymentRow.status === "paid") {
      if (!paymentRow.paidAt) {
        throw new HttpError(500, "Paid onboarding fee is missing its payment date");
      }
      return requireRole.json({
        ok: true,
        paidAt: paymentRow.paidAt,
      } satisfies OutputType);
    }

    const credentials = getRazorpayCredentials();
    if (
      !signatureMatches(
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
        credentials.secret,
      )
    ) {
      await markFailed(paymentRow.id);
      throw new HttpError(400, "Invalid payment signature");
    }

    const paymentPath = `/payments/${encodeURIComponent(input.razorpayPaymentId)}`;
    let response = await razorpayRequest(paymentPath, credentials, "GET");
    let parsed = razorpayPaymentSchema.safeParse(response);

    if (
      !parsed.success ||
      parsed.data.id !== input.razorpayPaymentId ||
      parsed.data.order_id !== input.razorpayOrderId ||
      parsed.data.amount !== paymentRow.amountPaise ||
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
        { amount: paymentRow.amountPaise, currency: "INR" },
      );
      parsed = razorpayPaymentSchema.safeParse(response);

      if (
        !parsed.success ||
        parsed.data.id !== input.razorpayPaymentId ||
        parsed.data.order_id !== input.razorpayOrderId ||
        parsed.data.amount !== paymentRow.amountPaise ||
        parsed.data.currency !== "INR" ||
        parsed.data.status !== "captured"
      ) {
        await markFailed(paymentRow.id);
        throw new HttpError(400, "Razorpay payment was not captured");
      }
    }

    const recordedRiderId = await riderOnboardingFee.recordPaid({
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      amountPaise: paymentRow.amountPaise,
    });

    if (recordedRiderId !== rider.id) {
      throw new HttpError(404, "Onboarding fee payment order not found");
    }

    const recordedPayment = await db
      .selectFrom("riderOnboardingPayments")
      .select("paidAt")
      .where("id", "=", paymentRow.id)
      .executeTakeFirst();

    if (!recordedPayment?.paidAt) {
      throw new HttpError(500, "Could not confirm the onboarding fee payment date");
    }

    return requireRole.json({
      ok: true,
      paidAt: recordedPayment.paidAt,
    } satisfies OutputType);
  } catch (error) {
    console.error("Rider onboarding fee verification failed:", error);
    return requireRole.errorResponse(
      error instanceof HttpError || error instanceof z.ZodError
        ? error
        : new HttpError(500, "Could not verify the onboarding fee payment"),
    );
  }
}