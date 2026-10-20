import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { orderPayments } from "../../helpers/orderPayments";
import { paymentReconciliation } from "../../helpers/paymentReconciliation";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type InputType, type OutputType } from "./topup_verify_POST.schema";

const paymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
  status: z.enum(["captured", "authorized"]),
});

function matchingPayment(
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
    (requiredStatus === undefined || parsed.data.status === requiredStatus)
  );
}

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse<unknown>(await request.text()));

    const txn = await db
      .selectFrom("walletTransactions")
      .select(["amount", "status", "razorpayPaymentId"])
      .where("id", "=", input.walletTxnId)
      .where("userId", "=", user.id)
      .where("type", "=", "topup")
      .where("razorpayOrderId", "=", input.razorpayOrderId)
      .executeTakeFirst();

    if (!txn) throw new HttpError(404, "Wallet top-up not found");

    if (!(txn.status === "success" && txn.razorpayPaymentId === input.razorpayPaymentId)) {
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

      const amount = txn.amount * 100;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new HttpError(500, "The recorded top-up amount is invalid");
      }

      const paymentPath = `/payments/${encodeURIComponent(input.razorpayPaymentId)}`;
      const payment = await razorpayRequest(paymentPath, credentials, "GET");
      if (!matchingPayment(payment, input, amount)) {
        throw new HttpError(400, "Razorpay payment does not match this wallet top-up");
      }

      const capturedInput = {
        purpose: "zipto_wallet_topup" as const,
        notes: { walletTxnId: String(input.walletTxnId) },
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
          "This top-up is no longer active. Your payment was not captured and will be released by your bank automatically.",
        );
      }

      if (decision.action === "manual_review" && payment.status === "authorized") {
        throw new HttpError(
          409,
          "We received your payment but need to check it. platr™ support will contact you.",
        );
      }

      if (
        payment.status === "authorized" &&
        (decision.action === "apply" || decision.action === "already_applied")
      ) {
        const captured = await razorpayRequest(
          `${paymentPath}/capture`,
          credentials,
          "POST",
          { amount, currency: "INR" },
        );
        if (!matchingPayment(captured, input, amount, "captured")) {
          throw new HttpError(502, "Wallet payment could not be confirmed as captured");
        }
      }

      // Reclassification inside the handler accounts for changes since the
      // first lookup; only its final outcome determines the response.
      const result = await paymentReconciliation.handleCapturedPayment(capturedInput);
      if (result.outcome === "refunded") {
        throw new HttpError(
          409,
          "This top-up is no longer active. Your payment will be refunded automatically – it was not added to your wallet.",
        );
      }
      if (result.outcome === "manual_review") {
        throw new HttpError(
          409,
          "We received your payment but need to check it. platr™ support will contact you.",
        );
      }
    }

    const walletUser = await db
      .selectFrom("users")
      .select("walletBalance")
      .where("id", "=", user.id)
      .executeTakeFirstOrThrow();

    return requireRole.json({
      ok: true,
      balance: walletUser.walletBalance,
    } satisfies OutputType);
  } catch (error) {
    if (!(error instanceof HttpError) && !(error instanceof z.ZodError)) {
      console.error("Wallet top-up verification failed:", error);
    }
    return requireRole.errorResponse(
      error instanceof HttpError
        ? error
        : error instanceof z.ZodError
          ? new HttpError(400, "Invalid wallet verification request")
          : new HttpError(500, "Could not verify wallet payment"),
    );
  }
}