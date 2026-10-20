import { z } from "zod";
import { db } from "../../helpers/db";
import { razorpayRequest, getRazorpayCredentials } from "../../helpers/razorpayProPayment";
import { requireRole } from "../../helpers/requireRole";
import type { OutputType, ReconciliationRow } from "./payment_reconcile_GET.schema";

type PendingRecord = Pick<
  ReconciliationRow,
  "kind" | "recordId" | "userOrRestaurantId" | "amount" | "razorpayOrderId" | "createdAt" | "recordStatus"
>;

const razorpayPaymentsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
    amount: z.number().int().nonnegative(),
    method: z.string().nullable(),
    created_at: z.number().int().nonnegative(),
  })),
});

type Payment = ReconciliationRow["payments"][number];

async function fetchPayments(orderId: string): Promise<Payment[]> {
  const credentials = getRazorpayCredentials();
  const payments: Payment[] = [];

  // Razorpay paginates this collection. Never classify a partial collection
  // as having no captured payment.
  for (let page = 0; page < 10; page += 1) {
    const response = await razorpayRequest(
      `/orders/${encodeURIComponent(orderId)}/payments?count=100&skip=${page * 100}`,
      credentials,
      "GET",
    );
    const collection = razorpayPaymentsSchema.parse(response);

    payments.push(...collection.items.map((payment) => ({
      paymentId: payment.id,
      status: payment.status,
      amountPaise: payment.amount,
      method: payment.method,
      createdAt: new Date(payment.created_at * 1000),
    })));

    if (collection.items.length < 100) return payments;
  }

  throw new Error("Razorpay payment history exceeds the reconciliation lookup limit");
}

async function checkRecord(record: PendingRecord): Promise<ReconciliationRow> {
  if (!record.razorpayOrderId) {
    return {
      ...record,
      paymentCount: 0,
      payments: [],
      verdict: "lookup_error",
      detail: "This record has no Razorpay order ID. Review it manually.",
    };
  }

  try {
    const payments = await fetchPayments(record.razorpayOrderId);
    const captured = payments.filter((payment) => payment.status === "captured");
    const expectedPaise = Math.round(record.amount * 100);
    const common = { ...record, paymentCount: payments.length, payments };

    if (captured.some((payment) => payment.amountPaise === expectedPaise)) {
      return { ...common, verdict: "captured_not_credited" };
    }
    if (captured.length > 0) {
      return {
        ...common,
        verdict: "amount_mismatch",
        detail: `Expected ${expectedPaise} paise; captured payment amount differs.`,
      };
    }
    if (payments.some((payment) => payment.status === "authorized")) {
      return { ...common, verdict: "authorized_only" };
    }
    if (payments.length === 0) {
      return { ...common, verdict: "no_payment_attempt" };
    }
    if (payments.every((payment) => payment.status === "failed")) {
      return { ...common, verdict: "failed_only" };
    }

    // Created/refunded-only histories must not be misreported as "no money received".
    return {
      ...common,
      verdict: "lookup_error",
      detail: "Payment statuses do not fit an automatic verdict. Review the payment history manually.",
    };
  } catch (error) {
    console.error("Payment reconciliation lookup failed", {
      kind: record.kind,
      recordId: record.recordId,
      error,
    });
    return {
      ...record,
      paymentCount: 0,
      payments: [],
      verdict: "lookup_error",
      detail: "Could not fully read Razorpay payments. Check server logs and retry.",
    };
  }
}

async function checkWithLimitedConcurrency(
  records: PendingRecord[],
): Promise<ReconciliationRow[]> {
  const results: ReconciliationRow[] = [];

  for (let index = 0; index < records.length; index += 5) {
    const batch = records.slice(index, index + 5);
    results.push(...await Promise.all(batch.map(checkRecord)));
  }

  return results;
}

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);

    const [topups, proPayments, foodOrders, handledPayments] = await Promise.all([
      db.selectFrom("walletTransactions")
        .select(["id", "userId", "amount", "razorpayOrderId", "createdAt", "status"])
        .where("type", "=", "topup")
        .where("status", "=", "pending")
        .orderBy("createdAt", "desc")
        .limit(50)
        .execute(),
      db.selectFrom("subscriptionPayments")
        .select(["id", "restaurantId", "amount", "razorpayOrderId", "createdAt", "status"])
        .where("status", "=", "created")
        .orderBy("createdAt", "desc")
        .limit(50)
        .execute(),
      db.selectFrom("orders")
        .select(["id", "total", "razorpayOrderId", "status", "createdAt"])
        .where("paymentMethod", "=", "upi")
        .where("paymentStatus", "=", "pending")
        .orderBy("createdAt", "desc")
        .limit(50)
        .execute(),
      db.selectFrom("paymentReconciliations")
        .select([
          "id", "razorpayPaymentId", "razorpayOrderId", "kind", "recordId",
          "amountPaise", "action", "status", "razorpayRefundId", "reason",
          "error", "createdAt", "updatedAt",
        ])
        .orderBy((eb) =>
          eb.case()
            .when("status", "in", ["manual_review", "failed", "processing", "refund_failed"])
            .then(0)
            .else(1)
            .end(), "asc")
        .orderBy("createdAt", "desc")
        .limit(100)
        .execute(),
    ]);

    const records: PendingRecord[] = [
      ...topups.map((row) => ({
        kind: "wallet_topup" as const,
        recordId: row.id,
        userOrRestaurantId: row.userId,
        amount: row.amount,
        razorpayOrderId: row.razorpayOrderId,
        createdAt: row.createdAt,
        recordStatus: row.status,
      })),
      ...proPayments.map((row) => ({
        kind: "pro_payment" as const,
        recordId: row.id,
        userOrRestaurantId: row.restaurantId,
        amount: row.amount,
        razorpayOrderId: row.razorpayOrderId,
        createdAt: row.createdAt,
        recordStatus: row.status,
      })),
      ...foodOrders.map((row) => ({
        kind: "food_order" as const,
        recordId: row.id,
        userOrRestaurantId: null,
        amount: row.total,
        razorpayOrderId: row.razorpayOrderId,
        createdAt: row.createdAt,
        recordStatus: row.status,
      })),
    ];

    const checked = await checkWithLimitedConcurrency(records);

    return requireRole.json({
      checkedAt: new Date(),
      handledPayments,
      walletTopups: checked.filter((row) => row.kind === "wallet_topup"),
      proPayments: checked.filter((row) => row.kind === "pro_payment"),
      foodOrders: checked.filter((row) => row.kind === "food_order"),
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}