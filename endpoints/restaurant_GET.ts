import { db } from "../helpers/db";
import { schema, OutputType } from "./restaurant_GET.schema";
import { requireRole, HttpError } from "../helpers/requireRole";
import { restaurantRatingAverage } from "../helpers/restaurantRating";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const { id } = schema.parse({ id: url.searchParams.get("id") });
    const restaurant = await db
      .selectFrom("restaurants")
      .select([
        "id",
        "name",
        "description",
        "cuisine",
        "town",
        "address",
        "imageUrl",
        "profileImageUrl",
        "isOpen",
        "avgPrepMinutes",
        "ratingSum",
        "ratingCount",
      ])
      .where("id", "=", id)
      .where("status", "=", "approved")
      .executeTakeFirst();
    if (!restaurant) throw new HttpError(404, "Restaurant not found");
    const { ratingSum, ...publicRestaurant } = restaurant;
    const menu = await db
      .selectFrom("menuItems")
      .select(["id", "name", "description", "category", "price", "isVeg", "imageUrl"])
      .where("restaurantId", "=", id)
      .where("isAvailable", "=", true)
      .orderBy("category")
      .orderBy("name")
      .execute();
    return requireRole.json({
      restaurant: {
        ...publicRestaurant,
        ratingAverage: restaurantRatingAverage(ratingSum, restaurant.ratingCount),
      },
      menu,
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}