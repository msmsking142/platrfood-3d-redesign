import { z } from "zod";
import superjson from "superjson";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

export const schema = z.object({
  callId: z.string().uuid(),
  kind: z.enum([
    "accept",
    "decline",
    "hangup",
    "missed",
    "offer",
    "answer",
    "ice",
  ]),
  payload: jsonValueSchema.optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { ok: true };

export const postCallSignal = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/call/signal", {
    method: "POST",
    body: superjson.stringify(validatedInput),
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