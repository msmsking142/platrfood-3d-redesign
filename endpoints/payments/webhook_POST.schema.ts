import { z } from "zod";
import superjson from "superjson";

// Razorpay supplies a signed raw event, not JSON matching this empty client input.
export const schema = z.object({}).strict();

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

// For server-side callers forwarding an already signed, raw Razorpay event.
// Never construct or sign a webhook in browser code.
export const postPaymentsWebhook = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  schema.parse(body);

  const headers = new Headers(init?.headers);
  if (
    typeof init?.body !== "string" ||
    !headers.get("x-razorpay-signature")
  ) {
    throw new Error("A raw, Razorpay-signed webhook body and signature are required");
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const result = await fetch("/_api/payments/webhook", {
    ...init,
    method: "POST",
    headers,
  });
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};