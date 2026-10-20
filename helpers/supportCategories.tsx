import type { User } from "./User";
import type { SupportAccountType } from "./schema";

export const supportCategories = {
  customer: [
    "Order issue",
    "Late or missing delivery",
    "Payment or refund",
    "platr™ Wallet",
    "Food quality",
    "Account & login",
    "Other",
  ],
  merchant: [
    "Orders & menu",
    "Weekly payout",
    "Pro subscription",
    "Verification / FSSAI",
    "Account & login",
    "Other",
  ],
  rider: [
    "Delivery issue",
    "Earnings & payout",
    "Verification / documents",
    "Account & login",
    "Other",
  ],
  guest: [
    "General question",
    "Partner with platr™ (restaurant)",
    "Become a rider",
    "Account & login",
    "Other",
  ],
} as const satisfies Record<SupportAccountType, readonly string[]>;

export function accountTypeForRole(
  role: User["role"] | null | undefined,
): SupportAccountType {
  switch (role) {
    case "user":
    case "admin":
      return "customer";
    case "restaurant":
      return "merchant";
    case "rider":
      return "rider";
    default:
      return "guest";
  }
}

export function ticketAddress(id: number): string {
  return `ticket-${id}@platrfood.co.in`;
}

export function formatSupportTicketNumber(id: number): string {
  return String(id).padStart(4, "0");
}

export function ticketSubjectTag(id: number): string {
  return `Ticket #${formatSupportTicketNumber(id)}`;
}