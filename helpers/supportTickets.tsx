// BACKEND ONLY.
import { sendEmail, type InboundEmail } from "@floot/email";
import { createHash } from "node:crypto";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { ziptoConfig } from "./ziptoConfig";
import { sql, type Selectable } from "kysely";
import { db } from "./db";
import { orderEmails } from "./orderEmails";
import { HttpError } from "./requireRole";
import type {
  SupportAccountType,
  SupportTicketStatus,
  SupportTickets,
  UserRole,
} from "./schema";
import {
  accountTypeForRole,
  ticketSubjectTag,
} from "./supportCategories";
import {
  inboundBody,
  parseSender,
  ticketIdFromEmail,
} from "./supportEmailParsing";
import { supportTicketNotifications } from "./supportTicketNotifications";
import type { SupportTicketView } from "../endpoints/support/my_tickets_GET.schema";

type Ticket = Selectable<SupportTickets>;

type CreateInput = {
  userId: number | null;
  accountType: SupportAccountType;
  name: string;
  email: string;
  category: string;
  orderId: number | null;
  subject: string;
  message: string;
  source: string;
};

type InboundCreate = {
  emailMessageId?: string;
  attachmentCount?: number;
  skipRateLimit?: boolean;
};

async function verifyOrder(
  userId: number | null,
  accountType: SupportAccountType,
  orderId: number | null,
): Promise<void> {
  if (orderId === null) return;
  if (userId === null || accountType === "guest") {
    throw new HttpError(400, "Log in to link an order to a support request");
  }

  let query = db.selectFrom("orders").select("orders.id").where("orders.id", "=", orderId);

  if (accountType === "customer") {
    query = query.where("orders.customerUserId", "=", userId);
  } else if (accountType === "merchant") {
    query = query.where(
      "orders.restaurantId",
      "in",
      db.selectFrom("restaurants").select("id").where("ownerUserId", "=", userId),
    );
  } else {
    query = query.where(
      "orders.riderId",
      "in",
      db.selectFrom("riders").select("id").where("userId", "=", userId),
    );
  }

  if (!(await query.executeTakeFirst())) {
    throw new HttpError(400, "This order is not available to your account");
  }
}

