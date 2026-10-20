import { z } from "zod";
import superjson from "superjson";
import type { PaymentDetails } from "./place_order_POST.schema";

export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), orderId: z.number().int().positive() }),
  z.object({ action: z.literal("retry_payment"), orderId: z.number().int().positive() }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; payment?: PaymentDetails };

export const postCustomerOrderAction = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/customer/order_action`, {
    method: "POST",
    body: superjson.stringify(v),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};