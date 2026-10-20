import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  password: z.string().min(1),
  confirmText: z.literal("DELETE"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  retained: string[];
};

export const postAccountDelete = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/account/delete", {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }

  return superjson.parse<OutputType>(await result.text());
};