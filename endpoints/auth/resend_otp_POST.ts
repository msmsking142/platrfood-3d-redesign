import superjson from "superjson";
import { z } from "zod";
import { emailOtp } from "../../helpers/emailOtp";
import { HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./resend_otp_POST.schema";

export async function handle(request: Request) {
  try {
    const { challengeId } = schema.parse(
      superjson.parse(await request.text()),
    );
    const result = await emailOtp.resend(challengeId);
    return new Response(superjson.stringify(result satisfies OutputType), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("OTP resend error:", error);
    return new Response(
      superjson.stringify({
        message:
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "Invalid challenge ID."
              : "Could not resend the code. Please try again.",
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