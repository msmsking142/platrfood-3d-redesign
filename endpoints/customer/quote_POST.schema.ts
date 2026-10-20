import { z } from "zod";
import superjson from "superjson";

import type {
  DistanceSource,
  PricingLineItem,
} from "../../helpers/deliveryPricing";

export const schema = z.object({
  restaurantId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1, "Cart is empty"),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  paymentMethod: z.enum(["upi", "wallet"]).default("upi"),
});

export type InputType = z.input<typeof schema>;

export type CustomerQuote = {
  itemsTotal: number;
  total: number;
  lineItems: PricingLineItem[];
  distanceM: number;
  distanceSource: DistanceSource;
  outOfRange: boolean;
  maxDeliveryKm: number;
  serviceAvailable: boolean;
  unavailableReason?: string | null;
  platformFee: number;
  quotedAt: Date;
};

export type OutputType = CustomerQuote;

export const postCustomerQuote = async (
  body: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/customer/quote", {
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