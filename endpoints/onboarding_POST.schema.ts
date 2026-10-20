import { z } from "zod";
import superjson from "superjson";
import { fssaiDocumentUrl } from "../helpers/fssaiDocumentUrl";

const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");
export const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("restaurant"),
    name: z.string().trim().min(2, "Restaurant name is required"),
    description: z.string().trim().max(300).optional(),
    cuisine: z.string().trim().max(80).optional(),
    town: z.string().min(1, "Choose your town"),
    address: z.string().trim().min(8, "Enter full address"),
    phone,
    plan: z.enum(["basic", "pro"]),
    fssaiDocumentUrl,
    fssaiLicenseNumber: z.string().trim().regex(/^\d{14}$/, "FSSAI number must contain 14 digits"),
    fssaiExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the licence expiry date"),
  }),
  z.object({
    kind: z.literal("rider"),
    town: z.string().min(1, "Choose your town"),
    phone,
    vehicleType: z.string().min(1, "Choose vehicle"),
    vehicleNumber: z.string().trim().max(20).optional(),
  }),
]);
export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true };

export const postOnboarding = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(body);
  const result = await fetch(`/_api/onboarding`, {
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