import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { customerEndpointErrorResponse } from "../../helpers/customerEndpointErrorResponse";
import { schema, type OutputType } from "./addresses_GET.schema";

export async function handle(request: Request) {
  try {
    schema.parse({});
    const user = await requireRole(request, ["user", "admin"]);

    const addresses = await db
      .selectFrom("customerAddresses")
      .select([
        "id",
        "label",
        "address",
        "landmark",
        "town",
        "lat",
        "lng",
        "phone",
        "isDefault",
      ])
      .where("userId", "=", user.id)
      .orderBy("isDefault", "desc")
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .execute();

    return new Response(
      superjson.stringify({ addresses } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return customerEndpointErrorResponse(error);
  }
}