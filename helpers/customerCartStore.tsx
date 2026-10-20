import { useEffect, useState } from "react";

const lastRestaurantKey = "zipto_last_cart_restaurant";
const changeEvent = "zipto-cart-change";

function read(restaurantId: number): Record<number, number> {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(
      window.sessionStorage.getItem(`zipto_cart_${restaurantId}`) ?? "{}",
    ) as Record<number, number>;
  } catch {
    return {};
  }
}

function write(restaurantId: number, cart: Record<number, number>): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    `zipto_cart_${restaurantId}`,
    JSON.stringify(cart),
  );

  if (Object.values(cart).some((quantity) => quantity > 0)) {
    window.sessionStorage.setItem(lastRestaurantKey, String(restaurantId));
  } else if (
    window.sessionStorage.getItem(lastRestaurantKey) === String(restaurantId)
  ) {
    window.sessionStorage.removeItem(lastRestaurantKey);
  }

  window.dispatchEvent(new Event(changeEvent));
}

function getBadge(): { restaurantId: number | null; count: number } {
  if (typeof window === "undefined") {
    return { restaurantId: null, count: 0 };
  }

  try {
    const storedId = window.sessionStorage.getItem(lastRestaurantKey);
    const restaurantId = storedId === null ? NaN : Number(storedId);

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return { restaurantId: null, count: 0 };
    }

    const count = Object.values(read(restaurantId)).reduce(
      (total, quantity) =>
        total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0),
      0,
    );

    return count > 0
      ? { restaurantId, count }
      : { restaurantId: null, count: 0 };
  } catch {
    return { restaurantId: null, count: 0 };
  }
}

function useCartBadge(): { restaurantId: number | null; count: number } {
  const [badge, setBadge] = useState(getBadge);

  useEffect(() => {
    const update = () => setBadge(getBadge());

    update();
    window.addEventListener(changeEvent, update);
    window.addEventListener("storage", update);

    return () => {
      window.removeEventListener(changeEvent, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return badge;
}

export const customerCartStore = { read, write, useCartBadge };