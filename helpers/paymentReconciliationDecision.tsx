import type { Selectable } from "kysely";
import type {
  Orders,
  SubscriptionPayments,
  WalletTransactions,
} from "./schema";

type CapturedPayment = {
  paymentId: string;
  paymentOrderId: string;
  amountPaise: number;
  currency: string;
};

export type PaymentReconciliationInput =
  | (CapturedPayment & {
      kind: "food_order";
      order:
        | Pick<
            Selectable<Orders>,
            | "total"
            | "razorpayOrderId"
            | "razorpayPaymentId"
            | "paymentStatus"
            | "status"
            | "paymentMethod"
          >
        | null;
      supersededOrderCheck: {
        belongsToOrder: boolean;
        amountPaise: number;
      } | null;
    })
  | (CapturedPayment & {
      kind: "wallet_topup";
      txn:
        | Pick<
            Selectable<WalletTransactions>,
            "amount" | "status" | "razorpayOrderId" | "razorpayPaymentId"
          >
        | null;
    })
  | (CapturedPayment & {
      kind: "pro_payment";
      payment:
        | Pick<
            Selectable<SubscriptionPayments>,
            "amount" | "status" | "razorpayPaymentId"
          >
        | null;
    });

export type PaymentReconciliationDecision =
  | { action: "apply" }
  | { action: "already_applied" }
  | { action: "accept_superseded" }
  | { action: "refund_duplicate"; reason: string }
  | { action: "refund_late"; reason: string }
  | { action: "manual_review"; reason: string };

function matchesAmount(rupees: number, paise: number): boolean {
  return (
    Number.isSafeInteger(rupees) &&
    rupees > 0 &&
    Number.isSafeInteger(paise) &&
    paise === rupees * 100
  );
}

export function paymentReconciliationDecision(
  input: PaymentReconciliationInput,
): PaymentReconciliationDecision {
  if (input.kind === "food_order") {
    const { order } = input;
    if (
      !order ||
      order.paymentMethod !== "upi" ||
      input.currency !== "INR" ||
      !matchesAmount(order.total, input.amountPaise)
    ) {
      return { action: "manual_review", reason: "Food order, payment method, currency or amount could not be verified" };
    }

    if (order.razorpayPaymentId === input.paymentId) {
      return { action: "already_applied" };
    }

    const closed = order.status === "cancelled" || order.status === "rejected";
    if (input.paymentOrderId === order.razorpayOrderId) {
      if (order.paymentStatus === "pending") {
        return { action: "apply" };
      }
      if (order.paymentStatus === "refunded" || closed) {
        return { action: "refund_late", reason: "Payment arrived for a closed or refunded food order" };
      }
      return { action: "refund_duplicate", reason: "Food order was paid with another payment" };
    }

    if (
      !input.supersededOrderCheck?.belongsToOrder ||
      input.supersededOrderCheck.amountPaise !== input.amountPaise
    ) {
      return { action: "manual_review", reason: "Superseded Razorpay order could not be verified against this food order" };
    }

    if (order.paymentStatus === "pending" && !closed) {
      return { action: "accept_superseded" };
    }
    if (order.paymentStatus === "paid" && !closed) {
      return { action: "refund_duplicate", reason: "Food order was paid with another payment" };
    }
    return { action: "refund_late", reason: "Payment arrived on an old Razorpay order after the food order closed" };
  }

  if (input.kind === "wallet_topup") {
    const { txn } = input;
    if (
      !txn ||
      txn.razorpayOrderId !== input.paymentOrderId ||
      input.currency !== "INR" ||
      !matchesAmount(txn.amount, input.amountPaise)
    ) {
      return { action: "manual_review", reason: "Wallet top-up, Razorpay order, currency or amount could not be verified" };
    }
    if (txn.razorpayPaymentId === input.paymentId) {
      return { action: "already_applied" };
    }
    if (txn.status === "pending") return { action: "apply" };
    if (txn.status === "success") {
      return { action: "refund_duplicate", reason: "Wallet top-up was credited from another payment" };
    }
    return { action: "refund_late", reason: "Payment arrived after the wallet top-up failed" };
  }

  if (
    !input.payment ||
    input.currency !== "INR" ||
    !matchesAmount(input.payment.amount, input.amountPaise)
  ) {
    return { action: "manual_review", reason: "Pro payment, Razorpay order, currency or amount could not be verified" };
  }
  if (
    input.payment.status === "paid" &&
    input.payment.razorpayPaymentId === input.paymentId
  ) {
    return { action: "already_applied" };
  }
  if (input.payment.status === "paid") {
    return { action: "refund_duplicate", reason: "Pro subscription was paid with another payment" };
  }
  return { action: "apply" };
}