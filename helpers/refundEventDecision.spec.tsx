import { refundEventDecision } from "./refundEventDecision";

describe("refundEventDecision", () => {
  const refund = {
    id: "rfnd_1",
    paymentId: "pay_1",
    amountPaise: 5000,
  };

  const order = {
    id: 12,
    total: 50,
    paymentStatus: "refunded" as const,
    razorpayPaymentId: "pay_1",
    razorpayRefundId: "rfnd_1",
    failedRazorpayRefundId: null,
  };

  const reconciliation = {
    status: "done" as const,
    razorpayRefundId: "rfnd_1",
    amountPaise: 5000,
  };

  it("routes matching reconciliation refunds and rejects amount mismatches", () => {
    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order,
        reconciliation,
      }),
    ).toEqual({ target: "reconciliation", action: "mark_failed" });

    expect(
      refundEventDecision({
        event: "refund.processed",
        refund,
        order,
        reconciliation,
      }),
    ).toEqual({ target: "reconciliation", action: "mark_processed" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund: { ...refund, amountPaise: 4999 },
        order,
        reconciliation,
      }),
    ).toEqual({ target: "reconciliation", action: "mismatch" });
  });

  it("never processes a reconciliation refund already marked failed", () => {
    const failed = { ...reconciliation, status: "refund_failed" as const };

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order,
        reconciliation: failed,
      }),
    ).toEqual({ target: "reconciliation", action: "already" });

    expect(
      refundEventDecision({
        event: "refund.processed",
        refund,
        order,
        reconciliation: failed,
      }),
    ).toEqual({ target: "reconciliation", action: "mismatch" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order,
        reconciliation: {
          ...reconciliation,
          status: "processing",
        },
      }),
    ).toEqual({ target: "reconciliation", action: "mismatch" });
  });

  it("reverses only a matching full-order failed refund", () => {
    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "mark_failed" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund: { ...refund, amountPaise: 1000 },
        order,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "mismatch" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund: { ...refund, id: "rfnd_other" },
        order,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "ignore" });
  });

  it("does not restore a failed order refund when a processed event arrives", () => {
    const previouslyFailed = {
      ...order,
      paymentStatus: "paid" as const,
      razorpayRefundId: null,
      failedRazorpayRefundId: refund.id,
    };

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order: previouslyFailed,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "already" });

    expect(
      refundEventDecision({
        event: "refund.processed",
        refund,
        order: previouslyFailed,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "mismatch" });
  });

  it("leaves ordinary processed orders to existing handling and ignores unrelated payments", () => {
    expect(
      refundEventDecision({
        event: "refund.processed",
        refund,
        order,
        reconciliation: null,
      }),
    ).toEqual({ target: "order", action: "existing_processed" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order: { ...order, razorpayPaymentId: "pay_other" },
        reconciliation: null,
      }),
    ).toEqual({ target: "none" });

    expect(
      refundEventDecision({
        event: "refund.failed",
        refund,
        order: null,
        reconciliation: null,
      }),
    ).toEqual({ target: "none" });
  });
});