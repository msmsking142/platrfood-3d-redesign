import { z } from "zod";
import superjson from "superjson";
import { HttpError } from "./requireRole";

export function customerEndpointErrorResponse(error: unknown): Response {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof z.ZodError
        ? 400
        : 500;

  if (status === 500) {
    console.error("Customer endpoint failed:", error);
  }

  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid request"
        : "Something went wrong. Please try again.";

  return new Response(superjson.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}