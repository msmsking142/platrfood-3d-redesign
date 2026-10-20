// BACKEND ONLY. Retain the legacy task name for already-queued jobs.
import { deliveryProtection } from "./deliveryProtection";

export async function autoCancelNoRiderOrder(
  payload: { orderId: number },
): Promise<void> {
  try {
    await deliveryProtection.tick(payload.orderId);
  } catch (error) {
    console.error(`Legacy no-rider task failed for order ${payload.orderId}:`, error);
    throw error;
  }
}