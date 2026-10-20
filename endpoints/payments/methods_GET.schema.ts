import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({}).strict();

export type PaymentMethodGroup = {
  id: "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater" | "cardless_emi";
  title: string;
  description: string;
  items: string[];
  count?: number;
};

export type OutputType = {
  source: "razorpay" | "default";
  groups: PaymentMethodGroup[];
};

export const getPaymentMethods = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit,
): Promise<OutputType> => {
  schema.parse(body);
  const result = await fetch("/_api/payments/methods", {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};