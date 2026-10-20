import type { SupportTicketView } from "../endpoints/support/my_tickets_GET.schema";

const activityFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const relativeFormatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

export function formatSupportActivity(value: Date): string {
  return `${activityFormatter.format(new Date(value))} IST`;
}

export function relativeSupportActivity(value: Date): string {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour");
  return relativeFormatter.format(Math.round(hours / 24), "day");
}

export function matchesSupportSearch(ticket: SupportTicketView, search: string): boolean {
  const term = search.trim().toLowerCase();
  return !term || [
    `#${ticket.id}`,
    String(ticket.id),
    ticket.name,
    ticket.email,
    ticket.registeredEmail ?? "",
    ticket.subject,
    ticket.category,
  ].some((value) => value.toLowerCase().includes(term));
}