import superjson from "superjson";
import { upload } from "@floot/storage";
import { db } from "../../helpers/db";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./document_upload_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["rider"]);
    const input = schema.parse(superjson.parse(await request.text()));

    const rider = await db
      .selectFrom("riders")
      .select("id")
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (!rider) throw new HttpError(404, "Rider profile not found");

    const ext =
      input.contentType === "application/pdf"
        ? "pdf"
        : input.contentType === "image/jpeg"
          ? "jpg"
          : input.contentType === "image/png"
            ? "png"
            : "webp";
    const filename = `rider-kyc/${user.id}/${input.kind}-${crypto.randomUUID()}.${ext}`;

    const result = await upload({
      visibility: "private",
      filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      ifAbsent: true,
      expiresInSeconds: 3600,
    });
    if (!result.ok) {
      console.error("Rider KYC upload presign failed:", result.error);
      throw new HttpError(400, result.error.message);
    }

    return requireRole.json({
      presignedUrl: result.presignedUrl,
      headers: result.headers,
      filename,
      previewUrl: result.url,
    } satisfies OutputType);
  } catch (error) {
    if (error instanceof HttpError) console.error("Rider KYC upload failed:", error);
    return requireRole.errorResponse(error);
  }
}