import superjson from "superjson";
import { getInfo, getUrl, remove, upload } from "@floot/storage";
import { db } from "../../helpers/db";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./avatar_POST.schema";

const avatarFilenamePattern =
  /^avatars\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

function previousAvatarFilename(
  avatarUrl: string | null,
  userId: number,
): string | null {
  if (!avatarUrl) return null;

  try {
    const pathname = decodeURIComponent(
      new URL(avatarUrl, "https://www.platrfood.co.in").pathname,
    );
    const folder = `/avatars/${userId}/`;
    const folderIndex = pathname.lastIndexOf(folder);
    if (folderIndex < 0) return null;

    const filename = pathname.slice(folderIndex + 1);
    return avatarFilenamePattern.test(filename) ? filename : null;
  } catch (error) {
    console.error("Could not inspect previous avatar URL:", error);
    return null;
  }
}

async function removePreviousAvatar(
  avatarUrl: string | null,
  userId: number,
): Promise<void> {
  const filename = previousAvatarFilename(avatarUrl, userId);
  if (!filename) return;

  try {
    const result = await remove({ visibility: "public", filename });
    if (!result.ok) {
      console.error("Previous avatar removal failed:", result.error);
    }
  } catch (error) {
    console.error("Previous avatar removal failed:", error);
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, [
      "user",
      "admin",
      "restaurant",
      "rider",
    ]);
    const input = schema.parse(superjson.parse(await request.text()));

    if (input.action === "presign") {
      const extension = input.contentType === "image/jpeg"
        ? "jpg"
        : input.contentType === "image/png" ? "png" : "webp";
      const filename = `avatars/${user.id}/${crypto.randomUUID()}.${extension}`;
      const result = await upload({
        visibility: "public",
        filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        ifAbsent: true,
      });

      if (!result.ok) {
        console.error("Avatar presign failed:", result.error);
        throw new HttpError(502, "Could not prepare the photo upload.");
      }

      return requireRole.json({
        presignedUrl: result.presignedUrl,
        headers: result.headers,
        filename,
      } satisfies OutputType);
    }

    if (input.action === "save") {
      if (!input.filename.startsWith(`avatars/${user.id}/`)) {
        throw new HttpError(403, "This photo does not belong to your account.");
      }

      const info = await getInfo({
        visibility: "public",
        filename: input.filename,
      });
      if (!info.ok) {
        console.error("Avatar existence check failed:", info.error);
        throw new HttpError(502, "Could not verify the uploaded photo.");
      }
      if (!info.exists || info.sizeBytes === 0) {
        throw new HttpError(404, "Upload the photo before saving it.");
      }

      const urlResult = await getUrl({
        visibility: "public",
        filename: input.filename,
      });
      if (!urlResult.ok) {
        console.error("Avatar URL lookup failed:", urlResult.error);
        throw new HttpError(502, "Could not retrieve the uploaded photo.");
      }

      const avatarUrl = urlResult.url;
      const previousUrl = await db.transaction().execute(async (trx) => {
        const current = await trx
          .selectFrom("users")
          .select("avatarUrl")
          .where("id", "=", user.id)
          .forUpdate()
          .executeTakeFirstOrThrow();

        await trx
          .updateTable("users")
          .set({ avatarUrl })
          .where("id", "=", user.id)
          .execute();

        return current.avatarUrl;
      });

      if (previousUrl !== avatarUrl) {
        await removePreviousAvatar(previousUrl, user.id);
      }
      return requireRole.json({ avatarUrl } satisfies OutputType);
    }

    const previousUrl = await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("users")
        .select("avatarUrl")
        .where("id", "=", user.id)
        .forUpdate()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("users")
        .set({ avatarUrl: null })
        .where("id", "=", user.id)
        .execute();

      return current.avatarUrl;
    });

    await removePreviousAvatar(previousUrl, user.id);
    return requireRole.json({ avatarUrl: null } satisfies OutputType);
  } catch (error) {
    console.error("Customer avatar action failed:", error);
    return requireRole.errorResponse(error);
  }
}