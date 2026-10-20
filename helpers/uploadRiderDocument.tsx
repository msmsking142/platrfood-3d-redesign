import { postDocumentUpload } from "../endpoints/rider/document_upload_POST.schema";

export const uploadRiderDocument = async (
  kind: "licence" | "selfie",
  file: File,
): Promise<{ filename: string; previewUrl: string }> => {
  const allowedTypes =
    kind === "licence"
      ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      kind === "selfie"
        ? "Selfie must be a JPG, PNG or WebP image."
        : "Driving licence must be a JPG, PNG, WebP image or PDF.",
    );
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a file larger than 0 bytes and no more than 5 MB.");
  }

  const signed = await postDocumentUpload({
    kind,
    contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
    sizeBytes: file.size,
  });
  const uploaded = await fetch(signed.presignedUrl, {
    method: "PUT",
    headers: signed.headers,
    body: file,
  });

  if (!uploaded.ok) {
    console.error("Rider document storage upload failed:", uploaded.status);
    throw new Error("Could not upload the document. Please try again.");
  }

  return { filename: signed.filename, previewUrl: signed.previewUrl };
};