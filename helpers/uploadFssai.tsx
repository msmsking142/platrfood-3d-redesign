import { postFssaiUpload } from "../endpoints/restaurant/fssai_upload_POST.schema";

/** Upload an FSSAI licence file (PDF/JPG/PNG, ≤5 MB) and return its stored URL. */
export async function uploadFssai(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("FSSAI file must be 5 MB or smaller");
  const allowed = ["application/pdf", "image/jpeg", "image/png"] as const;
  if (!(allowed as readonly string[]).includes(file.type)) throw new Error("Upload a PDF, JPG or PNG file");
  const signed = await postFssaiUpload({
    filename: file.name,
    contentType: file.type as (typeof allowed)[number],
    sizeBytes: file.size,
  });
  const res = await fetch(signed.presignedUrl, { method: "PUT", headers: signed.headers, body: file });
  if (!res.ok) throw new Error("Upload failed. Please try again");
  return signed.url;
}