import { z } from "zod";
import superjson from "superjson";
import { adminPricingActionSchemas } from "../../helpers/adminPricingActionSchemas";

const approval = z.enum(["pending", "approved", "rejected", "suspended"]);
export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restaurant_status"), id: z.number().int(), status: approval }),
  z.object({ action: z.literal("fssai_verification"), id: z.number().int().positive(), status: z.enum(["verified", "review_required", "rejected"]), note: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("rider_manual_verification"), id: z.number().int().positive(), check: z.enum(["identity", "licence"]), status: z.enum(["verified", "review_required", "rejected"]), note: z.string().trim().min(3).max(300) }),
  z.object({
    action: z.literal("rider_status"),
    id: z.number().int(),
    status: approval,
    reason: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("rider_onboarding_note"), id: z.number().int().positive(), note: z.string().trim().max(300) }),
  z.object({ action: z.literal("admin_partner_note"), recipientRole: z.enum(["rider", "restaurant"]), recipientId: z.number().int().positive(), note: z.string().trim().max(1000) }),
  z.object({ action: z.literal("set_launch_mode"), launchMode: z.boolean() }),
  z.object({ action: z.literal("set_site_paused"), sitePaused: z.boolean() }),
  z.object({ action: z.literal("set_registration_permission"), role: z.enum(["user", "rider", "restaurant"]), enabled: z.boolean() }),
  z.object({
    action: z.literal("mark_payout_paid"),
    payoutId: z.number().int().positive(),
    utrReference: z.string().trim().min(4).max(60),
  }),
  z.object({
    action: z.literal("set_payout_hold"),
    payoutId: z.number().int().positive(),
    onHold: z.boolean(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal("run_payouts") }),
  z.object({
    action: z.literal("wallet_adjust"),
    userEmail: z.string().trim().email(),
    amount: z.number().int().min(-10000).max(10000).refine((amount) => amount !== 0, "Amount must not be zero"),
    note: z.string().trim().min(3).max(200),
  }),
  z.object({
    action: z.literal("payout_transition"),
    kind: z.enum(["restaurant", "rider"]),
    payoutId: z.number().int().positive(),
    to: z.enum(["approved", "processing", "paid", "failed", "on_hold", "pending"]),
    utrReference: z.string().trim().min(4).max(60).optional(),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("rider_adjustment"),
    riderId: z.number().int().positive(),
    amount: z.number().int().min(-5000).max(5000).refine((amount) => amount !== 0),
    note: z.string().trim().min(3).max(200),
  }),
  z.object({ action: z.literal("review_economics"), orderId: z.number().int().positive() }),
  z.object({ action: z.literal("retry_order_refund"), orderId: z.number().int().positive() }),
  z.object({
    action: z.literal("ca_answer"),
    questionNo: z.number().int().min(1).max(50),
    answer: z.string().max(4000),
  }),
  adminPricingActionSchemas.pricingSettings,
  adminPricingActionSchemas.serviceAreaUpsert,
  z.object({ action: z.literal("service_area_delete"), id: z.number().int().positive() }),
  z.object({ action: z.literal("profile_image_review"), id: z.number().int().positive(), decision: z.enum(["approve", "reject"]), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal("dish_image_review"), id: z.number().int().positive(), decision: z.enum(["approve", "reject"]), reason: z.string().max(200).optional() }),
  z.object({ action: z.literal("mark_paid"), orderId: z.number().int() }),
  z.object({ action: z.literal("cancel_order"), orderId: z.number().int(), reason: z.string().max(200).optional() }),
  z.object({
    action: z.literal("settings"),
    deliveryFee: z.number().int().min(0).max(500).optional(),
    platformFee: z.number().int().min(0).max(100).optional(),
    riderBonus: z.number().int().min(0).max(200),
    basicCommissionPercent: z.number().int().min(0).max(50),
    proCommissionPercent: z.number().int().min(0).max(50),
    proMonthlyFee: z.number().int().min(0).max(100000),
    upiId: z
      .string()
      .trim()
      .regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID like zipto@okaxis")
      .or(z.literal("")),
    upiPayeeName: z.string().trim().min(2).max(60),
    launchMode: z.boolean().optional(),
  }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postAdminAction = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/admin/action`, {
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