import {
  paymentReconciliationDecision,
  type PaymentReconciliationInput,
} from "./paymentReconciliationDecision";

type FoodInput = Extract<PaymentReconciliationInput, { kind: "food_order" }>;
type WalletInput = Extract<PaymentReconciliationInput, { kind: "wallet_topup" }>;
type ProInput = Extract<PaymentReconciliationInput, { kind: "pro_payment" }>;

const food: FoodInput = {
  kind: "food_order",
  paymentId: "pay_new",
  paymentOrderId: "order_current",
  amountPaise: 50000,
  currency: "INR",
  order: {
    total: 500,
    razorpayOrderId: "order_current",
    razorpayPaymentId: null,
    paymentStatus: "pending",
    status: "placed",
    paymentMethod: "upi",
  },
  supersededOrderCheck: null,
};

const wallet: WalletInput = {
  kind: "wallet_topup",
  paymentId: "pay_new",
  paymentOrderId: "order_wallet",
  amountPaise: 50000,
  currency: "INR",
  txn: {
    amount: 500,
    status: "pending",
    razorpayOrderId: "order_wallet",
    razorpayPaymentId: null,
  },
};

const pro: ProInput = {
  kind: "pro_payment",
  paymentId: "pay_new",
  paymentOrderId: "order_pro",
  amountPaise: 294900,
  currency: "INR",
  payment: { amount: 2949, status: "created", razorpayPaymentId: null },
};

describe("paymentReconciliationDecision", () => {
  it("requires a verifiable food order, payment method, currency and amount", () => {
    const cases: FoodInput[] = [
      { ...food, order: null },
      { ...food, order: { ...food.order!, paymentMethod: "wallet" } },
      { ...food, currency: "USD" },
      { ...food, amountPaise: 49900 },
    ];
    for (const input of cases) {
      expect(paymentReconciliationDecision(input).action).toBe("manual_review");
    }
  });

  it("recognizes the recorded food payment and applies a current pending payment", () => {
    expect(paymentReconciliationDecision({
      ...food,
      order: { ...food.order!, razorpayPaymentId: "pay_new", paymentStatus: "paid" },
    }).action).toBe("already_applied");
    expect(paymentReconciliationDecision(food).action).toBe("apply");
    expect(paymentReconciliationDecision({
      ...food,
      order: { ...food.order!, status: "cancelled" },
    }).action).toBe("apply");
    expect(paymentReconciliationDecision({
      ...food,
      order: { ...food.order!, status: "rejected" },
    }).action).toBe("apply");
  });

  it("refunds different payments on paid or closed current food orders", () => {
    expect(paymentReconciliationDecision({
      ...food,
      order: { ...food.order!, paymentStatus: "paid", razorpayPaymentId: "pay_other" },
    }).action).toBe("refund_duplicate");
    for (const order of [
      { ...food.order!, paymentStatus: "refunded" as const },
      { ...food.order!, paymentStatus: "paid" as const, status: "cancelled" as const, razorpayPaymentId: "pay_other" },
      { ...food.order!, paymentStatus: "paid" as const, status: "rejected" as const, razorpayPaymentId: "pay_other" },
    ]) {
      expect(paymentReconciliationDecision({ ...food, order }).action).toBe("refund_late");
    }
  });

  it("accepts only a verified superseded food order while payment is pending", () => {
    const old: FoodInput = {
      ...food,
      paymentOrderId: "order_old",
      supersededOrderCheck: { belongsToOrder: true, amountPaise: 50000 },
    };
    expect(paymentReconciliationDecision(old).action).toBe("accept_superseded");
    for (const supersededOrderCheck of [
      null,
      { belongsToOrder: false, amountPaise: 50000 },
      { belongsToOrder: true, amountPaise: 49900 },
    ]) {
      expect(paymentReconciliationDecision({
        ...old,
        supersededOrderCheck,
      }).action).toBe("manual_review");
    }
    expect(paymentReconciliationDecision({
      ...old,
      order: { ...food.order!, paymentStatus: "paid", razorpayPaymentId: "pay_other" },
    }).action).toBe("refund_duplicate");
    expect(paymentReconciliationDecision({
      ...old,
      order: { ...food.order!, status: "cancelled" },
    }).action).toBe("refund_late");
    expect(paymentReconciliationDecision({
      ...old,
      order: { ...food.order!, paymentStatus: "refunded" },
    }).action).toBe("refund_late");
  });

  it("checks wallet identity before applying, refunding or reviewing", () => {
    for (const input of [
      { ...wallet, txn: null },
      { ...wallet, currency: "USD" },
      { ...wallet, amountPaise: 49900 },
      { ...wallet, txn: { ...wallet.txn!, razorpayOrderId: "order_other" } },
    ]) {
      expect(paymentReconciliationDecision(input).action).toBe("manual_review");
    }
    expect(paymentReconciliationDecision(wallet).action).toBe("apply");
    expect(paymentReconciliationDecision({
      ...wallet,
      txn: { ...wallet.txn!, status: "success", razorpayPaymentId: "pay_new" },
    }).action).toBe("already_applied");
    expect(paymentReconciliationDecision({
      ...wallet,
      txn: { ...wallet.txn!, status: "success", razorpayPaymentId: "pay_other" },
    }).action).toBe("refund_duplicate");
    expect(paymentReconciliationDecision({
      ...wallet,
      txn: { ...wallet.txn!, status: "failed" },
    }).action).toBe("refund_late");
  });

  it("checks Pro identity and preserves application of created or failed payments", () => {
    for (const input of [
      { ...pro, payment: null },
      { ...pro, currency: "USD" },
      { ...pro, amountPaise: 294800 },
    ]) {
      expect(paymentReconciliationDecision(input).action).toBe("manual_review");
    }
    expect(paymentReconciliationDecision(pro).action).toBe("apply");
    expect(paymentReconciliationDecision({
      ...pro,
      payment: { ...pro.payment!, status: "failed" },
    }).action).toBe("apply");
    expect(paymentReconciliationDecision({
      ...pro,
      payment: { ...pro.payment!, status: "paid", razorpayPaymentId: "pay_new" },
    }).action).toBe("already_applied");
    expect(paymentReconciliationDecision({
      ...pro,
      payment: { ...pro.payment!, status: "paid", razorpayPaymentId: "pay_other" },
    }).action).toBe("refund_duplicate");
  });
});