import { createHash } from "node:crypto";
import superjson from "superjson";
import { orderPayments } from "../../helpers/orderPayments";
import {
  processRazorpayWebhookEvent,
  razorpayWebhookEnvelopeSchema,
} from "../../helpers/processRazorpayWebhookEvent";
import { webhookEventClaims } from "../../helpers/webhookEventClaims";
import { type OutputType } from "./webhook_POST.schema";

export const flootPublic = true;

function okResponse(): Response {
  return new Response(superjson.stringify({ ok: true } satisfies OutputType), {
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(superjson.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handle(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    console.error("Could not read Razorpay webhook body:", error);
    return errorResponse(500, "Could not read payment event");
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
    return errorResponse(500, "Payment webhook is not configured");
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!orderPayments.verifyWebhookSignature(rawBody, signature, secret)) {
    return errorResponse(400, "Invalid payment webhook signature");
  }

  let envelope: ReturnType<typeof razorpayWebhookEnvelopeSchema.parse>;
  try {
    envelope = razorpayWebhookEnvelopeSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    console.error("Invalid Razorpay webhook body:", error);
    return errorResponse(400, "Invalid payment webhook body");
  }

  const eventId =
    request.headers.get("x-razorpay-event-id")?.trim() ||
    createHash("sha256").update(rawBody).digest("hex");

  let claimed = false;
  try {
    const claim = await webhookEventClaims.claim(eventId, envelope.event);
    if (!claim.claimed) {
      return claim.reason === "already_done"
        ? okResponse()
        : errorResponse(503, "Payment event is in progress; retry later");
    }
    claimed = true;

    await processRazorpayWebhookEvent(envelope.event, envelope.payload);
    await webhookEventClaims.markDone(eventId);
    return okResponse();
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);

    if (claimed) {
      try {
        await webhookEventClaims.markFailed(eventId, error);
      } catch (markError) {
        console.error(
          `Could not persist failure for Razorpay event ${eventId}:`,
          markError,
        );
      }
    }

    return errorResponse(500, "Could not process payment event");
  }
}