// BACKEND ONLY.
import type { InboundEmail } from "@floot/email";
import { isAutomatedSender, parseSender } from "./supportEmailParsing";
import { supportTickets } from "./supportTickets";

export async function handleInboundEmail(email: InboundEmail): Promise<void> {
  try {
    const sender = parseSender(email.from);
    if (!sender) {
      console.error("Ignoring support email without a valid From address:", email.messageId);
      return;
    }
    if (isAutomatedSender(sender.email)) {
      console.log("Ignoring automated or platr-originated support email:", email.messageId);
      return;
    }

    await supportTickets.addInbound(email);
  } catch (error) {
    console.error("Could not process inbound support email:", email.messageId, error);
    throw error;
  }
}