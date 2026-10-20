import { z } from "zod";
import superjson from "superjson";

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    ticketId: z.number().int().positive(),
    message: z.string().trim().min(1).max(8000),
    close: z.boolean().optional(),
  }).strict(),
  z.object({
    action: z.literal("status"),
    ticketId: z.number().int().positive(),
    status: z.enum(["open", "answered", "closed"]),
  }).strict(),
]);

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

export async function postAdminSupportAction(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/admin/support_action", {
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