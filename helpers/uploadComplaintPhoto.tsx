import { postComplaintUpload } from "../endpoints/customer/complaint_upload_POST.schema";

export async function uploadComplaintPhoto(
  file: File,
): Promise<{ filename: string; previewUrl: string }> {
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

  const contentType = file.type as typeof allowedTypes[number];
  const signed = await postComplaintUpload({
    contentType,
    sizeBytes: file.size,
  });
  const response = await fetch(signed.presignedUrl, {
    method: "PUT",
    headers: signed.headers,
    body: file,
  });
  if (!response.ok) {
    console.error("Complaint photo upload failed:", response.status);
    throw new Error(response.status === 412
      ? "This photo upload was already used. Please select it again."
      : "Could not upload the photo. Please try again.");
  }
  return {
    filename: signed.filename,
    previewUrl: signed.previewUrl,
  };
}