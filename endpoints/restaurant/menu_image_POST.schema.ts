import superjson from "superjson";
import { z } from "zod";

export const schema = z.object({ filename: z.string().trim().min(1).max(100), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]), sizeBytes: z.number().int().positive().max(8 * 1024 * 1024), kind: z.enum(["menu", "profile"]).default("menu") });
export type InputType = z.infer<typeof schema>;
export type OutputType = { presignedUrl: string; url: string; headers: Record<string, string> };
export const postMenuImageUpload = async (body: z.input<typeof schema>, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch("/_api/restaurant/menu_image", { method: "POST", body: superjson.stringify(schema.parse(body)), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!result.ok) { const e = superjson.parse<{ error: string }>(await result.text()); throw new Error(e.error); }
  return superjson.parse<OutputType>(await result.text());
};