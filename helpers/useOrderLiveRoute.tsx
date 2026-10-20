import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { postCustomerOrderRoute } from "../endpoints/customer/order_route_POST.schema";

export function useOrderLiveRoute(
  orderId: number,
  enabled: boolean,
  riderLocationAt: string | Date | null,
) {
  const query = useQuery({
    queryKey: ["orderLiveRoute", orderId],
    queryFn: () => postCustomerOrderRoute({ orderId }),
    enabled,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  // A real GPS timestamp change is the refresh trigger; there is no polling.
  const pingTimestamp =
    riderLocationAt instanceof Date
      ? riderLocationAt.getTime()
      : riderLocationAt === null
        ? null
        : new Date(riderLocationAt).getTime();

  useEffect(() => {
    if (
      enabled &&
      pingTimestamp !== null &&
      Number.isFinite(pingTimestamp) &&
      query.dataUpdatedAt > 0 &&
      !query.isFetching &&
      Date.now() - query.dataUpdatedAt >= 60_000
    ) {
      void query.refetch();
    }
    // Deliberately trigger on GPS timestamp changes, not on fetch-state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, enabled, pingTimestamp]);

  return query;
}