import { z } from "zod";
import superjson from "superjson";
import { WALLET_LIMITS } from "./summary_GET.schema";

export const schema = z.object({
  amount: z.number().int().min(WALLET_LIMITS.minTopup).max(WALLET_LIMITS.maxTopup),
}).strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  walletTxnId: number;
  payment: {
    razorpayOrderId: string;
    amount: number;
    currency: "INR";
    keyId: string;
    prefill: { name: string; email: string; contact: string };
  };
};

export const postWalletTopup = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/wallet/topup", {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
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
};