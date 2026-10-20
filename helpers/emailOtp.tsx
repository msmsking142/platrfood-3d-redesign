// BACKEND ONLY.
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { type Selectable, type Transaction } from "kysely";
import { z } from "zod";
import { db } from "./db";
import type { DB, EmailOtpChallenges } from "./schema";
import { HttpError } from "./requireRole";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { schema as registrationSchema } from "../endpoints/auth/register_with_password_POST.schema";
import type { OtpErrorCode } from "../endpoints/auth/verify_otp_POST.schema";

export const signupPayloadSchema = registrationSchema
  .pick({ displayName: true, phone: true, role: true })
  .extend({ passwordHash: z.string().min(1) });

type Challenge = Selectable<EmailOtpChallenges>;
type VerifiedChallenge = Pick<
  Challenge,
  "email" | "purpose" | "userId" | "signupPayload"
>;

export class OtpHttpError extends HttpError {
  constructor(
    status: number,
    message: string,
    public readonly code?: OtpErrorCode,
  ) {
    super(status, message);
  }
}

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCode(challengeId: string, code: string): string {
  return createHash("sha256")
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

function resendAvailableAt(lastSentAt: Date): Date {
  return new Date(lastSentAt.getTime() + 60_000);
}

async function sendCode(email: string, code: string): Promise<void> {
  const sent = await sendZiptoEmail({
    to: email,
    subject: `Your platr™ code: ${code}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111;max-width:480px;margin:auto">
      <div style="background:#FFC400;padding:24px;font-size:28px;font-weight:700">platr™</div>
      <div style="padding:28px 24px">
        <p>Your verification code is:</p>
        <p style="font-size:36px;font-weight:700;letter-spacing:8px">${code}</p>
        <p>Code expires in 10 minutes. Never share it with anyone – platr™ will never ask for it.</p>
        <p>Yeh code kisi ke saath share na karein.</p>
      </div>
    </div>`,
    text: `Your platr™ code: ${code}\n\nCode expires in 10 minutes. Never share it with anyone – platr™ will never ask for it.\nYeh code kisi ke saath share na karein.`,
    alwaysSend: true,
  });

  if (!sent) {
    throw new HttpError(
      502,
      "Could not send the code email. Please try again.",
    );
  }
}

export const emailOtp = {
  async create({
    email,
    purpose,
    userId,
    signupPayload,
  }: {
    email: string;
    purpose: Challenge["purpose"];
    userId?: number;
    signupPayload?: z.infer<typeof signupPayloadSchema>;
  }): Promise<{
    challengeId: string;
    maskedEmail: string;
    resendAvailableAt: Date;
  }> {
    const normalizedEmail = email.toLowerCase();
    const challengeId = randomUUID();
    const code = generateCode();
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("emailOtpChallenges")
        .values({
          id: challengeId,
          email: normalizedEmail,
          purpose,
          userId: userId ?? null,
          signupPayload: signupPayload ?? null,
          codeHash: hashCode(challengeId, code),
          expiresAt: new Date(now.getTime() + 10 * 60_000),
          lastSentAt: now,
        })
        .execute();
    });

    try {
      await sendCode(normalizedEmail, code);
    } catch (error) {
      console.error("Failed to send new OTP:", error);
      await db
        .updateTable("emailOtpChallenges")
        .set({ usedAt: new Date() })
        .where("id", "=", challengeId)
        .where("usedAt", "is", null)
        .execute();
      throw error;
    }

    return {
      challengeId,
      maskedEmail: maskEmail(normalizedEmail),
      resendAvailableAt: resendAvailableAt(now),
    };
  },

  async resend(challengeId: string): Promise<{
    maskedEmail: string;
    resendAvailableAt: Date;
  }> {
    const now = new Date();
    const code = generateCode();

    const challenge = await db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("emailOtpChallenges")
        .selectAll()
        .where("id", "=", challengeId)
        .forUpdate()
        .executeTakeFirst();

      if (!row || row.usedAt || row.attempts >= 5) {
        throw new HttpError(400, "Please start again");
      }

      const availableAt = resendAvailableAt(row.lastSentAt);
      if (now < availableAt) {
        const remaining = Math.ceil(
          (availableAt.getTime() - now.getTime()) / 1000,
        );
        throw new HttpError(
          429,
          `Please wait ${remaining} seconds before requesting another code.`,
        );
      }

      await trx
        .updateTable("emailOtpChallenges")
        .set({
          codeHash: hashCode(challengeId, code),
          expiresAt: new Date(now.getTime() + 10 * 60_000),
          lastSentAt: now,
          sendCount: row.sendCount + 1,
          attempts: 0,
        })
        .where("id", "=", challengeId)
        .execute();

      return row;
    });

    try {
      await sendCode(challenge.email, code);
    } catch (error) {
      console.error("Failed to resend OTP:", error);
      await db
        .updateTable("emailOtpChallenges")
        .set({ usedAt: new Date() })
        .where("id", "=", challengeId)
        .where("usedAt", "is", null)
        .execute();
      throw error;
    }

    return {
      maskedEmail: maskEmail(challenge.email),
      resendAvailableAt: resendAvailableAt(now),
    };
  },

  async verify(
    trx: Transaction<DB>,
    challengeId: string,
    code: string,
  ): Promise<
    | { ok: true; challenge: VerifiedChallenge }
    | { ok: false; error: OtpHttpError }
  > {
    const challenge = await trx
      .selectFrom("emailOtpChallenges")
      .selectAll()
      .where("id", "=", challengeId)
      .forUpdate()
      .executeTakeFirst();

    if (!challenge || challenge.usedAt) {
      throw new OtpHttpError(
        400,
        "This code is no longer valid. Please start again.",
        "RESTART",
      );
    }
    if (challenge.attempts >= 5) {
      throw new OtpHttpError(
        400,
        "Too many wrong attempts. Please start again.",
        "RESTART",
      );
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new OtpHttpError(
        400,
        "Code expired. Request a new code.",
        "EXPIRED",
      );
    }

    const expected = Buffer.from(challenge.codeHash, "hex");
    const actual = Buffer.from(hashCode(challengeId, code), "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      const attempts = challenge.attempts + 1;
      await trx
        .updateTable("emailOtpChallenges")
        .set({ attempts })
        .where("id", "=", challengeId)
        .execute();

      // Return, rather than throw, so the caller can commit the attempt count.
      return {
        ok: false,
        error: new OtpHttpError(
          400,
          `Wrong code. ${5 - attempts} attempts left.`,
          "WRONG",
        ),
      };
    }

    await trx
      .updateTable("emailOtpChallenges")
      .set({ usedAt: new Date() })
      .where("id", "=", challengeId)
      .execute();

    return {
      ok: true,
      challenge: {
        email: challenge.email,
        purpose: challenge.purpose,
        userId: challenge.userId,
        signupPayload: challenge.signupPayload,
      },
    };
  },
};