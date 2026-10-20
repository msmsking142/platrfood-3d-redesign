import { getUrl } from "@floot/storage";
import { HttpError } from "./requireRole";

export async function riderKycUrls(licenceFile: string | null, selfieFile: string | null, rcFile: string | null = null) {
  const [licence, selfie, rc] = await Promise.all(
    [licenceFile, selfieFile, rcFile].map(async (filename) => {
      if (!filename) return null;
      const result = await getUrl({
        visibility: "private",
        filename,
        expiresInSeconds: 900,
      });
      if (!result.ok) {
        console.error("Failed to sign rider KYC URL:", result.error);
        throw new HttpError(502, "Could not load rider documents. Please try again.");
      }
      return result.url;
    })
  );

  return { licenceUrl: licence, selfieUrl: selfie, rcUrl: rc };
}