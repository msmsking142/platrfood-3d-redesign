import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type {
  Orders,
  PaymentReconciliations,
  SubscriptionPayments,
  WalletTransactions,
} from "../../helpers/schema";

export const schema = z.object({}).strict();

export type ReconciliationRow = {
  kind: "wallet_topup" | "pro_payment" | "food_order";
  recordId: number;
  userOrRestaurantId: number | null;
  amount: number;
  razorpayOrderId: string | null;
  createdAt: Date;
  recordStatus:
    | Selectable<WalletTransactions>["status"]
    | Selectable<SubscriptionPayments>["status"]
    | Selectable<Orders>["status"];
  verdict:
    | "captured_not_credited"
    | "authorized_only"
    | "failed_only"
    | "no_payment_attempt"
    | "amount_mismatch"
    | "lookup_error";
  detail?: string;
  paymentCount: number;
  payments: {
    paymentId: string;
    status: "created" | "authorized" | "captured" | "refunded" | "failed";
    amountPaise: number;
    method: string | null;
    createdAt: Date;
  }[];
};

export type OutputType = {
  checkedAt: Date;
  handledPayments: Pick<
    Selectable<PaymentReconciliations>,
    | "id"
    | "razorpayPaymentId"
    | "razorpayOrderId"
    | "kind"
    | "recordId"
    | "amountPaise"
    | "action"
    | "status"
    | "razorpayRefundId"
    | "reason"
    | "error"
    | "createdAt"
    | "updatedAt"
  >[];
  walletTopups: ReconciliationRow[];
  proPayments: ReconciliationRow[];
  foodOrders: ReconciliationRow[];
};

export async function getAdminPaymentReconcile(
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/admin/payment_reconcile", {
    ...init,
    method: "GET",
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }

  return superjson.parse<OutputType>(await result.text());
}