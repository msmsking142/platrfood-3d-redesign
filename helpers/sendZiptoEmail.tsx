import { sendEmail } from "@floot/email";
import { db } from "./db";
import { ziptoConfig } from "./ziptoConfig";

const ZIPTO_EMAIL_FROM = "platr <support@platrfood.co.in>";

export async function sendZiptoEmail({
  to,
  subject,
  html,
  text,
  alwaysSend: _alwaysSend = false,
  from,
  replyTo,
  headers,
  dedupeKey,
  kind,
  orderId,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  alwaysSend?: boolean;
  from?: string;
  replyTo?: string;
  headers?: { name: string; value: string }[];
  dedupeKey?: string;
  kind?: string;
  orderId?: number;
}): Promise<boolean> {
  const recipient = to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    console.warn("Skipping email with an invalid recipient:", to);
    return false;
  }

  if (dedupeKey !== undefined) {
    try {
      const inserted = await db
        .insertInto("emailNotifications")
        .values({
          dedupeKey,
          kind: kind ?? "general",
          recipient,
          subject,
          status: "sending",
          orderId: orderId ?? null,
        })
        .onConflict((conflict) => conflict.column("dedupeKey").doNothing())
        .returning("id")
        .executeTakeFirst();

      if (!inserted) {
        console.log("Skipping duplicate email", dedupeKey);
        return true;
      }
    } catch (error) {
      console.error("Could not reserve email notification:", error);
      return false;
    }
  }

  try {
    const result = await sendEmail({
      from: from ?? ZIPTO_EMAIL_FROM,
      to: recipient,
      subject,
      html,
      text,
      replyTo: replyTo ?? ziptoConfig.supportEmail,
      headers,
    });

    if (!result.ok) {
      console.error("platr™ email failed:", result.error);
      if (dedupeKey !== undefined) {
        await db
          .updateTable("emailNotifications")
          .set({ status: "failed", error: result.error.message })
          .where("dedupeKey", "=", dedupeKey)
          .execute();
      }
      return false;
    }

    if (dedupeKey !== undefined) {
      await db
        .updateTable("emailNotifications")
        .set({
          status: "sent",
          messageId: result.messageId,
          sentAt: new Date(),
          error: null,
        })
        .where("dedupeKey", "=", dedupeKey)
        .execute();
    }

    return true;
  } catch (error) {
    console.error("platr™ email failed:", error);
    if (dedupeKey !== undefined) {
      try {
        await db
          .updateTable("emailNotifications")
          .set({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          })
          .where("dedupeKey", "=", dedupeKey)
          .where("status", "=", "sending")
          .execute();
      } catch (updateError) {
        console.error("Could not record email notification failure:", updateError);
      }
    }
    return false;
  }
}