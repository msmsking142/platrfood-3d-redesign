import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type OutputType = {
  checkedAt: Date;
  razorpayRoute: {
    status: "enabled" | "not_enabled" | "error" | "not_configured";
    detail: string;
  };
  riderPayouts: {
    status: "not_configured" | "configured";
    detail: string;
  };
  automatedTransfers: false;
};

export const getPayoutProviders = async (
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/admin/payout_providers", {
    ...init,
    method: "GET",
  });
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};