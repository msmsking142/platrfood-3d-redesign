import { z } from "zod";
import superjson from "superjson";

const filenameSchema = z
  .string()
  .regex(
    /^avatars\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/,
    "Invalid avatar filename",
  );

export const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("presign"),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  }).strict(),
  z.object({
    action: z.literal("save"),
    filename: filenameSchema,
  }).strict(),
  z.object({
    action: z.literal("remove"),
  }).strict(),
]);

export type InputType = z.infer<typeof schema>;
export type PresignOutput = {
  presignedUrl: string;
  headers: Record<string, string>;
  filename: string;
};
export type SaveOutput = { avatarUrl: string };
export type RemoveOutput = { avatarUrl: null };
export type OutputType = PresignOutput | SaveOutput | RemoveOutput;

export function postCustomerAvatar(
  body: Extract<InputType, { action: "presign" }>,
  init?: RequestInit,
): Promise<PresignOutput>;
export function postCustomerAvatar(
  body: Extract<InputType, { action: "save" }>,
  init?: RequestInit,
): Promise<SaveOutput>;
export function postCustomerAvatar(
  body: Extract<InputType, { action: "remove" }>,
  init?: RequestInit,
): Promise<RemoveOutput>;
export async function postCustomerAvatar(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/customer/avatar", {
    ...init,
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
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