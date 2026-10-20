import superjson from "superjson";
import { upload } from "@floot/storage";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./complaint_upload_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const extension = input.contentType === "image/jpeg"
      ? "jpg"
      : input.contentType === "image/png" ? "png" : "webp";
    const filename = `food-complaints/${user.id}/${crypto.randomUUID()}.${extension}`;

    const result = await upload({
      visibility: "private",
      filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      ifAbsent: true,
      expiresInSeconds: 3600,
    });
    if (!result.ok) {
      console.error("Complaint photo presign failed:", result.error);
      throw new HttpError(400, result.error.message);
    }

    return requireRole.json({
      presignedUrl: result.presignedUrl,
      headers: result.headers,
      filename,
      previewUrl: result.url,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}