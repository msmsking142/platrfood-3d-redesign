import superjson from "superjson";
import { z } from "zod";

export const schema = z
  .object({
    kind: z.enum(["licence", "selfie"]),
    contentType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  })
  .refine(
    (input) => input.kind !== "selfie" || input.contentType !== "application/pdf",
    { message: "Selfies must be images", path: ["contentType"] },
  );

export type InputType = z.infer<typeof schema>;
export type OutputType = {
  presignedUrl: string;
  headers: Record<string, string>;
  filename: string;
  previewUrl: string;
};

export const postDocumentUpload = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/rider/document_upload", {
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