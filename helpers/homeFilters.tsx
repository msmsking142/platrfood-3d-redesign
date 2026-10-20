import type { OutputType } from "../endpoints/restaurants_GET.schema";

export const homeCategories = [
  {
    label: "Biryani",
    image: "/_cdn/static/693d2597-68e6-480c-b757-a738e9016739.png",
    terms: ["biryani"],
  },
  {
    label: "Pizza",
    image: "/_cdn/static/da3904a6-d5c1-40b1-a5b2-a10b599a80b3.png",
    terms: ["pizza"],
  },
  {
    label: "North Indian",
    image: "/_cdn/static/c674807f-efab-4850-a65b-72cdc122f60d.png",
    terms: ["north indian", "punjabi", "thali", "paneer", "dal"],
  },
  {
    label: "Burgers",
    image: "/_cdn/static/636a864b-0600-4548-b403-a655e0cd84c6.png",
    terms: ["burger"],
  },
  {
    label: "Chinese",
    image: "/_cdn/static/64e7d1a3-0a1f-4f20-afa3-b3a124e87133.png",
    terms: ["chinese"],
  },
] as const;

export function filterHomeListings(
  data: OutputType | undefined,
  search: string,
  category: (typeof homeCategories)[number] | null,
) {
  const term = search.trim().toLocaleLowerCase();
  const matchesCategory = (text: string) =>
    !category || category.terms.some((word) => text.includes(word));

  return {
    restaurants: (data?.restaurants ?? []).filter((restaurant) => {
      const text = [
        restaurant.name,
        restaurant.cuisine,
        restaurant.description,
      ].filter(Boolean).join(" ").toLocaleLowerCase();

      return (!term || text.includes(term)) && matchesCategory(text);
    }),
    featuredDishes: (data?.featuredDishes ?? []).filter((dish) => {
      const text = `${dish.name} ${dish.restaurantName}`.toLocaleLowerCase();
      return (!term || text.includes(term)) && matchesCategory(text);
    }),
  };
}