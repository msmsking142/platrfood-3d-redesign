import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  useRealtimeChannel,
  useRealtimeClient,
} from "../components/FlootRealtimeProvider";
import type { OrderView } from "./orderView";
import { channels } from "./realtimeChannels";

const locationMessage = z.object({
  type: z.literal("rider_location"),
  orderId: z.number().int(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  at: z.union([z.string().datetime(), z.date()]),
});

type Location = {
  lat: number;
  lng: number;
  at: Date | string;
};

type StoredLocation = {
  orderId: number;
  riderId: number;
  location: Location;
};

const trackingStatuses: ReadonlySet<OrderView["status"]> = new Set([
  "accepted",
  "preparing",
  "ready",
  "picked_up",
]);

function seedLocation(order: OrderView): StoredLocation | null {
  if (
    !trackingStatuses.has(order.status) ||
    order.riderId === null ||
    order.riderLat === null ||
    order.riderLng === null ||
    order.riderLocationAt === null
  ) {
    return null;
  }

  return {
    orderId: order.id,
    riderId: order.riderId,
    location: {
      lat: order.riderLat,
      lng: order.riderLng,
      at: order.riderLocationAt,
    },
  };
}

export function useCustomerRiderLocation(
  order: OrderView,
): Location | null {
  const [stored, setStored] = useState<StoredLocation | null>(() =>
    seedLocation(order),
  );
  const active = trackingStatuses.has(order.status) && order.riderId !== null;
  const channel = active ? channels.orderLive(order.id) : null;
  const client = useRealtimeClient();
  const refreshedOrderIds = useRef(new Set<number>());
  const seed = seedLocation(order);

  useEffect(() => {
    if (channel === null || refreshedOrderIds.current.has(order.id)) return;
    refreshedOrderIds.current.add(order.id);
    client.refreshGrants();
  }, [channel, client, order.id]);

  useEffect(() => {
    setStored((previous) => {
      if (!active || order.riderId === null) return null;
      if (
        previous?.orderId !== order.id ||
        previous.riderId !== order.riderId
      ) {
        return seed;
      }
      if (
        seed &&
        new Date(seed.location.at).getTime() >
          new Date(previous.location.at).getTime()
      ) {
        return seed;
      }
      return previous;
    });
  }, [
    active,
    order.id,
    order.riderId,
    order.riderLat,
    order.riderLng,
    order.riderLocationAt,
    seed?.location.at,
  ]);

  useRealtimeChannel(channel, (raw: unknown) => {
    const parsed = locationMessage.safeParse(raw);
    if (!parsed.success) {
      console.error("Invalid customer rider-location message:", raw);
      return;
    }

    const { orderId, lat, lng, at } = parsed.data;
    if (orderId !== order.id || order.riderId === null) return;
    const activeRiderId = order.riderId;

    setStored((previous) => {
      const current =
        previous?.orderId === order.id &&
        previous.riderId === activeRiderId
          ? previous
          : seed;

      if (
        current &&
        new Date(current.location.at).getTime() >= new Date(at).getTime()
      ) {
        return current;
      }

      return {
        orderId: order.id,
        riderId: activeRiderId,
        location: { lat, lng, at },
      };
    });
  });

  if (!active || order.riderId === null) return null;
  if (
    stored?.orderId !== order.id ||
    stored.riderId !== order.riderId
  ) {
    return seed?.location ?? null;
  }
  if (
    seed &&
    new Date(seed.location.at).getTime() >
      new Date(stored.location.at).getTime()
  ) {
    return seed.location;
  }
  return stored.location;
}