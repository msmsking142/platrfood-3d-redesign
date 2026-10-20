import {
  setServerSession,
  NotAuthenticatedError,
} from "../../helpers/getSetServerSession";
import type { User } from "../../helpers/User";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, session } = await getServerUserSession(request);

    const response = new Response(
      superjson.stringify({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          vegMode: user.vegMode,
          allowRestaurantCalls: user.allowRestaurantCalls,
        } satisfies User,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );

    await setServerSession(response, {
      id: session.id,
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed.getTime(),
    });
    return response;
  } catch (error) {
    if (!(error instanceof NotAuthenticatedError)) {
      console.error("Session validation error:", error);
    }
    return new Response(
      superjson.stringify({
        error:
          error instanceof NotAuthenticatedError
            ? "Not authenticated"
            : "Session validation failed",
      }),
      {
        status: error instanceof NotAuthenticatedError ? 401 : 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}