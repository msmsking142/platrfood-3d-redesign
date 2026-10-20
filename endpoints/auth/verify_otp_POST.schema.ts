import { z } from "zod";
import superjson from "superjson";
import type { User } from "../../helpers/User";

export const schema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit code"),
});

export type OtpErrorCode = "RESTART" | "EXPIRED" | "WRONG";

export type OtpChallengeResponse = {
  otpRequired: true;
  challengeId: string;
  maskedEmail: string;
  resendAvailableAt: Date;
};

export type OutputType = { user: User };

export class OtpError extends Error {
  constructor(
    message: string,
    public readonly code?: OtpErrorCode,
  ) {
    super(message);
    this.name = "OtpError";
  }
}

export const postVerifyOtp = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/auth/verify_otp", {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!result.ok) {
    const error = superjson.parse<{
      message: string;
      code?: OtpErrorCode;
    }>(await result.text());
    throw new OtpError(error.message, error.code);
  }
  return superjson.parse<OutputType>(await result.text());
};