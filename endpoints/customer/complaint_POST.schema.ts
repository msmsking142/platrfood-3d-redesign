import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.number().int().positive(),
  reason: z.enum([
    "quality", "wrong_item", "missing_item", "hygiene", "stale", "other",
  ]),
  description: z.string().trim().min(10).max(1000),
  imageFiles: z.array(z.string().min(1).max(500)).min(1).max(3),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  status: "pending" | "feedback_only";
  message: string;
};

export const postCustomerComplaint = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/customer/complaint", {
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