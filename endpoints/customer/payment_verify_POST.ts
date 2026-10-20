import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { paymentReconciliation } from "../../helpers/paymentReconciliation";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { orderPayments } from "../../helpers/orderPayments";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type InputType, type OutputType } from "./payment_verify_POST.schema";

const paymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string(),
  status: z.enum(["captured", "authorized"]),
});

function matchesPayment(
  response: unknown,
  input: InputType,
  amount: number,
  requiredStatus?: "captured",
): response is z.infer<typeof paymentSchema> {
  const parsed = paymentSchema.safeParse(response);
  return (
    parsed.success &&
    parsed.data.id === input.razorpayPaymentId &&
    parsed.data.order_id === input.razorpayOrderId &&
    parsed.data.amount === amount &&
    parsed.data.currency === "INR" &&
    (requiredStatus === undefined || parsed.data.status === requiredStatus)
  );
}

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse<unknown>(await request.text()));

    const order = await db
      .selectFrom("orders")
      .select(["id", "total", "paymentStatus", "razorpayOrderId", "razorpayPaymentId"])
      .where("id", "=", input.orderId)
      .where("customerUserId", "=", user.id)
      .where("paymentMethod", "=", "upi")
      .executeTakeFirst();

    if (!order) throw new HttpError(404, "Online order not found");
    if (
      order.paymentStatus === "paid" &&
      order.razorpayPaymentId === input.razorpayPaymentId
    ) {
      return requireRole.json({ ok: true } satisfies OutputType);
    }
    if (
      order.paymentStatus === "refunded" &&
      (order.razorpayOrderId === input.razorpayOrderId ||
        order.razorpayPaymentId === input.razorpayPaymentId)
    ) {
      throw new HttpError(409, "This order's payment has been refunded");
    }

    const credentials = getRazorpayCredentials();
    if (
      !orderPayments.verifyCheckoutSignature(
        input.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
        credentials.secret,
      )
    ) {
      throw new HttpError(400, "Invalid Razorpay payment signature");
    }

    const amount = order.total * 100;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new HttpError(500, "The recorded order amount is invalid");
    }

    const paymentPath = `/payments/${encodeURIComponent(input.razorpayPaymentId)}`;
    const payment = await razorpayRequest(paymentPath, credentials, "GET");
    if (!matchesPayment(payment, input, amount)) {
      throw new HttpError(400, "Razorpay payment details do not match this order");
    }

    const capturedInput = {
      purpose: "zipto_food_order" as const,
      notes: { orderId: String(order.id) },
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      amountPaise: amount,
      currency: "INR",
    };
    const { decision } = await paymentReconciliation.classify(capturedInput);

    if (
      (decision.action === "refund_duplicate" || decision.action === "refund_late") &&
      payment.status === "authorized"
    ) {
      throw new HttpError(
        409,
        "This order was already paid or closed. Your extra payment was not captured and will be released by your bank automatically.",
      );
    }

    if (decision.action === "manual_review" && payment.status === "authorized") {
      throw new HttpError(
        409,
        "We received your payment but need to check it. platr™ support will contact you – no need to pay again.",
      );
    }

    if (
      payment.status === "authorized" &&
      (decision.action === "apply" ||
        decision.action === "accept_superseded" ||
        decision.action === "already_applied")
    ) {
      const captured = await razorpayRequest(
        `${paymentPath}/capture`,
        credentials,
        "POST",
        { amount, currency: "INR" },
      );
      if (!matchesPayment(captured, input, amount, "captured")) {
        throw new HttpError(502, "Razorpay payment could not be confirmed as captured");
      }
    }

    // Reconciliation classifies again against current database state. Use its
    // outcome rather than the earlier decision if another payment won a race.
    const result = await paymentReconciliation.handleCapturedPayment(capturedInput);
    if (
      result.outcome === "applied" ||
      result.outcome === "already_applied" ||
      result.outcome === "accepted_superseded"
    ) {
      return requireRole.json({ ok: true } satisfies OutputType);
    }
    if (result.outcome === "refunded") {
      throw new HttpError(
        409,
        "This order was already paid or closed. Your extra payment will be refunded automatically.",
      );
    }
    throw new HttpError(
      409,
      "We received your payment but need to check it. platr™ support will contact you – no need to pay again.",
    );
  } catch (error) {
    if (!(error instanceof HttpError) && !(error instanceof z.ZodError)) {
      console.error("Customer payment verification failed:", error);
    }
    return requireRole.errorResponse(
      error instanceof HttpError
        ? error
        : error instanceof z.ZodError
          ? new HttpError(400, "Invalid payment verification request")
          : new HttpError(500, "Could not verify online payment"),
    );
  }
}