import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(320),
  category: z.string().trim().min(1).max(60),
  orderId: z.number().int().positive().optional(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(4000),
}).strict();

export type InputType = z.infer<typeof schema>;
export type OutputType = { ticketId: number };

export async function postSupportTicket(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/support/ticket", {
    ...init,
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
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