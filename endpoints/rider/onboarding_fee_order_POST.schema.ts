import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({}).strict();
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  orderId: string;
  amount: number;
  baseAmountPaise: number;
  gstAmountPaise: number;
  gstPercent: number;
  currency: "INR";
  keyId: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
};

export async function postRiderOnboardingFeeOrder(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/rider/onboarding_fee_order", {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }

  return superjson.parse<OutputType>(await result.text());
}