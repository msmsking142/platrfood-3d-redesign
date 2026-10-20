import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type { Users } from "../../helpers/schema";

export const schema = z
  .object({
    vegMode: z.boolean().optional(),
    allowRestaurantCalls: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.vegMode !== undefined ||
      value.allowRestaurantCalls !== undefined,
    "Provide at least one preference to update",
  );

export type InputType = z.infer<typeof schema>;
export type OutputType = Pick<
  Selectable<Users>,
  "vegMode" | "allowRestaurantCalls"
>;

export async function postCustomerPreferences(
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> {
  const validated = schema.parse(body);
  const result = await fetch("/_api/customer/preferences", {
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