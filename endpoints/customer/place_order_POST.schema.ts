import { z } from "zod";
import superjson from "superjson";
import type { CustomerQuote } from "./quote_POST.schema";

export const schema = z.object({
  restaurantId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1, "Cart is empty"),
  deliveryAddress: z.string().trim().min(8, "Please enter full address"),
  deliveryPhone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  orderFor: z.enum(["self", "other"]).default("self"),
  recipientName: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(300).optional(),
  deliveryLat: z.number({ required_error: "Please set your delivery location on the map" }).min(-90).max(90),
  deliveryLng: z.number({ required_error: "Please set your delivery location on the map" }).min(-180).max(180),
  expectedTotal: z.number().int().nonnegative(),
  paymentMethod: z.enum(["upi", "wallet"]),
}).superRefine((input, context) => {
  if (input.orderFor === "other" && (!input.recipientName || input.recipientName.length < 2)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recipientName"],
      message: "Enter the receiver's name",
    });
  }
});
export type InputType = z.input<typeof schema>;
export type PaymentDetails = {
  razorpayOrderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
  prefill: { name: string; email: string; contact: string };
};

export type OutputType = {
  orderId: number;
  total: number;
  payment?: PaymentDetails;
};

export class PriceChangedError extends Error {
  constructor(message: string, public readonly quote: CustomerQuote) {
    super(message);
    this.name = "PriceChangedError";
  }
}

export const postPlaceOrder = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/customer/place_order`, {
    method: "POST",
    body: superjson.stringify(v),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const e = superjson.parse<{
      error: string;
      code?: string;
      quote?: CustomerQuote;
    }>(await result.text());
    if (result.status === 409 && e.code === "PRICE_CHANGED" && e.quote) {
      throw new PriceChangedError(e.error, e.quote);
    }
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};