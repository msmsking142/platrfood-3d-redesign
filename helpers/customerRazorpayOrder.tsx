import { z } from "zod";
import type { PaymentDetails } from "../endpoints/customer/place_order_POST.schema";
import { getRazorpayCredentials, razorpayRequest } from "./razorpayProPayment";
import { HttpError } from "./requireRole";

const razorpayOrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
});

export async function createCustomerRazorpayOrder(
  orderId: number,
  total: number,
  receipt: string,
  prefill: PaymentDetails["prefill"],
): Promise<PaymentDetails> {
  const amount = total * 100;
  if (!Number.isSafeInteger(amount) || amount <= 0 || receipt.length > 40) {
    throw new HttpError(500, "The online payment amount or receipt is invalid");
  }

  const credentials = getRazorpayCredentials();
  const response = await razorpayRequest("/orders", credentials, "POST", {
    amount,
    currency: "INR",
    receipt,
    notes: {
      orderId: String(orderId),
      purpose: "zipto_food_order",
    },
  });

  const parsed = razorpayOrderSchema.safeParse(response);
  if (!parsed.success || parsed.data.amount !== amount) {
    throw new HttpError(502, "Razorpay returned an invalid payment order");
  }

  return {
    razorpayOrderId: parsed.data.id,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    keyId: credentials.keyId,
    prefill,
  };
}