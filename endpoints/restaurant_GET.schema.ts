import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ id: z.coerce.number().int().positive() });
export type InputType = z.infer<typeof schema>;
export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  isVeg: boolean;
  imageUrl: string | null;
};
export type OutputType = {
  restaurant: {
    id: number;
    name: string;
    description: string | null;
    cuisine: string | null;
    town: string;
    address: string;
    imageUrl: string | null;
    profileImageUrl: string | null;
    isOpen: boolean;
    avgPrepMinutes: number;
    ratingAverage: number | null;
    ratingCount: number;
  };
  menu: MenuItem[];
};

export const getRestaurant = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const v = schema.parse(input);
  const result = await fetch(
    `/_api/restaurant?${new URLSearchParams({ id: String(v.id) })}`,
    { method: "GET", ...init }
  );
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};