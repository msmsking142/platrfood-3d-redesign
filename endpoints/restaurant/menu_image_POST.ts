import superjson from "superjson";
import { upload } from "@floot/storage";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./menu_image_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const { db } = await import("../../helpers/db");
    const restaurant = await db.selectFrom("restaurants").select("id").where("ownerUserId", "=", user.id).executeTakeFirst();
    if (!restaurant) throw new HttpError(400, "Complete your restaurant profile first");
    const ext = input.contentType === "image/jpeg" ? "jpg" : input.contentType === "image/png" ? "png" : input.contentType === "image/avif" ? "avif" : "webp";
    const filename = `${input.kind}/${restaurant.id}/${crypto.randomUUID()}.${ext}`;
    const result = await upload({ visibility: "public", filename, contentType: input.contentType, sizeBytes: input.sizeBytes, ifAbsent: true });
    if (!result.ok) throw new HttpError(400, result.error.message);
    return requireRole.json({ presignedUrl: result.presignedUrl, url: result.url, headers: result.headers } satisfies OutputType);
  } catch (e) { return requireRole.errorResponse(e); }
}