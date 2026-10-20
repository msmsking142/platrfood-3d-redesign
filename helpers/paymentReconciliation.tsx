// BACKEND ONLY.
import type { Selectable } from "kysely";
import { z } from "zod";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { notifyZipto } from "./notifyZipto";
import { orderPayments } from "./orderPayments";
import {
  paymentReconciliationDecision,
  type PaymentReconciliationDecision,
} from "./paymentReconciliationDecision";
import { proSubscription } from "./proSubscription";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "./razorpayProPayment";
import type { PaymentReconciliations } from "./schema";
import { ziptoWallet } from "./ziptoWallet";

type ReconciliationKind = Selectable<PaymentReconciliations>["kind"];
type RefundAction = Extract<
  Selectable<PaymentReconciliations>["action"],
  "refund_duplicate" | "refund_late"
>;

export type CapturedPaymentInput = {
  purpose: "zipto_food_order" | "zipto_wallet_topup" | "zipto_pro_plan";
  notes: {
    orderId?: string;
    walletTxnId?: string;
    userId?: string;
    restaurantId?: string;
  } | null | undefined;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  feePaise?: number | null;
};

type Classification = {
  kind: ReconciliationKind;
  recordId: number | null;
  decision: PaymentReconciliationDecision;
};

type RefundInput = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  kind: ReconciliationKind;
  recordId: number | null;
  amountPaise: number;
  action: RefundAction;
  reason: string;
};

const razorpayOrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string(),
  notes: z.object({
    purpose: z.string().optional(),
    orderId: z.string().optional(),
  }).nullish(),
});

const razorpayPaymentSchema = z.object({
  id: z.string().min(1),
  order_id: z.string().min(1),
  amount: z.number().int().positive(),
  amount_refunded: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.string(),
});

const razorpayRefundSchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1),
  amount: z.number().int().positive(),
});

function positiveId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function captureFields(input: CapturedPaymentInput) {
  return {
    paymentId: input.razorpayPaymentId,
    paymentOrderId: input.razorpayOrderId,
    amountPaise: input.amountPaise,
    currency: input.currency,
  };
}

async function classify(input: CapturedPaymentInput): Promise<Classification> {
  try {
    if (input.purpose === "zipto_food_order") {
      const orderId = positiveId(input.notes?.orderId);
      const order = orderId === null
        ? null
        : await db.selectFrom("orders")
            .select([
              "total", "razorpayOrderId", "razorpayPaymentId",
              "paymentStatus", "status", "paymentMethod",
            ])
            .where("id", "=", orderId)
            .executeTakeFirst() ?? null;

      let supersededOrderCheck = null;
      if (
        orderId !== null &&
        order &&
        order.razorpayOrderId !== input.razorpayOrderId &&
        order.paymentMethod === "upi" &&
        input.currency === "INR" &&
        order.total * 100 === input.amountPaise
      ) {
        const remote = razorpayOrderSchema.parse(
          await razorpayRequest(
            `/orders/${encodeURIComponent(input.razorpayOrderId)}`,
            getRazorpayCredentials(),
            "GET",
          ),
        );
        supersededOrderCheck = {
          belongsToOrder:
            remote.id === input.razorpayOrderId &&
            remote.currency === "INR" &&
            remote.notes?.purpose === "zipto_food_order" &&
            remote.notes.orderId === String(orderId),
          amountPaise: remote.amount,
        };
      }

      return {
        kind: "food_order",
        recordId: orderId,
        decision: paymentReconciliationDecision({
          kind: "food_order",
          ...captureFields(input),
          order,
          supersededOrderCheck,
        }),
      };
    }

    if (input.purpose === "zipto_wallet_topup") {
      const txnId = positiveId(input.notes?.walletTxnId);
      const txn = txnId === null
        ? null
        : await db.selectFrom("walletTransactions")
            .select(["amount", "status", "razorpayOrderId", "razorpayPaymentId"])
            .where("id", "=", txnId)
            .where("type", "=", "topup")
            .executeTakeFirst() ?? null;

      return {
        kind: "wallet_topup",
        recordId: txnId,
        decision: paymentReconciliationDecision({
          kind: "wallet_topup",
          ...captureFields(input),
          txn,
        }),
      };
    }

    const restaurantId = positiveId(input.notes?.restaurantId);
    const payment = restaurantId === null
      ? null
      : await db.selectFrom("subscriptionPayments")
          .select(["id", "amount", "status", "razorpayPaymentId"])
          .where("restaurantId", "=", restaurantId)
          .where("razorpayOrderId", "=", input.razorpayOrderId)
          .executeTakeFirst() ?? null;

    return {
      kind: "pro_payment",
      recordId: payment?.id ?? null,
      decision: paymentReconciliationDecision({
        kind: "pro_payment",
        ...captureFields(input),
        payment,
      }),
    };
  } catch (error) {
    console.error("Could not classify captured Razorpay payment:", error);
    throw error;
  }
}

