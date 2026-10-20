import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { notifyZipto } from "./notifyZipto";
import { ziptoWallet } from "./ziptoWallet";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "./razorpayProPayment";

const refundResponseSchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1),
  amount: z.number().int().positive(),
});

function signatureMatches(
  message: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
    console.error("Invalid Razorpay signature format");
    return false;
  }

  try {
    const expected = createHmac("sha256", secret).update(message).digest();
    const supplied = Buffer.from(signature, "hex");
    const matches = timingSafeEqual(expected, supplied);
    if (!matches) console.error("Razorpay signature did not match");
    return matches;
  } catch (error) {
    console.error("Could not verify Razorpay signature:", error);
    return false;
  }
}

export const orderPayments = {
  async markPaid({
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    gatewayFeePaise,
  }: {
    orderId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    gatewayFeePaise?: number | null;
  }): Promise<{ changed: boolean }> {
    try {
      const changed = await db
        .updateTable("orders")
        .set({
          paymentStatus: "paid",
          razorpayPaymentId,
          updatedAt: new Date(),
        })
        .where("id", "=", orderId)
        .where("razorpayOrderId", "=", razorpayOrderId)
        .where("paymentMethod", "=", "upi")
        .where("paymentStatus", "=", "pending")
        .where("status", "not in", ["cancelled", "rejected"])
        .returning("id")
        .executeTakeFirst();

      if (changed) {
        try {
          await financialLedger.onPaymentCaptured(orderId, { gatewayFeePaise });
        } catch (error) {
          console.error(`Could not record captured payment for order ${orderId}:`, error);
        }
        await notifyZipto(orderId);
        return { changed: true };
      }

      const order = await db
        .selectFrom("orders")
        .select([
          "razorpayOrderId",
          "razorpayPaymentId",
          "paymentMethod",
          "paymentStatus",
          "status",
        ])
        .where("id", "=", orderId)
        .executeTakeFirst();

      if (
        !order ||
        order.razorpayOrderId !== razorpayOrderId ||
        order.paymentMethod !== "upi"
      ) {
        throw new Error(`Online payment does not match platr™ order ${orderId}`);
      }

      if (order.status === "cancelled" || order.status === "rejected") {
        if (
          order.razorpayPaymentId !== null &&
          order.razorpayPaymentId !== razorpayPaymentId
        ) {
          throw new Error(
            `Order ${orderId} has a different recorded payment; refund requires manual review`,
          );
        }

        // Record the captured payment on the closed order so the refund remains
        // retryable if Razorpay is unavailable.
        if (order.paymentStatus === "pending") {
          const latePayment = await db
            .updateTable("orders")
            .set({
              paymentStatus: "paid",
              razorpayPaymentId,
              updatedAt: new Date(),
            })
            .where("id", "=", orderId)
            .where("razorpayOrderId", "=", razorpayOrderId)
            .where("paymentStatus", "=", "pending")
            .where("status", "in", ["cancelled", "rejected"])
            .returning("id")
            .executeTakeFirst();

          if (latePayment) {
            try {
              await financialLedger.onPaymentCaptured(orderId, { gatewayFeePaise });
            } catch (error) {
              console.error(`Could not record late captured payment for order ${orderId}:`, error);
            }
          }
        }

        console.error(
          `Payment arrived after platr™ order ${orderId} was ${order.status}; requesting refund`,
        );
        await orderPayments.refundIfPaid(
          orderId,
          `Payment received after order ${order.status}`,
        );
      } else if (
        order.paymentStatus === "paid" &&
        order.razorpayPaymentId !== razorpayPaymentId
      ) {
        throw new Error(
          `Order ${orderId} has a different recorded Razorpay payment`,
        );
      }

      return { changed: false };
    } catch (error) {
      console.error(`Could not mark platr™ order ${orderId} paid:`, error);
      throw error;
    }
  },

  async refundIfPaid(orderId: number, reason: string): Promise<void> {
    try {
      const paymentMethod = await db
        .selectFrom("orders")
        .select("paymentMethod")
        .where("id", "=", orderId)
        .executeTakeFirstOrThrow();

      if (paymentMethod.paymentMethod === "wallet") {
        const refundId = await ziptoWallet.refundOrder(orderId, reason);
        if (refundId) {
          try {
            await financialLedger.onRefund(orderId, refundId);
          } catch (error) {
            console.error(
              `Could not record wallet refund ledger entry for order ${orderId}:`,
              error,
            );
          }
        }
        return;
      }

      // The row lock serializes competing refund attempts. It is held until
      // both the Razorpay response and its refund ID are committed.
      const refundId = await db.transaction().execute(async (transaction) => {
        const order = await transaction
          .selectFrom("orders")
          .select([
            "paymentMethod",
            "paymentStatus",
            "razorpayPaymentId",
            "razorpayRefundId",
            "failedRazorpayRefundId",
            "total",
          ])
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        if (
          order.paymentMethod !== "upi" ||
          order.paymentStatus !== "paid" ||
          !order.razorpayPaymentId ||
          order.razorpayRefundId !== null
        ) {
          return null;
        }

        const amount = order.total * 100;
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new Error(`Invalid refund amount for order ${orderId}`);
        }

        const response = await razorpayRequest(
          `/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`,
          getRazorpayCredentials(),
          "POST",
          {
            amount,
            speed: "normal",
            notes: { orderId: String(orderId), reason: reason.slice(0, 255) },
            receipt: order.failedRazorpayRefundId === null
              ? `zipto-refund-${orderId}`
              : `zipto-refund-${orderId}-retry-${Date.now()}`,
          },
        );
        const refund = refundResponseSchema.parse(response);

        if (
          refund.payment_id !== order.razorpayPaymentId ||
          refund.amount !== amount
        ) {
          throw new Error(
            `Razorpay returned a mismatched refund for order ${orderId}`,
          );
        }

        const updated = await transaction
          .updateTable("orders")
          .set({
            paymentStatus: "refunded",
            razorpayRefundId: refund.id,
            refundedAt: new Date(),
            updatedAt: new Date(),
          })
          .where("id", "=", orderId)
          .where("paymentStatus", "=", "paid")
          .where("razorpayRefundId", "is", null)
          .returning("id")
          .executeTakeFirst();

        if (!updated) {
          throw new Error(
            `Could not record Razorpay refund for order ${orderId}`,
          );
        }
        return refund.id;
      });

      if (refundId) {
        try {
          await financialLedger.onRefund(orderId, refundId);
        } catch (error) {
          console.error(`Could not record refund ledger entry for order ${orderId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Refund failed for platr™ order ${orderId}:`, error);
      throw new Error(
        "Refund failed, platr™ support will process it manually",
        { cause: error },
      );
    }
  },

  verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string,
  ): boolean {
    return signatureMatches(`${orderId}|${paymentId}`, signature, secret);
  },

  verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
  ): boolean {
    return signatureMatches(rawBody, signature, secret);
  },
};