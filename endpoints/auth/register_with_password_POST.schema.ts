import { z } from "zod";
import superjson from "superjson";
import type { OtpChallengeResponse } from "./verify_otp_POST.schema";

export const schema = z.object({
  email: z.string().email("Email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  role: z.enum(["user", "restaurant", "rider"]).default("user"),
});

export type OutputType = OtpChallengeResponse;

export const postRegister = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const result = await fetch("/_api/auth/register_with_password", {
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