import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type { WalletTransactions } from "../../helpers/schema";

export const WALLET_LIMITS = {
  minTopup: 100,
  maxTopup: 5000,
  maxBalance: 10000,
  quickAmounts: [200, 500, 1000, 2000],
} as const;

export const schema = z.object({}).strict();

export type WalletTxnView = Pick<
  Selectable<WalletTransactions>,
  "id" | "type" | "status" | "amount" | "orderId" | "note" | "createdAt" | "completedAt"
>;

export type OutputType = {
  balance: number;
  limits: typeof WALLET_LIMITS;
  transactions: WalletTxnView[];
};

export const getWalletSummary = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit,
): Promise<OutputType> => {
  schema.parse(body);
  const result = await fetch("/_api/wallet/summary", {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};