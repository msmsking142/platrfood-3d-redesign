import { z } from "zod";

export const fssaiDocumentUrl = z.string()
  .trim()
  .max(1000, "Upload your FSSAI licence")
  .refine((value) => {
    if (value.startsWith("/_cdn/")) return true;
    if (!/^https?:\/\//i.test(value)) return false;

    try {
      const url = new URL(value);
      return Boolean(url.hostname);
    } catch {
      return false;
    }
  }, "Upload your FSSAI licence");