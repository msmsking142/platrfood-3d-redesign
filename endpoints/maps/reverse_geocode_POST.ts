import superjson from "superjson";
import { googleMaps } from "../../helpers/googleMaps";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./reverse_geocode_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["user", "admin", "restaurant", "rider"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const address = await googleMaps.reverseGeocode(input.lat, input.lng);

    return requireRole.json({
      formattedAddress: address?.formattedAddress ?? null,
      town: address?.town ?? null,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}