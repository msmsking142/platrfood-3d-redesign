import { z } from "zod";
import superjson from "superjson";

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_documents"),
    licenceFile: z.string().min(1).max(300),
    selfieFile: z.string().min(1).max(300),
    vehicleType: z.enum(["Ebike", "Normal bike"]),
    vehicleNumber: z.string().trim().min(4).max(20),
    alternatePhone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit alternate phone number"),
    licenceExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accountHolder: z.string().trim().min(2).max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  }),
  z.object({
    action: z.literal("update_profile"),
    vehicleType: z.enum(["Ebike", "Normal bike"]),
    vehicleNumber: z.string().trim().min(4).max(20),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    alternatePhone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit alternate phone number"),
    licenceExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("update_payout_details"),
    accountHolder: z.string().trim().min(2).max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/).or(z.literal("")),
    ifsc: z.string().trim().toUpperCase()
      .pipe(z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).or(z.literal(""))),
    upiId: z.string().trim()
      .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/).or(z.literal("")),
  }),
  z.object({ action: z.literal("set_online"), isOnline: z.boolean() }),
  z.object({ action: z.literal("mark_admin_note_read") }),
  z.object({ action: z.literal("reply_admin_note"), reply: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("accept"), orderId: z.number().int() }),
  z.object({ action: z.literal("picked_up"), orderId: z.number().int() }),
  z.object({ action: z.literal("delivered"), orderId: z.number().int() }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postRiderAction = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/rider/action`, {
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