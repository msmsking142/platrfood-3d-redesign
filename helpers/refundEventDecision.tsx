import type { Selectable } from "kysely";
import type { Orders, PaymentReconciliations } from "./schema";

export type RefundEvent = "refund.processed" | "refund.failed";

type OrderForDecision = Pick<
  Selectable<Orders>,
  | "id"
  | "total"
  | "paymentStatus"
  | "razorpayPaymentId"
  | "razorpayRefundId"
  | "failedRazorpayRefundId"
>;

type ReconciliationForDecision = Pick<
  Selectable<PaymentReconciliations>,
  "status" | "razorpayRefundId" | "amountPaise"
>;

export type RefundEventDecision =
  | {
      target: "reconciliation";
      action: "mark_processed" | "mark_failed" | "already" | "mismatch";
    }
  | {
      target: "order";
      action:
        | "mark_failed"
        | "already"
        | "mismatch"
        | "existing_processed"
        | "ignore";
    }
  | { target: "none" };

export function refundEventDecision({
  event,
  refund,
  order,
  reconciliation,
}: {
  event: RefundEvent;
  refund: { id: string; paymentId: string; amountPaise: number };
  order: OrderForDecision | null;
  reconciliation: ReconciliationForDecision | null;
}): RefundEventDecision {
  if (reconciliation?.razorpayRefundId === refund.id) {
    if (reconciliation.amountPaise !== refund.amountPaise) {
      return { target: "reconciliation", action: "mismatch" };
    }

    if (reconciliation.status === "refund_failed") {
      return {
        target: "reconciliation",
        action: event === "refund.failed" ? "already" : "mismatch",
      };
    }

    if (reconciliation.status !== "done") {
      return { target: "reconciliation", action: "mismatch" };
    }

    return {
      target: "reconciliation",
      action: event === "refund.failed" ? "mark_failed" : "mark_processed",
    };
  }

  if (order === null || order.razorpayPaymentId !== refund.paymentId) {
    return { target: "none" };
  }

  if (order.failedRazorpayRefundId === refund.id) {
    return {
      target: "order",
      action: event === "refund.failed" ? "already" : "mismatch",
    };
  }

  if (event === "refund.processed") {
    return { target: "order", action: "existing_processed" };
  }

  if (
    order.razorpayRefundId === refund.id &&
    order.paymentStatus === "refunded"
  ) {
    // A partial refund must never reverse the ledger entry for a full order.
    return {
      target: "order",
      action:
        order.total * 100 === refund.amountPaise ? "mark_failed" : "mismatch",
    };
  }

  return { target: "order", action: "ignore" };
}