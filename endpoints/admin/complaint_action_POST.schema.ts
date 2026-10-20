import { z } from "zod";
import superjson from "superjson";

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    complaintId: z.number().int().positive(),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    complaintId: z.number().int().positive(),
    note: z.string().trim().min(1).max(1000),
  }),
  z.object({
    action: z.literal("retry_refund"),
    complaintId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("settings"),
    limit: z.number().int().min(0).max(20),
    refundBps: z.number().int().min(0).max(10000),
    windowHours: z.number().int().min(1).max(168),
  }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; message: string };

export const postAdminComplaintAction = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/admin/complaint_action", {
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