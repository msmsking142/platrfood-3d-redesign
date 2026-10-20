import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type {
  Orders,
  SupportTicketMessages,
  SupportTickets,
  Users,
} from "../../helpers/schema";

export const schema = z.object({}).strict();

export type SupportTicketView = Pick<
  Selectable<SupportTickets>,
  | "id"
  | "userId"
  | "accountType"
  | "name"
  | "email"
  | "category"
  | "orderId"
  | "subject"
  | "source"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastMessageAt"
> & {
  userRole: Selectable<Users>["role"] | null;
  registeredEmail: string | null;
  messages: Pick<
    Selectable<SupportTicketMessages>,
    | "id"
    | "direction"
    | "senderEmail"
    | "bodyText"
    | "createdAt"
    | "attachmentCount"
  >[];
};

export type RecentSupportOrder = Pick<
  Selectable<Orders>,
  "id" | "createdAt" | "status" | "total"
> & {
  restaurantName: string;
};

export type OutputType = {
  tickets: SupportTicketView[];
  recentOrders: RecentSupportOrder[];
};

export async function getMySupportTickets(
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/support/my_tickets", {
    ...init,
    method: "GET",
  });
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
}