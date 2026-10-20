// BACKEND ONLY.
import { publish } from "@floot/realtime";
import type { Selectable } from "kysely";
import type { SupportTickets } from "./schema";
import { channels } from "./realtimeChannels";
import { orderEmails } from "./orderEmails";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { ticketSubjectTag } from "./supportCategories";
import { ziptoConfig } from "./ziptoConfig";

type Ticket = Selectable<SupportTickets>;

const SUPPORT_INBOX = "support@platrfood.co.in";
const supportFrom = "platr™ Support <support@platrfood.co.in>";
const adminFooter = "Reply to this email to answer the customer directly, or answer from Admin → Support CRM.";

async function safelySend(
  options: Parameters<typeof sendZiptoEmail>[0],
): Promise<void> {
  try {
    if (!(await sendZiptoEmail(options))) {
      console.error("Support notification was not sent:", options.dedupeKey);
    }
  } catch (error) {
    console.error("Support notification failed:", options.dedupeKey, error);
  }
}

export const supportTicketNotifications = {
  async publishChange(): Promise<void> {
    try {
      await publish(channels.admin(), { type: "support" });
    } catch (error) {
      console.error("Could not publish support update:", error);
    }
  },

  async newTicket(ticket: Ticket, message: string): Promise<void> {
    const tag = ticketSubjectTag(ticket.id);

    const acknowledgement = orderEmails.renderZiptoEmail({
      heading: "We received your request",
      intro: `Hi ${ticket.name}, platr™ Support has received your request. Reply to this email to add more details.`,
      rows: [
        { label: "Ticket", value: tag },
        { label: "Subject", value: ticket.subject },
        { label: "Your message", value: message },
      ],
    });

    const content = orderEmails.renderZiptoEmail({
      heading: `New ${ticket.accountType} support request`,
      intro: `A new ${ticket.category} request needs attention.`,
      rows: [
        { label: "Ticket", value: tag },
        { label: "From", value: `${ticket.name} <${ticket.email}>` },
        { label: "Order", value: ticket.orderId === null ? "Not provided" : `#${ticket.orderId}` },
        { label: "Subject", value: ticket.subject },
        { label: "Message", value: message },
      ],
      ctaLabel: "Answer in Support CRM",
      ctaUrl: `${ziptoConfig.siteUrl}/admin?tab=support&ticket=${ticket.id}`,
      footerNote: adminFooter,
    });

    await Promise.all([
      safelySend({
        to: ticket.email,
        from: supportFrom,
        replyTo: SUPPORT_INBOX,
        subject: `${tag} We received your request: ${ticket.subject}`,
        ...acknowledgement,
        dedupeKey: `support:${ticket.id}:ack`,
        kind: "support_ack",
        ...(ticket.orderId === null ? {} : { orderId: ticket.orderId }),
      }),
      safelySend({
        to: SUPPORT_INBOX,
        from: supportFrom,
        replyTo: ticket.email,
        subject: `${tag} New ${ticket.accountType} support request: ${ticket.category}`,
        ...content,
        dedupeKey: `support:${ticket.id}:support_inbox`,
        kind: "support_admin",
        ...(ticket.orderId === null ? {} : { orderId: ticket.orderId }),
      }),
    ]);

    await this.publishChange();
  },

  async inboundMessage(
    ticket: Ticket,
    message: string,
    messageKey: string,
  ): Promise<void> {
    const content = orderEmails.renderZiptoEmail({
      heading: `New reply on ${ticketSubjectTag(ticket.id)}`,
      intro: `${ticket.name} replied to their support request.`,
      rows: [
        { label: "From", value: ticket.email },
        { label: "Subject", value: ticket.subject },
        { label: "Message", value: message },
      ],
      ctaLabel: "Answer in Support CRM",
      ctaUrl: `${ziptoConfig.siteUrl}/admin?tab=support&ticket=${ticket.id}`,
      footerNote: adminFooter,
    });

    await safelySend({
      to: SUPPORT_INBOX,
      from: supportFrom,
      replyTo: ticket.email,
      subject: `${ticketSubjectTag(ticket.id)} New customer reply: ${ticket.subject}`,
      ...content,
      dedupeKey: `support:msg:${messageKey}:support_inbox`,
      kind: "support_admin",
      ...(ticket.orderId === null ? {} : { orderId: ticket.orderId }),
    });

    await this.publishChange();
  },
};