import { z } from "zod";
import superjson from "superjson";
import type { CustomerAddress } from "./addresses_GET.schema";

export const addressFieldsSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]),
  address: z.string().trim().min(8, "Please enter a full address"),
  landmark: z.string().trim().max(120).optional(),
  town: z.string().trim().min(2, "Please enter a town"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  isDefault: z.boolean().optional(),
});

export const schema = z.discriminatedUnion("action", [
  addressFieldsSchema.extend({ action: z.literal("create") }),
  addressFieldsSchema.extend({
    action: z.literal("update"),
    id: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("delete"),
    id: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("set_default"),
    id: z.number().int().positive(),
  }),
]);

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; address?: CustomerAddress };

export async function postCustomerAddressAction(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const validated = schema.parse(body);
  const result = await fetch("/_api/customer/address_action", {
    ...init,
    method: "POST",
    body: superjson.stringify(validated),
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