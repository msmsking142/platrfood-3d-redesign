import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  challengeId: z.string().uuid(),
});

export type OutputType = {
  maskedEmail: string;
  resendAvailableAt: Date;
};

export const postResendOtp = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/auth/resend_otp", {
    method: "POST",
    body: superjson.stringify(schema.parse(body)),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const error = superjson.parse<{ message: string }>(
      await result.text(),
    );
    throw new Error(error.message);
  }
  return superjson.parse<OutputType>(await result.text());
};