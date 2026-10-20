import type { OrderStatus } from "./schema";

export const deliveryCallStatuses: readonly OrderStatus[] = [
  "accepted",
  "preparing",
  "ready",
  "picked_up",
];

export const activeCallStatuses: readonly OrderStatus[] = [
  "placed",
  ...deliveryCallStatuses,
];