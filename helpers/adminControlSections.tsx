export const adminControlSections = [
  { value: "overview", label: "Overview" },
  { value: "payouts", label: "Payouts" },
  { value: "food-complaints", label: "Food complaints" },
  { value: "delivery-reliability", label: "Delivery reliability" },
  { value: "finance", label: "Finance" },
  { value: "gst", label: "GST Reserve" },
  { value: "pricing", label: "Pricing" },
  { value: "ca-questions", label: "CA questions" },
  { value: "service-areas", label: "Service areas" },
  { value: "merchant-verification", label: "Merchant verification" },
  { value: "customers", label: "Customers" },
  { value: "rider-verification", label: "Rider verification" },
  { value: "photo-reviews", label: "Photo reviews" },
  { value: "settings", label: "Settings" },
] as const;

export type AdminControlSection = (typeof adminControlSections)[number]["value"];

export function getAdminControlSection(value: string | null): AdminControlSection {
  return adminControlSections.find((section) => section.value === value)?.value ?? "overview";
}

export function getAdminControlSectionUrl(
  searchParams: URLSearchParams,
  section: AdminControlSection,
): string {
  const next = new URLSearchParams(searchParams);
  next.set("section", section);
  next.delete("ticket");
  return `?${next.toString()}`;
}