// BACKEND ONLY.
import { z } from "zod";
import {
  getRazorpayCredentials,
  razorpayRequest,
  type RazorpayCredentials,
} from "./razorpayProPayment";

const orderSchema = z.object({
  id: z.string().min(1),
  notes: z.object({
    purpose: z.string().optional(),
    orderId: z.string().optional(),
    walletTxnId: z.string().optional(),
    userId: z.string().optional(),
    restaurantId: z.string().optional(),
  }).nullish(),
});

async function orderIsMissing(
  path: string,
  credentials: RazorpayCredentials,
): Promise<boolean> {
  // razorpayRequest deliberately maps every Razorpay HTTP failure to a 502.
  // Probe the status only after it fails so a genuine 404 can be distinguished
  // from a failure that should cause the webhook to retry.
  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${credentials.keyId}:${credentials.secret}`,
        ).toString("base64")}`,
      },
    });
    await response.body?.cancel();
    return response.status === 404;
  } catch {
    return false;
  }
}

export async function getRazorpayOrderNotes(orderId: string) {
  const credentials = getRazorpayCredentials();
  const path = `/orders/${encodeURIComponent(orderId)}`;
  let response: unknown;

  try {
    response = await razorpayRequest(path, credentials, "GET");
  } catch (error) {
    if (await orderIsMissing(path, credentials)) {
      console.error(`Ignoring captured payment: Razorpay order ${orderId} was not found`);
      return null;
    }
    throw error;
  }

  const order = orderSchema.parse(response);
  if (order.id !== orderId) {
    throw new Error(`Razorpay returned a different order for ${orderId}`);
  }
  return order.notes ?? null;
}