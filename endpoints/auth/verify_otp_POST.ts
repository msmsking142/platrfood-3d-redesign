import { randomBytes } from "node:crypto";
import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import {
  emailOtp,
  OtpHttpError,
  signupPayloadSchema,
} from "../../helpers/emailOtp";
import {
  SessionExpirationSeconds,
  setServerSession,
} from "../../helpers/getSetServerSession";
import { HttpError } from "../../helpers/requireRole";
import type { User } from "../../helpers/User";
import { schema, type OutputType } from "./verify_otp_POST.schema";

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));

    const result = await db.transaction().execute(async (trx) => {
      const verification = await emailOtp.verify(
        trx,
        input.challengeId,
        input.code,
      );
      if (!verification.ok) return verification;

      const challenge = verification.challenge;
      const now = new Date();
      let user: User;

      if (challenge.purpose === "login") {
        if (challenge.userId === null) {
          throw new OtpHttpError(
            400,
            "This code is no longer valid. Please start again.",
            "RESTART",
          );
        }

        const existing = await trx
          .selectFrom("users")
          .select([
            "id",
            "email",
            "displayName",
            "avatarUrl",
            "role",
            "vegMode",
            "allowRestaurantCalls",
            "emailVerifiedAt",
          ])
          .where("id", "=", challenge.userId)
          .executeTakeFirst();

        if (!existing) {
          throw new HttpError(404, "Account no longer exists.");
        }

        if (existing.emailVerifiedAt === null) {
          await trx
            .updateTable("users")
            .set({ emailVerifiedAt: now })
            .where("id", "=", existing.id)
            .execute();
        }

        user = {
          id: existing.id,
          email: existing.email,
          displayName: existing.displayName,
          avatarUrl: existing.avatarUrl,
          role: existing.role,
          vegMode: existing.vegMode,
          allowRestaurantCalls: existing.allowRestaurantCalls,
        };

        await trx
          .insertInto("loginAttempts")
          .values({
            email: existing.email.toLowerCase(),
            attemptedAt: now,
            success: true,
          })
          .execute();

        await trx
          .deleteFrom("loginAttempts")
          .where("email", "=", existing.email.toLowerCase())
          .where("success", "=", false)
          .execute();
      } else {
        const payload = signupPayloadSchema.safeParse(
          challenge.signupPayload,
        );
        if (!payload.success) {
          throw new OtpHttpError(
            400,
            "This code is no longer valid. Please start again.",
            "RESTART",
          );
        }

        const settings = await trx
          .selectFrom("appSettings")
          .select(["sitePaused", "launchMode", "allowCustomerRegistration", "allowRiderRegistration", "allowMerchantRegistration"])
          .where("id", "=", 1)
          .executeTakeFirstOrThrow();

        if (settings.sitePaused) {
          throw new HttpError(
            403,
            "platr™ is launching soon. Registration is currently closed.",
          );
        }
        const registrationAllowed = payload.data.role === "user"
          ? settings.allowCustomerRegistration
          : payload.data.role === "rider"
            ? settings.allowRiderRegistration
            : settings.allowMerchantRegistration;
        if (!registrationAllowed) {
          throw new HttpError(403, `platr™ ${payload.data.role === "user" ? "customer" : payload.data.role === "rider" ? "rider" : "merchant"} registration is currently closed. Please start again when registration is enabled.`);
        }
        const taken = await trx
          .selectFrom("users")
          .select("id")
          .where("email", "=", challenge.email)
          .executeTakeFirst();
        if (taken) {
          throw new HttpError(409, "Email already in use.");
        }

        const created = await trx
          .insertInto("users")
          .values({
            email: challenge.email,
            displayName: payload.data.displayName,
            phone: payload.data.phone,
            role: payload.data.role,
            emailVerifiedAt: now,
          })
          .returning([
            "id",
            "email",
            "displayName",
            "avatarUrl",
            "role",
            "vegMode",
            "allowRestaurantCalls",
          ])
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("userPasswords")
          .values({
            userId: created.id,
            passwordHash: payload.data.passwordHash,
          })
          .execute();

        user = created satisfies User;
      }

      const sessionId = randomBytes(32).toString("hex");
      await trx
        .insertInto("sessions")
        .values({
          id: sessionId,
          userId: user.id,
          createdAt: now,
          lastAccessed: now,
          expiresAt: new Date(
            now.getTime() + SessionExpirationSeconds * 1000,
          ),
        })
        .execute();

      return { ok: true as const, user, sessionId, now };
    });

    if (!result.ok) {
      return new Response(
        superjson.stringify({
          message: result.error.message,
          code: result.error.code,
        }),
        {
          status: result.error.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const response = new Response(
      superjson.stringify({ user: result.user } satisfies OutputType),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
    await setServerSession(response, {
      id: result.sessionId,
      createdAt: result.now.getTime(),
      lastAccessed: result.now.getTime(),
    });
    return response;
  } catch (error) {
    console.error("OTP verification error:", error);
    const uniqueConflict =
      error instanceof Error &&
      "code" in error &&
      error.code === "23505";
    const status = uniqueConflict
      ? 409
      : error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500;

    return new Response(
      superjson.stringify({
        message: uniqueConflict
          ? "Email already in use."
          : error instanceof HttpError
            ? error.message
            : status === 400
              ? "Invalid verification request."
              : "Could not verify the code. Please try again.",
        ...(error instanceof OtpHttpError && error.code
          ? { code: error.code }
          : {}),
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}