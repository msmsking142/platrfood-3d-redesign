// BACKEND ONLY. Do not import this helper into client-side code.

export async function logGoogleRoutesHttpError(response: Response): Promise<void> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // An empty or malformed response must not obscure the HTTP failure.
  }

  const error =
    typeof body === "object" && body !== null && "error" in body
      ? body.error
      : null;
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "string"
      ? error.status
      : "unknown";
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";

  console.error(
    "Google Routes live order route HTTP",
    response.status,
    status,
    message
      .replace(/key=[^\s&"'<>\\]*/gi, "key=[REDACTED]")
      .replace(/AIza[A-Za-z0-9_-]*/g, "[REDACTED]")
      .slice(0, 200),
  );
}

export function logInvalidGoogleRoute(reason: string): void {
  console.error("Google Routes live order route invalid response", reason);
}