import superjson from "superjson";
import { googleMaps } from "../../helpers/googleMaps";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./autocomplete_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["user", "admin", "restaurant", "rider"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const suggestions = await googleMaps.autocomplete(
      input.input,
      input.sessionToken,
    );
    return requireRole.json({ suggestions } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}