// BACKEND ONLY.
import type { InboundEmail } from "@floot/email";

export function parseSender(from: string | undefined): {
  email: string;
  name: string;
} | null {
  if (!from) return null;

  const match = from.trim().match(/^(.*?)\s*<([^<>]+)>$/);
  const address = (match ? match[2] : from).trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) return null;

  const displayName = match?.[1].trim().replace(/^"|"$/g, "").trim();
  return {
    email: address,
    name: displayName || address.split("@")[0],
  };
}

export function isAutomatedSender(address: string): boolean {
  return (
    address.endsWith("@mail.ziptofood.online") ||
    address.endsWith("@platrfood.co.in") ||
    /^(?:mailer-daemon|postmaster|no-?reply)@/i.test(address)
  );
}

export function ticketIdFromEmail(email: InboundEmail): number | null {
  for (const recipient of email.recipients) {
    const match = recipient.match(/^ticket-(\d+)@(?:platrfood\.co\.in|mail\.ziptofood\.online)$/i);
    if (match) {
      const id = Number(match[1]);
      if (Number.isSafeInteger(id) && id > 0) return id;
    }
  }

  // Accept both the new four-digit display number and legacy subjects.
  const match = email.subject?.match(/(?:Ticket\s*#|\[platr™\s*#)(\d+)\]?/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function inboundBody(email: InboundEmail): string {
  const htmlText = email.html
    ?.replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");

  const lines = (email.text?.trim() || htmlText || "").split(/\r?\n/);
  const unquoted: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line) || /^\s*On .+wrote:\s*$/i.test(line)) break;
    unquoted.push(line);
  }
  return unquoted.join("\n").trim().slice(0, 20_000);
}