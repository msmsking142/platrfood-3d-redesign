import { db } from "./db";
import type { User } from "./User";
import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
  SessionExpirationSeconds,
} from "./getSetServerSession";

export async function getServerUserSession(request: Request) {
  const session = await getServerSessionOrThrow(request);

  if (Math.random() < CleanupProbability) {
    try {
      await db
        .deleteFrom("sessions")
        .where(
          "lastAccessed",
          "<",
          new Date(Date.now() - SessionExpirationSeconds * 1000),
        )
        .execute();
    } catch (error) {
      console.error("Session cleanup error:", error);
    }
  }

  const result = await db
    .selectFrom("sessions")
    .innerJoin("users", "sessions.userId", "users.id")
    .select([
      "users.id",
      "users.email",
      "users.displayName",
      "users.role",
      "users.avatarUrl",
      "users.vegMode",
      "users.allowRestaurantCalls",
    ])
    .where("sessions.id", "=", session.id)
    .where("sessions.expiresAt", ">", new Date())
    .executeTakeFirst();

  if (!result) {
    throw new NotAuthenticatedError();
  }

  const user = {
    id: result.id,
    email: result.email,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    role: result.role,
    vegMode: result.vegMode,
    allowRestaurantCalls: result.allowRestaurantCalls,
  } satisfies User;

  const now = new Date();
  await db
    .updateTable("sessions")
    .set({ lastAccessed: now })
    .where("id", "=", session.id)
    .execute();

  return {
    user,
    session: { ...session, lastAccessed: now },
  };
}