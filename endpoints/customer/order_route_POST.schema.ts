import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  orderId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type LiveOrderRoute = {
  target: "restaurant" | "destination";
  encodedPolyline: string | null;
  distanceM: number | null;
  durationS: number | null;
  legToRestaurantS: number | null;
  computedAt: Date | null;
  originLat: number | null;
  originLng: number | null;
  stale: boolean;
  available: boolean;
};

export type OutputType =
  | { route: LiveOrderRoute; reason: null }
  | {
      route: null;
      reason: "not_tracking" | "no_rider" | "no_location";
    };

export const postCustomerOrderRoute = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/customer/order_route", {
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