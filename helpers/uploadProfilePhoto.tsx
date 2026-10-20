import { postCustomerAvatar } from "../endpoints/customer/avatar_POST.schema";

export async function uploadProfilePhoto(file: File): Promise<string> {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ] as const;

  if (!allowedTypes.some((type) => type === file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP photo.");
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a photo larger than 0 bytes and no more than 5 MB.");
  }

  const contentType = file.type as (typeof allowedTypes)[number];
  const signed = await postCustomerAvatar({
    action: "presign",
    contentType,
    sizeBytes: file.size,
  });

  const uploadResult = await fetch(signed.presignedUrl, {
    method: "PUT",
    headers: signed.headers,
    body: file,
  });
  if (!uploadResult.ok) {
    console.error("Profile photo upload failed:", uploadResult.status);
    throw new Error(
      uploadResult.status === 412
        ? "This photo upload was already used. Please choose the photo again."
        : "Could not upload the photo. Please try again.",
    );
  }

  const saved = await postCustomerAvatar({
    action: "save",
    filename: signed.filename,
  });
  return saved.avatarUrl;
}