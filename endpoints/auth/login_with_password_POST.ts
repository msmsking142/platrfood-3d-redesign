import { randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { sql } from "kysely";
import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { emailOtp } from "../../helpers/emailOtp";
import {
  SessionExpirationSeconds,
  setServerSession,
} from "../../helpers/getSetServerSession";
import { HttpError } from "../../helpers/requireRole";
import type { User } from "../../helpers/User";
import { schema, type OutputType } from "./login_with_password_POST.schema";

const RATE_LIMIT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 15,
  cleanupProbability: 0.1,
} as const;

function safeToDate(
  value: string | number | bigint | Date | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  return new Date(typeof value === "bigint" ? Number(value) : value);
}

export async function handle(request: Request) {
  try {
    const { email, password } = schema.parse(
      superjson.parse(await request.text()),
    );
    const normalizedEmail = email.toLowerCase();
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - RATE_LIMIT_CONFIG.lockoutWindowMinutes * 60_000,
    );

    const result = await db.transaction().execute(async (trx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`.execute(
        trx,
      );

      const attempts = await trx
        .selectFrom("loginAttempts")
        .select([
          trx.fn.countAll<number>().as("failedCount"),
          trx.fn.max("attemptedAt").as("lastFailedAt"),
        ])
        .where("email", "=", normalizedEmail)
        .where("success", "=", false)
        .where("attemptedAt", ">=", windowStart)
        .executeTakeFirst();

      const lastFailedAt = safeToDate(attempts?.lastFailedAt);
      if (
        Number(attempts?.failedCount ?? 0) >=
          RATE_LIMIT_CONFIG.maxFailedAttempts &&
        lastFailedAt
      ) {
        const lockoutEnd = new Date(
          lastFailedAt.getTime() +
            RATE_LIMIT_CONFIG.lockoutDurationMinutes * 60_000,
        );
        if (now < lockoutEnd) {
          return {
            type: "rate_limited" as const,
            remainingMinutes: Math.ceil(
              (lockoutEnd.getTime() - now.getTime()) / 60_000,
            ),
          };
        }
      }

      const user = await trx
        .selectFrom("users")
        .innerJoin("userPasswords", "users.id", "userPasswords.userId")
        .select([
          "users.id",
          "users.email",
          "users.displayName",
          "users.avatarUrl",
          "users.role",
          "users.vegMode",
          "users.allowRestaurantCalls",
          "users.otpExempt",
          "userPasswords.passwordHash",
        ])
        .where(sql`LOWER(users.email)`, "=", normalizedEmail)
        .executeTakeFirst();

      if (!user || !(await compare(password, user.passwordHash))) {
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedEmail,
            attemptedAt: now,
            success: false,
          })
          .execute();
        return { type: "auth_failed" as const };
      }

      if (user.otpExempt) {
        await trx
          .insertInto("loginAttempts")
          .values({
            email: normalizedEmail,
            attemptedAt: now,
            success: true,
          })
          .execute();

        await trx
          .deleteFrom("loginAttempts")
          .where("email", "=", normalizedEmail)
          .where("success", "=", false)
          .execute();

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

        return {
          type: "exempt" as const,
          sessionId,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            vegMode: user.vegMode,
            allowRestaurantCalls: user.allowRestaurantCalls,
          } satisfies User,
        };
      }

      return { type: "success" as const, user };
    });

    if (Math.random() < RATE_LIMIT_CONFIG.cleanupProbability) {
      try {
        await db
          .deleteFrom("loginAttempts")
          .where("attemptedAt", "<", windowStart)
          .execute();
      } catch (error) {
        console.error("Login-attempt cleanup error:", error);
      }
    }

    if (result.type === "rate_limited") {
      return new Response(
        superjson.stringify({
          message: `Too many failed login attempts. Account locked for ${result.remainingMinutes} more minutes.`,
        }),
        { status: 429 },
      );
    }
    if (result.type === "auth_failed") {
      return new Response(
        superjson.stringify({ message: "Invalid email or password" }),
        { status: 401 },
      );
    }

    if (result.type === "exempt") {
      const response = new Response(
        superjson.stringify({
          otpRequired: false,
          user: result.user,
        } satisfies OutputType),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
      await setServerSession(response, {
        id: result.sessionId,
        createdAt: now.getTime(),
        lastAccessed: now.getTime(),
      });
      return response;
    }

    const challenge = await emailOtp.create({
      email: result.user.email,
      purpose: "login",
      userId: result.user.id,
    });

    return new Response(
      superjson.stringify({
        otpRequired: true,
        ...challenge,
      } satisfies OutputType),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      superjson.stringify({
        message:
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid login details."
              : "Authentication failed. Please try again.",
      }),
      {
        status:
          error instanceof HttpError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}