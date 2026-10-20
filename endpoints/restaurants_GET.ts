import { db } from "../helpers/db";
import { schema, OutputType } from "./restaurants_GET.schema";
import { requireRole } from "../helpers/requireRole";
import { restaurantRatingAverage } from "../helpers/restaurantRating";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const { town, vegOnly } = schema.parse({
      town: url.searchParams.get("town"),
      vegOnly: url.searchParams.get("vegOnly") ?? undefined,
    });
    const rows = await db
      .selectFrom("restaurants")
      .leftJoin("menuItems", (j) =>
        j
          .onRef("menuItems.restaurantId", "=", "restaurants.id")
          .on("menuItems.isAvailable", "=", true)
      )
      .select((eb) => [
        "restaurants.id",
        "restaurants.name",
        "restaurants.description",
        "restaurants.cuisine",
        "restaurants.town",
        "restaurants.imageUrl",
        "restaurants.profileImageUrl",
        "restaurants.isOpen",
        "restaurants.avgPrepMinutes",
        "restaurants.ratingSum",
        "restaurants.ratingCount",
        eb.fn.count<number>("menuItems.id").as("itemCount"),
        eb.fn.count<number>("menuItems.id")
          .filterWhere("menuItems.isVeg", "=", true)
          .as("vegItemCount"),
      ])
      .where("restaurants.status", "=", "approved")
      .where("restaurants.town", "=", town)
      .groupBy("restaurants.id")
      .$if(vegOnly === true, (query) =>
        query.having(
          (eb) => eb.fn.count<number>("menuItems.id")
            .filterWhere("menuItems.isVeg", "=", true),
          ">",
          0,
        )
      )
      .orderBy("restaurants.isOpen", "desc")
      .orderBy("restaurants.name")
      .execute();
    const featuredDishes = await db.selectFrom("menuItems")
      .innerJoin("restaurants", "restaurants.id", "menuItems.restaurantId")
      .select(["menuItems.id", "menuItems.name", "menuItems.price", "menuItems.imageUrl", "menuItems.category", "menuItems.isVeg", "restaurants.id as restaurantId", "restaurants.name as restaurantName", "restaurants.town"])
      .where("restaurants.status", "=", "approved")
      .where("restaurants.isOpen", "=", true)
      .where("restaurants.town", "=", town)
      .where("menuItems.isAvailable", "=", true)
      .$if(vegOnly === true, (query) => query.where("menuItems.isVeg", "=", true))
      .orderBy((eb) => eb("menuItems.imageUrl", "is", null), "asc")
      .orderBy("menuItems.createdAt", "desc")
      .limit(12)
      .execute();
    return requireRole.json({
      restaurants: rows.map(({ ratingSum, ...restaurant }) => ({
        ...restaurant,
        ratingAverage: restaurantRatingAverage(ratingSum, restaurant.ratingCount),
        itemCount: Number(restaurant.itemCount),
        vegItemCount: Number(restaurant.vegItemCount),
      })),
      featuredDishes,
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}