async function recordGatewayFee(orderId: number, feePaise: number | null | undefined) {
  if (feePaise == null) return;
  try {
    await financialLedger.onPaymentCaptured(orderId, {
      gatewayFeePaise: feePaise,
    });
  } catch (error) {
    console.error(`Could not record gateway fee for order ${orderId}:`, error);
  }
}

async function flagManualReview(
  input: CapturedPaymentInput,
  classification: Classification,
  reason: string,
): Promise<void> {
  try {
    await db.insertInto("paymentReconciliations")
      .values({
        razorpayPaymentId: input.razorpayPaymentId,
        razorpayOrderId: input.razorpayOrderId,
        kind: classification.kind,
        recordId: classification.recordId,
        amountPaise: input.amountPaise,
        action: "manual_review",
        status: "manual_review",
        reason,
        updatedAt: new Date(),
      })
      .onConflict((conflict) => conflict.column("razorpayPaymentId").doNothing())
      .execute();
    console.error(`Razorpay payment ${input.razorpayPaymentId} needs manual review: ${reason}`);
  } catch (error) {
    console.error(`Could not flag Razorpay payment ${input.razorpayPaymentId} for review:`, error);
    throw error;
  }
}

async function acceptSuperseded(
  input: CapturedPaymentInput,
  orderId: number,
): Promise<"accepted" | "stale" | "claimed"> {
  try {
    return await db.transaction().execute(async (transaction) => {
      const order = await transaction.selectFrom("orders")
        .select([
          "paymentStatus", "status", "paymentMethod", "total",
          "razorpayOrderId", "razorpayPaymentId",
        ])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();

      if (
        !order ||
        order.paymentStatus !== "pending" ||
        order.status === "cancelled" ||
        order.status === "rejected" ||
        order.paymentMethod !== "upi" ||
        order.total * 100 !== input.amountPaise ||
        order.razorpayOrderId === input.razorpayOrderId ||
        order.razorpayPaymentId !== null
      ) {
        return "stale";
      }

      const claimed = await transaction.insertInto("paymentReconciliations")
        .values({
          razorpayPaymentId: input.razorpayPaymentId,
          razorpayOrderId: input.razorpayOrderId,
          kind: "food_order",
          recordId: orderId,
          amountPaise: input.amountPaise,
          action: "accepted_superseded",
          status: "done",
          reason: "Verified payment on superseded Razorpay order accepted",
          updatedAt: new Date(),
        })
        .onConflict((conflict) => conflict.column("razorpayPaymentId").doNothing())
        .returning("id")
        .executeTakeFirst();

      if (!claimed) return "claimed";

      await transaction.updateTable("orders")
        .set({
          paymentStatus: "paid",
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          updatedAt: new Date(),
        })
        .where("id", "=", orderId)
        .executeTakeFirstOrThrow();

      return "accepted";
    });
  } catch (error) {
    console.error(`Could not accept superseded payment for order ${orderId}:`, error);
    throw error;
  }
}

