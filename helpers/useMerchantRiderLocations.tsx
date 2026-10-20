import { useEffect, useState } from "react";
import { z } from "zod";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { useRealtimeChannel } from "../components/FlootRealtimeProvider";
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

function seededLocations(data: OutputType): Record<number, Location> {
  const locations: Record<number, Location> = {};
  for (const order of data.orders) {
    if (
      order.riderId !== null &&
      order.riderLat !== null &&
      order.riderLng !== null &&
      order.riderLocationAt !== null
    ) {
      locations[order.id] = {
        lat: order.riderLat,
        lng: order.riderLng,
        at: order.riderLocationAt,
      };
    }
  }
  return locations;
}

export function useMerchantRiderLocations(data: OutputType) {
  const [locations, setLocations] = useState(() => seededLocations(data));

  useEffect(() => {
    const seeded = seededLocations(data);
    setLocations((previous) => {
      const next: Record<number, Location> = {};
      for (const order of data.orders) {
        const live = previous[order.id];
        const baseline = seeded[order.id];
        if (order.riderId === null) continue;
        const location =
          live &&
          (!baseline ||
            new Date(live.at).getTime() >= new Date(baseline.at).getTime())
            ? live
            : baseline;
        if (location) next[order.id] = location;
      }
      return next;
    });
  }, [data]);

  useRealtimeChannel(
    data.restaurant ? channels.restaurantLive(data.restaurant.id) : null,
    (raw: unknown) => {
      const result = locationMessage.safeParse(raw);
      if (!result.success) {
        console.error("Invalid restaurant rider-location message:", raw);
        return;
      }
      const { orderId, lat, lng, at } = result.data;
      if (!data.orders.some((order) => order.id === orderId && order.riderId !== null))
        return;
      setLocations((previous) => {
        const current = previous[orderId];
        if (current && new Date(current.at).getTime() > new Date(at).getTime())
          return previous;
        return { ...previous, [orderId]: { lat, lng, at } };
      });
    },
  );

  return locations;
}