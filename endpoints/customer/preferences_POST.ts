import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { customerEndpointErrorResponse } from "../../helpers/customerEndpointErrorResponse";
import { schema, type OutputType } from "./preferences_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, [
      "user",
      "admin",
      "restaurant",
      "rider",
    ]);
    const input = schema.parse(superjson.parse<unknown>(await request.text()));

    const preferences = await db
      .updateTable("users")
      .set({
        ...(input.vegMode !== undefined ? { vegMode: input.vegMode } : {}),
        ...(input.allowRestaurantCalls !== undefined
          ? { allowRestaurantCalls: input.allowRestaurantCalls }
          : {}),
      })
      .where("id", "=", user.id)
      .returning(["vegMode", "allowRestaurantCalls"])
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify(preferences satisfies OutputType),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return customerEndpointErrorResponse(error);
  }
}