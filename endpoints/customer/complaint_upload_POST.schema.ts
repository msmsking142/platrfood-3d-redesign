import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  presignedUrl: string;
  headers: Record<string, string>;
  filename: string;
  previewUrl: string;
};

export const postComplaintUpload = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/customer/complaint_upload", {
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