import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  prompt: z.string().optional().default(
    "Namaste! Introduce yourself in one sentence."
  ),
});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  model: string;
  reply: string;
};

export const postSarvamTestChat = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/sarvam/test_chat", {
    method: "POST",
    ...init,
    body: superjson.stringify(validatedInput),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};