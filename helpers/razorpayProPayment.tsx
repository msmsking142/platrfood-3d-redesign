import { HttpError } from "./requireRole";

export type RazorpayCredentials = {
  keyId: string;
  secret: string;
};

export function getRazorpayCredentials(): RazorpayCredentials {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keyId.startsWith("rzp_live_") || !secret) {
    throw new HttpError(503, "Online payment is temporarily unavailable");
  }

  return { keyId, secret };
}

export async function razorpayRequest(
  path: string,
  credentials: RazorpayCredentials,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.keyId}:${credentials.secret}`,
        ).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    console.error("Razorpay network request failed:", error);
    throw new HttpError(502, "Could not reach Razorpay. Please try again");
  }

  if (!response.ok) {
    // Do not log credentials, authorization headers, or remote response bodies.
    console.error("Razorpay request failed:", {
      path,
      method,
      status: response.status,
    });
    throw new HttpError(502, "Razorpay could not process the payment request");
  }

  try {
    return await response.json();
  } catch (error) {
    console.error("Razorpay returned an invalid response:", error);
    throw new HttpError(502, "Razorpay returned an invalid response");
  }
}