import { z } from "zod";
import superjson from "superjson";

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    riderSearchRadiusM: z.number().int().min(500).max(30000),
    riderSearchExpandedRadiusM: z.number().int().min(500).max(50000),
    riderSearchExpandAfterMin: z.number().int().min(1).max(30),
    riderSearchReadyWindowMin: z.number().int().min(5).max(10),
    riderSearchMaxMin: z.number().int().min(10).max(120),
    riderSearchIncentiveEnabled: z.boolean(),
    riderSearchIncentiveAmount: z.number().int().min(0).max(200),
    riderSearchIncentiveCap: z.number().int().min(0).max(300),
    deliveryFailureCompEnabled: z.boolean(),
    deliveryFailureCompBps: z.number().int().min(0).max(10000),
    deliveryFailureCompMin: z.number().int().min(0).max(5000),
    deliveryFailureCompMax: z.number().int().min(0).max(5000),
    deliveryFailurePrepGraceMin: z.number().int().min(0).max(60),
    areaPauseEnabled: z.boolean(),
    areaPauseFailureThreshold: z.number().int().min(1).max(50),
    areaPauseLookbackMin: z.number().int().min(10).max(1440),
    areaPauseDurationMin: z.number().int().min(5).max(1440),
    areaPauseWhenNoRiders: z.boolean(),
  }),
  z.object({
    action: z.literal("compensation_decision"),
    compensationId: z.number().int().positive(),
    decision: z.enum(["approve", "reject", "revoke"]),
    amount: z.number().int().min(0).max(5000).optional(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("resume_area"),
    town: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("pause_area"),
    town: z.string().trim().min(1).max(200),
    minutes: z.number().int().min(5).max(1440),
    reason: z.string().trim().min(3).max(200),
  }),
  z.object({
    action: z.literal("retry_refund"),
    orderId: z.number().int().positive(),
  }),
]);

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; message: string };

export async function postAdminDeliveryProtectionAction(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const response = await fetch("/_api/admin/delivery_protection_action", {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await response.text());
}