import superjson from "superjson";
import { upload } from "@floot/storage";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./fssai_upload_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType === "image/jpeg" ? "jpg" : "png";
    const result = await upload({ visibility: "public", filename: `fssai/${user.id}/${crypto.randomUUID()}.${ext}`, contentType: input.contentType, sizeBytes: input.sizeBytes, ifAbsent: true });
    if (!result.ok) throw new HttpError(400, result.error.message);
    return requireRole.json({ presignedUrl: result.presignedUrl, url: result.url, headers: result.headers } satisfies OutputType);
  } catch (e) { return requireRole.errorResponse(e); }
}