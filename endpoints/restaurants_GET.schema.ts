import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  town: z.string().min(1),
  vegOnly: z.union([
    z.boolean(),
    z.enum(["1", "true", "0", "false"]).transform((value) => value === "1" || value === "true"),
  ]).optional(),
});
export type InputType = z.input<typeof schema>;
export type RestaurantCard = {
  id: number;
  name: string;
  description: string | null;
  cuisine: string | null;
  town: string;
  imageUrl: string | null;
  profileImageUrl: string | null;
  isOpen: boolean;
  avgPrepMinutes: number;
  itemCount: number;
  vegItemCount: number;
  ratingAverage: number | null;
  ratingCount: number;
};
export type OutputType = {
  restaurants: RestaurantCard[];
  featuredDishes: { id: number; name: string; price: number; imageUrl: string | null; category: string; isVeg: boolean; restaurantId: number; restaurantName: string; town: string }[];
};

export const getRestaurants = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(input);
  const result = await fetch(
    `/_api/restaurants?${new URLSearchParams({
      town: v.town,
      ...(v.vegOnly ? { vegOnly: "1" } : {}),
    })}`,
    { method: "GET", ...init }
  );
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};