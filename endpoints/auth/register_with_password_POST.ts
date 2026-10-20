import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { emailOtp } from "../../helpers/emailOtp";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./register_with_password_POST.schema";

export async function handle(request: Request) {
  try {
    const parsed = schema.parse(superjson.parse(await request.text()));
    const email = parsed.email.toLowerCase();

    const settings = await db
      .selectFrom("appSettings")
      .select(["launchMode", "sitePaused", "allowCustomerRegistration", "allowRiderRegistration", "allowMerchantRegistration"])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();

    if (settings.sitePaused) {
      throw new HttpError(
        403,
        "platr™ is launching soon. Registration is currently closed.",
      );
    }
    const registrationAllowed = parsed.role === "user"
      ? settings.allowCustomerRegistration
      : parsed.role === "rider"
        ? settings.allowRiderRegistration
        : settings.allowMerchantRegistration;
    if (!registrationAllowed) {
      throw new HttpError(403, `platr™ ${parsed.role === "user" ? "customer" : parsed.role === "rider" ? "rider" : "merchant"} registration is currently closed. Please check back later.`);
    }
    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (existing) {
      throw new HttpError(409, "Email already in use.");
    }

    const passwordHash = await generatePasswordHash(parsed.password);
    const challenge = await emailOtp.create({
      email,
      purpose: "signup",
      signupPayload: {
        displayName: parsed.displayName,
        phone: parsed.phone,
        role: parsed.role,
        passwordHash,
      },
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
    console.error("Registration error:", error);
    return new Response(
      superjson.stringify({
        message:
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid registration details."
              : "Registration failed. Please try again.",
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