async function createTicket(
  input: CreateInput,
  options: InboundCreate = {},
): Promise<number | null> {
  await verifyOrder(input.userId, input.accountType, input.orderId);
  const normalizedEmail = input.email.trim().toLowerCase();

  const created = await db.transaction().execute(async (trx) => {
    // Serialize rate-limit checks per email and duplicate deliveries per Message-ID.
    await sql`select pg_advisory_xact_lock(hashtextextended(${`support:rate:${normalizedEmail}`}, 0))`.execute(trx);
    if (options.emailMessageId) {
      await sql`select pg_advisory_xact_lock(hashtextextended(${`support:mail:${options.emailMessageId}`}, 0))`.execute(trx);
      const existing = await trx
        .selectFrom("supportTicketMessages")
        .select("id")
        .where("emailMessageId", "=", options.emailMessageId)
        .executeTakeFirst();
      if (existing) return null;
    }

    if (!options.skipRateLimit) {
      const recent = await trx
        .selectFrom("supportTickets")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where((eb) => eb(eb.fn("lower", ["email"]), "=", normalizedEmail))
        .where("createdAt", ">=", new Date(Date.now() - 60 * 60 * 1000))
        .executeTakeFirstOrThrow();
      if (Number(recent.count) >= 5) {
        throw new HttpError(429, "Too many support requests. Please try again in an hour.");
      }
    }

    const ticket = await trx
      .insertInto("supportTickets")
      .values({
        userId: input.userId,
        accountType: input.accountType,
        name: input.name,
        email: normalizedEmail,
        category: input.category,
        orderId: input.orderId,
        subject: input.subject,
        source: input.source,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto("supportTicketMessages")
      .values({
        ticketId: ticket.id,
        direction: "inbound",
        senderEmail: normalizedEmail,
        bodyText: input.message,
        emailMessageId: options.emailMessageId ?? null,
        attachmentCount: options.attachmentCount ?? 0,
        adminUserId: null,
      })
      .execute();

    return ticket;
  });

  if (created === null) return null;
  try {
    await supportTicketNotifications.newTicket(created, input.message);
  } catch (error) {
    console.error("Could not notify about new support ticket:", created.id, error);
  }
  return created.id;
}

function threadHeaders(messageId: string | null): { name: string; value: string }[] {
  if (!messageId) return [];
  const clean = messageId.trim().replace(/^<|>$/g, "");
  if (!/^[^\s<>]+$/.test(clean)) return [];
  const value = `<${clean}>`;
  return [
    { name: "In-Reply-To", value },
    { name: "References", value },
  ];
}

async function withMessages(
  tickets: (Ticket & { userRole: UserRole | null; registeredEmail: string | null })[],
): Promise<SupportTicketView[]> {
  if (!tickets.length) return [];

  const messages = await db
    .selectFrom("supportTicketMessages")
    .select([
      "id",
      "ticketId",
      "direction",
      "senderEmail",
      "bodyText",
      "createdAt",
      "attachmentCount",
    ])
    .where("ticketId", "in", tickets.map((ticket) => ticket.id))
    .orderBy("createdAt", "asc")
    .orderBy("id", "asc")
    .execute();

  const byTicket = new Map<number, SupportTicketView["messages"]>();
  for (const message of messages) {
    const list = byTicket.get(message.ticketId) ?? [];
    list.push({
      id: message.id,
      direction: message.direction,
      senderEmail: message.senderEmail,
      bodyText: message.bodyText,
      createdAt: message.createdAt,
      attachmentCount: message.attachmentCount,
    });
    byTicket.set(message.ticketId, list);
  }

  return tickets.map((ticket) => ({
    id: ticket.id,
    userId: ticket.userId,
    userRole: ticket.userRole,
    registeredEmail: ticket.registeredEmail,
    accountType: ticket.accountType,
    name: ticket.name,
    email: ticket.email,
    category: ticket.category,
    orderId: ticket.orderId,
    subject: ticket.subject,
    source: ticket.source,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastMessageAt: ticket.lastMessageAt,
    messages: byTicket.get(ticket.id) ?? [],
  }));
}

export const supportTickets = {
  create(input: CreateInput): Promise<number | null> {
    return createTicket(input);
  },

  async addInbound(email: InboundEmail): Promise<void> {
    const sender = parseSender(email.from);
    if (!sender) {
      console.error("Support inbound email has no valid sender");
      return;
    }

    const body = inboundBody(email);
    if (!body) {
      console.error("Ignoring empty support inbound email:", email.messageId);
      return;
    }

    const messageId = email.messageId?.trim() || null;
    if (messageId) {
      const existing = await db
        .selectFrom("supportTicketMessages")
        .select("id")
        .where("emailMessageId", "=", messageId)
        .executeTakeFirst();
      if (existing) return;
    }

    const referencedId = ticketIdFromEmail(email);
    const ticket = referencedId === null
      ? null
      : await db
          .selectFrom("supportTickets")
          .selectAll()
          .where("id", "=", referencedId)
          .executeTakeFirst();

    const senderUser = await db
      .selectFrom("users")
      .select(["id", "displayName", "role"])
      .where((eb) => eb(eb.fn("lower", ["email"]), "=", sender.email))
      .executeTakeFirst();

    if (!ticket && senderUser?.role === "admin") {
      console.log("Ignoring unmatched support email from admin:", sender.email);
      return;
    }

    if (!ticket) {
      await createTicket({
        userId: senderUser?.id ?? null,
        accountType: accountTypeForRole(senderUser?.role),
        name: sender.name || senderUser?.displayName || sender.email.split("@")[0],
        email: sender.email,
        category: "Email",
        orderId: null,
        subject: (email.subject?.trim() || "(no subject)").slice(0, 120),
        message: body,
        source: "email",
      }, {
        skipRateLimit: true,
        emailMessageId: messageId ?? undefined,
        attachmentCount: email.attachments.length,
      });
      return;
    }

    if (sender.email.toLowerCase() !== ticket.email.toLowerCase()) {
      if (senderUser?.role !== "admin") {
        console.error("Ignoring unauthorized sender for support ticket:", ticket.id);
        return;
      }

      const key = messageId ?? `${ticket.id}:${createHash("sha256").update(body).digest("hex")}`;
      const notice = "Replies from email are not sent to customers. Please answer ticket " +
        `#${ticket.id} from Admin → Support CRM so the customer only sees support@platrfood.co.in.`;
      const rendered = orderEmails.renderZiptoEmail({
        heading: `Answer ticket #${ticket.id} in Support CRM`,
        intro: notice,
        ctaLabel: "Answer in Support CRM",
        ctaUrl: `${ziptoConfig.siteUrl}/admin?tab=support&ticket=${ticket.id}`,
      });
      if (!(await sendZiptoEmail({
        to: sender.email,
        subject: `Please answer ticket #${ticket.id} in Support CRM`,
        ...rendered,
        dedupeKey: `support:admin_email_blocked:${key}`,
        kind: "support_admin",
      }))) {
        console.error("Could not send blocked email reply notice for ticket:", ticket.id);
      }
      return;
    }

    const saved = await db.transaction().execute(async (trx) => {
      if (messageId) {
        await sql`select pg_advisory_xact_lock(hashtextextended(${`support:mail:${messageId}`}, 0))`.execute(trx);
        const duplicate = await trx
          .selectFrom("supportTicketMessages")
          .select("id")
          .where("emailMessageId", "=", messageId)
          .executeTakeFirst();
        if (duplicate) return null;
      }

      const message = await trx
        .insertInto("supportTicketMessages")
        .values({
          ticketId: ticket.id,
          direction: "inbound",
          senderEmail: sender.email,
          bodyText: body,
          emailMessageId: messageId,
          attachmentCount: email.attachments.length,
          adminUserId: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("supportTickets")
        .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
        .where("id", "=", ticket.id)
        .execute();
      return message;
    });

    if (!saved) return;

    try {
      await supportTicketNotifications.inboundMessage(
        ticket,
        body,
        messageId ?? `db:${saved.id}`,
      );
    } catch (error) {
      console.error("Could not notify admins about support reply:", ticket.id, error);
    }
  },

  async reply({
    ticketId,
    adminUserId,
    message,
    closeAfter,
  }: {
    ticketId: number;
    adminUserId: number;
    message: string;
    closeAfter: boolean;
  }): Promise<void> {
    const body = message.trim();
    if (!body || body.length > 8000) {
      throw new HttpError(400, "Reply must contain 1–8,000 characters");
    }

    const ticket = await db
      .selectFrom("supportTickets")
      .selectAll()
      .where("id", "=", ticketId)
      .executeTakeFirst();
    if (!ticket) throw new HttpError(404, "Support ticket not found");

    const recipient = ticket.userId === null
      ? ticket.email
      : (await db
          .selectFrom("users")
          .select("email")
          .where("id", "=", ticket.userId)
          .executeTakeFirst())?.email ?? ticket.email;

    const previous = await db
      .selectFrom("supportTicketMessages")
      .select("emailMessageId")
      .where("ticketId", "=", ticketId)
      .where("emailMessageId", "is not", null)
      .orderBy("createdAt", "desc")
      .orderBy("id", "desc")
      .executeTakeFirst();

    const rendered = orderEmails.renderZiptoEmail({
      heading: `Update on ${ticketSubjectTag(ticket.id)}`,
      intro: body,
      footerNote: "Reply to this email if you need to add more details.",
    });

    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await sendEmail({
        from: "platr™ Support <support@platrfood.co.in>",
        to: recipient,
        replyTo: "support@platrfood.co.in",
        subject: `Re: ${ticketSubjectTag(ticket.id)} ${ticket.subject}`,
        ...rendered,
        headers: threadHeaders(previous?.emailMessageId ?? null),
      });
    } catch (error) {
      console.error("Support reply send failed:", ticketId, error);
      throw new HttpError(502, "Could not send the support reply. Please try again.");
    }
    if (!result.ok) {
      console.error("Support reply send failed:", ticketId, result.error);
      throw new HttpError(502, "Could not send the support reply. Please try again.");
    }

    const now = new Date();
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("supportTicketMessages")
        .values({
          ticketId,
          direction: "outbound",
          senderEmail: "support@platrfood.co.in",
          bodyText: body,
          adminUserId,
          emailMessageId: result.messageId,
          attachmentCount: 0,
        })
        .execute();
      await trx
        .updateTable("supportTickets")
        .set({
          status: closeAfter ? "closed" : "answered",
          lastMessageAt: now,
          updatedAt: now,
        })
        .where("id", "=", ticketId)
        .execute();
    });

    await supportTicketNotifications.publishChange();
  },

  async setStatus(ticketId: number, status: SupportTicketStatus): Promise<void> {
    const updated = await db
      .updateTable("supportTickets")
      .set({ status, updatedAt: new Date() })
      .where("id", "=", ticketId)
      .returning("id")
      .executeTakeFirst();
    if (!updated) throw new HttpError(404, "Support ticket not found");
    await supportTicketNotifications.publishChange();
  },

  async listForAdmin({
    status = "open",
  }: {
    status?: SupportTicketStatus | "all";
  } = {}): Promise<{
    tickets: SupportTicketView[];
    counts: Record<SupportTicketStatus, number>;
  }> {
    let query = db
      .selectFrom("supportTickets")
      .leftJoin("users", "users.id", "supportTickets.userId")
      .selectAll("supportTickets")
      .select(["users.role as userRole", "users.email as registeredEmail"]);

    if (status !== "all") query = query.where("supportTickets.status", "=", status);

    const [rows, totals] = await Promise.all([
      query
        .orderBy("supportTickets.lastMessageAt", "desc")
        .orderBy("supportTickets.id", "desc")
        .limit(100)
        .execute(),
      db
        .selectFrom("supportTickets")
        .select(["status", ({ fn }) => fn.count<number>("id").as("count")])
        .groupBy("status")
        .execute(),
    ]);

    const counts: Record<SupportTicketStatus, number> = {
      open: 0,
      answered: 0,
      closed: 0,
    };
    for (const row of totals) counts[row.status] = Number(row.count);

    return { tickets: await withMessages(rows), counts };
  },

  async listForUser(userId: number): Promise<SupportTicketView[]> {
    const rows = await db
      .selectFrom("supportTickets")
      .leftJoin("users", "users.id", "supportTickets.userId")
      .selectAll("supportTickets")
      .select(["users.role as userRole", "users.email as registeredEmail"])
      .where("supportTickets.userId", "=", userId)
      .orderBy("supportTickets.lastMessageAt", "desc")
      .orderBy("supportTickets.id", "desc")
      .limit(20)
      .execute();

    return withMessages(rows);
  },
};