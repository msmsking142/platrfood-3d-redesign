import { z } from "zod";
import superjson from "superjson";
import type { OtpChallengeResponse } from "./verify_otp_POST.schema";
import type { User } from "../../helpers/User";

export const schema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(1, "Password is required"),
});

export type OutputType =
  | OtpChallengeResponse
  | { otpRequired: false; user: User };

export const postLogin = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/auth/login_with_password", {
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
    const error = superjson.parse<{ message: string }>(
      await result.text(),
    );
    throw new Error(error.message);
  }
  return superjson.parse<OutputType>(await result.text());
};