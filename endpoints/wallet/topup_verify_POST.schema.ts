import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  walletTxnId: z.number().int().positive(),
  razorpayOrderId: z.string().min(1).max(200),
  razorpayPaymentId: z.string().min(1).max(200),
  razorpaySignature: z.string().min(1).max(200),
}).strict();

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; balance: number };

export const postWalletTopupVerify = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/wallet/topup_verify", {
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