// BACKEND ONLY. Rider onboarding fee pricing and payment recording.
import { db } from "./db";
import { HttpError } from "./requireRole";

export type RiderOnboardingFeeAmount = {
  baseAmountPaise: number;
  gstAmountPaise: number;
  amountPaise: number;
  gstPercent: number;
  baseRupees: number;
};

export async function computeFee(): Promise<RiderOnboardingFeeAmount> {
  const settings = await db
    .selectFrom("appSettings")
    .select(["riderOnboardingFee", "commissionGstBps"])
    .orderBy("id", "asc")
    .executeTakeFirst();

  if (!settings) {
    throw new HttpError(503, "Rider onboarding fee is not configured");
  }

  const baseRupees = settings.riderOnboardingFee;
  const gstBps = settings.commissionGstBps;
  const baseAmountPaise = baseRupees * 100;
  const gstAmountPaise = Math.round((baseAmountPaise * gstBps) / 10000);
  const amountPaise = baseAmountPaise + gstAmountPaise;

  if (
    !Number.isSafeInteger(baseRupees) ||
    baseRupees <= 0 ||
    !Number.isSafeInteger(gstBps) ||
    gstBps < 0 ||
    !Number.isSafeInteger(baseAmountPaise) ||
    !Number.isSafeInteger(gstAmountPaise) ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new HttpError(500, "Rider onboarding fee or GST rate is not configured correctly");
  }

  return {
    baseAmountPaise,
    gstAmountPaise,
    amountPaise,
    gstPercent: gstBps / 100,
    baseRupees,
  };
}

export async function recordPaid(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
}): Promise<number | null> {
  return db.transaction().execute(async (trx) => {
    const payment = await trx
      .selectFrom("riderOnboardingPayments")
      .select(["id", "riderId", "status", "amountPaise"])
      .where("razorpayOrderId", "=", input.razorpayOrderId)
      .forUpdate()
      .executeTakeFirst();

    if (!payment) return null;
    if (payment.status === "paid") return payment.riderId;

    if (payment.amountPaise !== input.amountPaise) {
      throw new HttpError(400, "Payment amount does not match the onboarding fee order");
    }

    // Serialize payments for the same rider, even when they have different orders.
    const rider = await trx
      .selectFrom("riders")
      .select(["id", "onboardingFeePaidAt"])
      .where("id", "=", payment.riderId)
      .forUpdate()
      .executeTakeFirst();

    if (!rider) {
      throw new HttpError(404, "Rider profile not found");
    }

    if (rider.onboardingFeePaidAt) {
      console.error("Additional captured rider onboarding payment requires review:", {
        riderId: rider.id,
        razorpayOrderId: input.razorpayOrderId,
      });
      throw new HttpError(
        409,
        "An onboarding fee was already paid for this rider. Contact support about this payment.",
      );
    }

    const now = new Date();
    const updated = await trx
      .updateTable("riderOnboardingPayments")
      .set({
        status: "paid",
        razorpayPaymentId: input.razorpayPaymentId,
        paidAt: now,
      })
      .where("id", "=", payment.id)
      .where("status", "!=", "paid")
      .returning("id")
      .executeTakeFirst();

    if (!updated) {
      throw new HttpError(409, "Onboarding payment changed during verification");
    }

    await trx
      .updateTable("riders")
      .set({ onboardingFeePaidAt: now })
      .where("id", "=", rider.id)
      .where("onboardingFeePaidAt", "is", null)
      .execute();

    return rider.id;
  });
}

export const riderOnboardingFee = { computeFee, recordPaid };