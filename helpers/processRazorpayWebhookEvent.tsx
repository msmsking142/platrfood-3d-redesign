import { z } from "zod";
import { db } from "./db";
import { foodComplaints } from "./foodComplaints";
import { financialLedger } from "./financialLedger";
import { paymentReconciliation } from "./paymentReconciliation";
import { riderOnboardingFee } from "./riderOnboardingFee";
import { getRazorpayOrderNotes } from "./razorpayOrderNotes";
import { refundFailures } from "./refundFailures";

export const razorpayWebhookEnvelopeSchema = z.object({
  event: z.string().min(1),
  payload: z.unknown(),
});

const capturedPayloadSchema = z.object({
  payment: z.object({
    entity: z.object({
      id: z.string().min(1),
      order_id: z.string().min(1),
      amount: z.number().int().positive(),
      currency: z.string(),
      fee: z.number().int().nonnegative().nullish(),
      notes: z.object({
        purpose: z.string().optional(),
        orderId: z.string().optional(),
        restaurantId: z.string().optional(),
        walletTxnId: z.string().optional(),
        userId: z.string().optional(),
        riderId: z.string().optional(),
      }).nullish(),
    }),
  }),
});

const refundPayloadSchema = z.object({
  refund: z.object({
    entity: z.object({
      id: z.string().min(1),
      payment_id: z.string().min(1),
      amount: z.number().int().positive(),
      status: z.string(),
      notes: z.object({
        complaintId: z.string().optional(),
        orderId: z.string().optional(),
      }).nullish(),
      error_description: z.string().nullish(),
    }),
  }),
});

function amountInPaise(rupees: number): number {
  const amount = rupees * 100;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Recorded payment amount is invalid");
  }
  return amount;
}

async function processCaptured(payload: unknown): Promise<void> {
  const { entity } = capturedPayloadSchema.parse(payload).payment;
  let notes = entity.notes;
  let purpose = notes?.purpose;

  if (
    purpose !== "zipto_food_order" &&
    purpose !== "zipto_wallet_topup" &&
    purpose !== "zipto_pro_plan" &&
    purpose !== "zipto_rider_onboarding"
  ) {
    notes = await getRazorpayOrderNotes(entity.order_id);
    purpose = notes?.purpose;
  }

  if (purpose === "zipto_rider_onboarding") {
    try {
      const riderId = await riderOnboardingFee.recordPaid({
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        amountPaise: entity.amount,
      });
      if (riderId === null) {
        console.error("Rider onboarding webhook has no matching payment order:", entity.order_id);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Payment amount does not match the onboarding fee order"
      ) {
        console.error("Rider onboarding webhook payment amount mismatch:", {
          orderId: entity.order_id,
          paymentId: entity.id,
          amountPaise: entity.amount,
        });
        return;
      }
      throw error;
    }
    return;
  }

  if (
    purpose !== "zipto_food_order" &&
    purpose !== "zipto_wallet_topup" &&
    purpose !== "zipto_pro_plan"
  ) {
    return;
  }

  await paymentReconciliation.handleCapturedPayment({
    purpose,
    notes,
    razorpayPaymentId: entity.id,
    razorpayOrderId: entity.order_id,
    amountPaise: entity.amount,
    currency: entity.currency,
    feePaise: entity.fee,
  });
}

async function processRefund(
  eventType: "refund.processed" | "refund.failed",
  payload: unknown,
): Promise<void> {
  const { entity } = refundPayloadSchema.parse(payload).refund;

  if (await foodComplaints.onRazorpayRefundEvent(eventType, entity)) {
    return;
  }

  if (await refundFailures.handleRefundEvent(eventType, entity)) {
    return;
  }
  if (eventType === "refund.failed") return;

  const order = await db
    .selectFrom("orders")
    .select(["id", "total", "paymentStatus", "razorpayRefundId"])
    .where("razorpayPaymentId", "=", entity.payment_id)
    .executeTakeFirst();

  if (!order) return;

  if (amountInPaise(order.total) !== entity.amount) {
    console.error(
      `Unmatched partial Razorpay refund for food order ${order.id}; manual review required`,
    );
    return;
  }
  if (order.razorpayRefundId && order.razorpayRefundId !== entity.id) {
    throw new Error(`Food order ${order.id} has a different recorded refund`);
  }
  if (order.paymentStatus === "refunded") {
    await financialLedger.onRefund(order.id, entity.id);
    return;
  }

  const updated = await db
    .updateTable("orders")
    .set({
      paymentStatus: "refunded",
      razorpayRefundId: entity.id,
      refundedAt: new Date(),
      updatedAt: new Date(),
    })
    .where("id", "=", order.id)
    .where("paymentStatus", "!=", "refunded")
    .where("razorpayRefundId", "is", null)
    .returning("id")
    .executeTakeFirst();

  if (updated) {
    await financialLedger.onRefund(order.id, entity.id);
  }
}

export async function processRazorpayWebhookEvent(
  eventType: string,
  payload: unknown,
): Promise<void> {
  if (eventType === "payment.captured") {
    await processCaptured(payload);
  } else if (eventType === "refund.processed" || eventType === "refund.failed") {
    await processRefund(eventType, payload);
  }
}