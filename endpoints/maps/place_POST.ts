import superjson from "superjson";
import { googleMaps } from "../../helpers/googleMaps";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./place_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["user", "admin", "restaurant", "rider"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const details = await googleMaps.placeDetails(
      input.placeId,
      input.sessionToken,
    );
    return requireRole.json(details satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}