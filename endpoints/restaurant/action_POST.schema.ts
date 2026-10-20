import { z } from "zod";
import superjson from "superjson";
import { deliveryPricing } from "../../helpers/deliveryPricing";
import { fssaiDocumentUrl } from "../../helpers/fssaiDocumentUrl";

export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_open"), isOpen: z.boolean() }),
  z.object({ action: z.literal("set_plan"), plan: z.enum(["basic", "pro"]) }),
  z.object({ action: z.literal("start_pro_trial"), consent: z.literal(true) }),
  z.object({ action: z.literal("cancel_pro_trial") }),
  z.object({ action: z.literal("mark_admin_note_read") }),
  z.object({ action: z.literal("reply_admin_note"), reply: z.string().trim().min(1).max(1000) }),
  z.object({
    action: z.literal("update_payout_details"),
    accountHolder: z.string().trim().min(2).max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/).or(z.literal("")),
    ifsc: z.string().trim().toUpperCase()
      .pipe(z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).or(z.literal(""))),
    upiId: z.string().trim()
      .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/).or(z.literal("")),
    // Blank or omitted leaves an existing PAN unchanged.
    pan: z.string().trim().toUpperCase()
      .refine((pan) => pan === "" || deliveryPricing.isValidPan(pan), "Invalid PAN")
      .optional(),
  }),
  z.object({ action: z.literal("update_fssai"), fssaiDocumentUrl, fssaiLicenseNumber: z.string().trim().regex(/^\d{14}$/, "FSSAI number must contain 14 digits"), fssaiExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal("set_prep"), avgPrepMinutes: z.number().int().min(5).max(120) }),
  z.object({
    action: z.literal("set_location"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  z.object({
    action: z.literal("update_outlet"),
    description: z.string().trim().max(300).optional(),
    cuisine: z.string().trim().max(80).optional(),
    address: z.string().trim().min(8, "Enter full address").max(300),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  }),
  z.object({
    action: z.literal("save_item"),
    id: z.number().int().optional(),
    name: z.string().trim().min(2, "Item name is required"),
    description: z.string().trim().max(200).optional(),
    category: z.string().trim().min(1).max(40),
    price: z.number().int().min(1, "Price must be at least ₹1").max(100000),
    imageUrl: z.string().max(2000).optional().nullable(),
    isVeg: z.boolean(),
    isAvailable: z.boolean(),
  }),
  z.object({ action: z.literal("delete_item"), id: z.number().int() }),
  z.object({ action: z.literal("toggle_item"), id: z.number().int(), isAvailable: z.boolean() }),
  z.object({ action: z.literal("submit_profile_image"), imageUrl: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("cancel_profile_image") }),
  z.object({
    action: z.literal("dispute_compensation"),
    orderId: z.number().int().positive(),
    note: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("order"),
    orderId: z.number().int(),
    to: z.enum(["accepted", "preparing", "ready", "rejected"]),
    reason: z.string().max(200).optional(),
  }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postRestaurantAction = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/restaurant/action`, {
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