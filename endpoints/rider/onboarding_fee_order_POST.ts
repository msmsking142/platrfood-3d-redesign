import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { riderOnboardingFee } from "../../helpers/riderOnboardingFee";
import { HttpError, requireRole } from "../../helpers/requireRole";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { schema, type OutputType } from "./onboarding_fee_order_POST.schema";

const razorpayOrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
});

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["rider"]);
    schema.parse(superjson.parse(await request.text()));

    const rider = await db
      .selectFrom("riders")
      .select(["id", "phone", "onboardingFeePaidAt"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!rider) {
      throw new HttpError(400, "Complete your rider profile first");
    }
    if (rider.onboardingFeePaidAt) {
      throw new HttpError(409, "Onboarding fee already paid");
    }

    const fee = await riderOnboardingFee.computeFee();
    const credentials = getRazorpayCredentials();
    const receipt = `zipto-rfee-${rider.id}-${Date.now()}`;

    if (receipt.length > 40) {
      throw new HttpError(500, "Could not generate a valid payment receipt");
    }

    const response = await razorpayRequest("/orders", credentials, "POST", {
      amount: fee.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        purpose: "zipto_rider_onboarding",
        riderId: String(rider.id),
        baseAmountPaise: String(fee.baseAmountPaise),
        gstAmountPaise: String(fee.gstAmountPaise),
      },
    });

    const parsed = razorpayOrderSchema.safeParse(response);
    if (
      !parsed.success ||
      parsed.data.amount !== fee.amountPaise ||
      parsed.data.currency !== "INR"
    ) {
      throw new HttpError(502, "Razorpay returned an invalid order");
    }

    await db
      .insertInto("riderOnboardingPayments")
      .values({
        riderId: rider.id,
        razorpayOrderId: parsed.data.id,
        baseAmountPaise: fee.baseAmountPaise,
        gstAmountPaise: fee.gstAmountPaise,
        amountPaise: fee.amountPaise,
        status: "created",
      })
      .execute();

    return requireRole.json({
      orderId: parsed.data.id,
      amount: parsed.data.amount,
      baseAmountPaise: fee.baseAmountPaise,
      gstAmountPaise: fee.gstAmountPaise,
      gstPercent: fee.gstPercent,
      currency: parsed.data.currency,
      keyId: credentials.keyId,
      prefill: {
        name: user.displayName,
        email: user.email,
        contact: rider.phone,
      },
    } satisfies OutputType);
  } catch (error) {
    console.error("Rider onboarding fee order failed:", error);
    return requireRole.errorResponse(
      error instanceof HttpError || error instanceof z.ZodError
        ? error
        : new HttpError(500, "Could not create the onboarding fee payment order"),
    );
  }
}