import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type { SupportTickets } from "../../helpers/schema";
import type { SupportTicketView } from "../support/my_tickets_GET.schema";

export const schema = z.object({
  status: z.enum(["open", "answered", "closed", "all"]).default("open"),
});

export type InputType = z.input<typeof schema>;
export type OutputType = {
  tickets: SupportTicketView[];
  counts: Record<Selectable<SupportTickets>["status"], number>;
};

export async function getAdminSupportTickets(
  input: InputType = {},
  init?: RequestInit,
): Promise<OutputType> {
  const { status } = schema.parse(input);
  const result = await fetch(
    `/_api/admin/support_tickets?${new URLSearchParams({ status })}`,
    { ...init, method: "GET" },
  );
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
}