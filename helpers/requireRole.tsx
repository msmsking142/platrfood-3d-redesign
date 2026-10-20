// BACKEND ONLY. Resolve the logged-in user and enforce allowed roles.
import { getServerUserSession } from "./getServerUserSession";
import { User } from "./User";
import superjson from "superjson";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireRole(
  request: Request,
  roles: User["role"][]
): Promise<User> {
  let user: User;
  try {
    ({ user } = await getServerUserSession(request));
  } catch {
    throw new HttpError(401, "Please log in first");
  }
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You don't have access to this");
  }
  return user;
}

requireRole.errorResponse = (error: unknown) => {
  const status = error instanceof HttpError ? error.status : 400;
  const message = error instanceof Error ? error.message : "Something went wrong";
  if (!(error instanceof HttpError)) console.error(error);
  return new Response(superjson.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

requireRole.json = (data: unknown) =>
  new Response(superjson.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });