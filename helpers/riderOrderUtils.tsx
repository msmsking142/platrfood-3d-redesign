import type { OrderView } from "./orderView";

export const riderOrderRoute = (
  order: Pick<OrderView, "restaurantAddress" | "deliveryAddress" | "town">,
): string => {
  const params = new URLSearchParams({
    api: "1",
    origin: `${order.restaurantAddress}, ${order.town}`,
    destination: `${order.deliveryAddress}, ${order.town}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const riderOrderDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

export const riderOrderTimeAgo = (date: Date): string => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60_000),
  );
  if (minutes >= 60) return riderOrderDate(date);
  return new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" }).format(
    -Math.max(minutes, 1),
    "minute",
  );
};