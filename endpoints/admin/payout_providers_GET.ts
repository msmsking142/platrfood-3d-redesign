import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./payout_providers_GET.schema";

async function checkRazorpayRoute(): Promise<OutputType["razorpayRoute"]> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !secret || !keyId.startsWith("rzp_live_")) {
    return {
      status: "not_configured",
      detail: "Live Razorpay API credentials are not configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      "https://api.razorpay.com/v1/transfers?count=1",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
        },
        signal: controller.signal,
      },
    );

    if (response.status === 200) {
      return {
        status: "enabled",
        detail: "Route API is accessible. Linked accounts must still be created and KYC-approved per restaurant before automated transfers can be built.",
      };
    }

    if ([400, 401, 403].includes(response.status)) {
      return {
        status: "not_enabled",
        detail: `Route is not activated on this Razorpay account (status ${response.status}). Request Route activation in Razorpay Dashboard.`,
      };
    }

    console.error("Razorpay Route capability check returned status", response.status);
    return {
      status: "error",
      detail: `Could not verify Route access (status ${response.status}). Please try again later.`,
    };
  } catch (error) {
    // Never log the request, credentials, or remote response body.
    console.error(
      "Razorpay Route capability check failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return {
      status: "error",
      detail: "Could not verify Route access. Please try again later.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    schema.parse({});

    const razorpayRoute = await checkRazorpayRoute();
    const riderPayouts: OutputType["riderPayouts"] =
      (process.env as Record<string, string | undefined>).RAZORPAYX_ACCOUNT_NUMBER
        ? {
            status: "configured",
            detail: "RazorpayX account number present – automation still not built; use manual workflow",
          }
        : {
            status: "not_configured",
            detail: "No approved payout provider (e.g. RazorpayX Payouts) is configured. Use the manual payout recording workflow.",
          };

    return requireRole.json({
      checkedAt: new Date(),
      razorpayRoute,
      riderPayouts,
      automatedTransfers: false,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}