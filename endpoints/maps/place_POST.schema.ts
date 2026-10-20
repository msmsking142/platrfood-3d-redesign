import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  placeId: z.string().trim().min(1).max(300),
  sessionToken: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  lat: number;
  lng: number;
  formattedAddress: string;
  town: string | null;
};

export const postMapsPlace = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/maps/place", {
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
    throw Object.assign(new Error(error.error), { status: result.status });
  }
  return superjson.parse<OutputType>(await result.text());
};