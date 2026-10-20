// BACKEND ONLY. Task name and exported handler name must match.
import { deliveryProtection } from "./deliveryProtection";

export async function riderSearchTick(
  payload: { orderId: number },
): Promise<void> {
  try {
    await deliveryProtection.tick(payload.orderId);
  } catch (error) {
    console.error(`Rider-search task failed for order ${payload.orderId}:`, error);
    throw error;
  }
}