import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  formattedAddress: string | null;
  town: string | null;
};

export const postMapsReverseGeocode = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/maps/reverse_geocode", {
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