async function refundPaymentOnce(input: RefundInput): Promise<void> {
  try {
    await db.insertInto("paymentReconciliations")
      .values({
        razorpayPaymentId: input.razorpayPaymentId,
        razorpayOrderId: input.razorpayOrderId,
        kind: input.kind,
        recordId: input.recordId,
        amountPaise: input.amountPaise,
        action: input.action,
        status: "processing",
        reason: input.reason,
        updatedAt: new Date(),
      })
      .onConflict((conflict) => conflict.column("razorpayPaymentId").doNothing())
      .execute();

    try {
      await db.transaction().execute(async (transaction) => {
        const row = await transaction.selectFrom("paymentReconciliations")
          .selectAll()
          .where("razorpayPaymentId", "=", input.razorpayPaymentId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        if (row.status === "done" || row.status === "manual_review") return;
        if (
          row.action !== input.action ||
          row.razorpayOrderId !== input.razorpayOrderId ||
          row.kind !== input.kind ||
          row.recordId !== input.recordId ||
          row.amountPaise !== input.amountPaise
        ) {
          throw new Error(`Conflicting reconciliation claim for payment ${input.razorpayPaymentId}`);
        }

        const payment = razorpayPaymentSchema.parse(
          await razorpayRequest(
            `/payments/${encodeURIComponent(input.razorpayPaymentId)}`,
            getRazorpayCredentials(),
            "GET",
          ),
        );

        const setStatus = async (
          status: "done" | "manual_review",
          reason: string,
          razorpayRefundId: string | null = null,
        ) => {
          await transaction.updateTable("paymentReconciliations")
            .set({
              status,
              reason,
              razorpayRefundId,
              error: null,
              updatedAt: new Date(),
            })
            .where("id", "=", row.id)
            .executeTakeFirstOrThrow();
        };

        if (
          payment.id !== input.razorpayPaymentId ||
          payment.order_id !== input.razorpayOrderId ||
          payment.currency !== "INR" ||
          payment.amount !== input.amountPaise
        ) {
          await setStatus("manual_review", "Razorpay payment identity, currency or amount differs from the reconciliation claim");
          console.error(`Razorpay payment ${input.razorpayPaymentId} needs manual review: payment details differ`);
          return;
        }

        if (payment.status === "refunded" || payment.amount_refunded >= input.amountPaise) {
          await setStatus("done", "Razorpay reports that the payment has already been refunded");
          return;
        }
        if (payment.status === "authorized") {
          await setStatus("manual_review", "authorized only – Razorpay releases it automatically");
          console.error(`Razorpay payment ${input.razorpayPaymentId} is authorized only; refund not requested`);
          return;
        }
        if (payment.status !== "captured" || payment.amount_refunded > 0) {
          await setStatus("manual_review", "Payment is not fully captured or has a partial refund; manual review required");
          console.error(`Razorpay payment ${input.razorpayPaymentId} is not safe to refund in full`);
          return;
        }

        const refund = razorpayRefundSchema.parse(
          await razorpayRequest(
            `/payments/${encodeURIComponent(input.razorpayPaymentId)}/refund`,
            getRazorpayCredentials(),
            "POST",
            {
              amount: input.amountPaise,
              speed: "normal",
              receipt: `zipto-recon-${row.id}`,
              notes: {
                reason: input.reason,
                kind: input.kind,
                recordId: input.recordId === null ? "" : String(input.recordId),
              },
            },
          ),
        );
        if (
          refund.payment_id !== input.razorpayPaymentId ||
          refund.amount !== input.amountPaise
        ) {
          throw new Error(`Razorpay returned a mismatched refund for payment ${input.razorpayPaymentId}`);
        }

        // This payment never entered the order ledger; do not post its refund there.
        await setStatus("done", input.reason, refund.id);
      });
    } catch (error) {
      console.error(`Razorpay reconciliation refund failed for ${input.razorpayPaymentId}:`, error);
      try {
        await db.updateTable("paymentReconciliations")
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where("razorpayPaymentId", "=", input.razorpayPaymentId)
          .where("status", "in", ["processing", "failed"])
          .execute();
      } catch (updateError) {
        console.error(`Could not mark reconciliation ${input.razorpayPaymentId} failed:`, updateError);
      }
      throw error;
    }
  } catch (error) {
    console.error(`Could not reconcile refund for payment ${input.razorpayPaymentId}:`, error);
    throw error;
  }
}

type Outcome = {
  outcome: "applied" | "already_applied" | "accepted_superseded" | "refunded" | "manual_review";
};

async function executeClassification(
  input: CapturedPaymentInput,
  classification: Classification,
  acceptanceRetried = false,
): Promise<Outcome> {
  const { decision, kind, recordId } = classification;

  if (decision.action === "manual_review") {
    await flagManualReview(input, classification, decision.reason);
    return { outcome: "manual_review" };
  }

  if (decision.action === "already_applied") {
    if (kind === "food_order" && recordId !== null) {
      await recordGatewayFee(recordId, input.feePaise);
    }
    return { outcome: "already_applied" };
  }

  if (decision.action === "refund_duplicate" || decision.action === "refund_late") {
    await refundPaymentOnce({
      razorpayPaymentId: input.razorpayPaymentId,
      razorpayOrderId: input.razorpayOrderId,
      kind,
      recordId,
      amountPaise: input.amountPaise,
      action: decision.action,
      reason: decision.reason,
    });
    return { outcome: "refunded" };
  }

  if (decision.action === "accept_superseded") {
    if (recordId === null) {
      throw new Error("Verified superseded food payment has no order ID");
    }
    if (acceptanceRetried) {
      throw new Error(`Food order ${recordId} changed while accepting its superseded payment; retry reconciliation`);
    }

    const result = await acceptSuperseded(input, recordId);
    if (result === "claimed") {
      await flagManualReview(
        input,
        classification,
        "Another reconciliation already claimed this Razorpay payment",
      );
      return { outcome: "manual_review" };
    }
    if (result === "stale") {
      return executeClassification(input, await classify(input), true);
    }

    try {
      await financialLedger.onPaymentCaptured(recordId, {
        gatewayFeePaise: input.feePaise,
      });
    } catch (error) {
      console.error(`Could not record accepted superseded payment for order ${recordId}:`, error);
    }
    await notifyZipto(recordId);
    return { outcome: "accepted_superseded" };
  }

  if (recordId === null) {
    throw new Error(`Applicable ${kind} payment has no record ID`);
  }

  if (kind === "food_order") {
    const { changed } = await orderPayments.markPaid({
      orderId: recordId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      gatewayFeePaise: input.feePaise,
    });
    if (!changed) await recordGatewayFee(recordId, input.feePaise);
  } else if (kind === "wallet_topup") {
    await ziptoWallet.creditTopup({
      walletTxnId: recordId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });
  } else {
    const restaurantId = positiveId(input.notes?.restaurantId);
    if (restaurantId === null) {
      throw new Error("Applicable Pro payment has no restaurant ID");
    }
    await proSubscription.recordPaidPayment({
      restaurantId,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
    });
  }
  return { outcome: "applied" };
}

async function handleCapturedPayment(input: CapturedPaymentInput): Promise<Outcome> {
  try {
    return await executeClassification(input, await classify(input));
  } catch (error) {
    console.error(`Could not handle captured Razorpay payment ${input.razorpayPaymentId}:`, error);
    throw error;
  }
}

export const paymentReconciliation = {
  classify,
  handleCapturedPayment,
  refundPaymentOnce,
};