import superjson from "superjson";
import { z } from "zod";

export const schema = z.object({
  filename: z.string().trim().min(1).max(120),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { presignedUrl: string; url: string; headers: Record<string, string> };
export const postFssaiUpload = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch("/_api/restaurant/fssai_upload", { method: "POST", body: superjson.stringify(schema.parse(body)), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!result.ok) { const e = superjson.parse<{ error: string }>(await result.text()); throw new Error(e.error); }
  return superjson.parse<OutputType>(await result.text());
};