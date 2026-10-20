import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSettings } from "../endpoints/settings_GET.schema";
import { getRestaurants } from "../endpoints/restaurants_GET.schema";
import { getWalletSummary } from "../endpoints/wallet/summary_GET.schema";
import { getCustomerAddresses } from "../endpoints/customer/addresses_GET.schema";
import { getPaymentMethods } from "../endpoints/payments/methods_GET.schema";
import { getRestaurant } from "../endpoints/restaurant_GET.schema";
import { getCustomerOrders } from "../endpoints/customer/orders_GET.schema";
import { getRestaurantDashboard } from "../endpoints/restaurant/dashboard_GET.schema";
import { getRiderDashboard } from "../endpoints/rider/dashboard_GET.schema";
import { getAdminOverview } from "../endpoints/admin/overview_GET.schema";
import { getAdminFinance } from "../endpoints/admin/finance_GET.schema";
import { getPayoutProviders } from "../endpoints/admin/payout_providers_GET.schema";
import { useRealtimeInvalidation, useRealtimeResync } from "../components/FlootRealtimeProvider";
import { channels } from "./realtimeChannels";

const covers = [
  "/_cdn/static/dd3ad54f-9c2b-4d90-b963-0d9d2c893d30.png",
  "/_cdn/static/80eda57f-86e8-41bc-8ba0-479b59c85e62.png",
  "/_cdn/static/228467e5-5eef-4f63-9597-4a5559060c6c.png",
];

export const ziptoHooks = {
  keys: {
    settings: ["settings"] as const,
    restaurants: (town: string, vegOnly: boolean) => ["restaurants", town, vegOnly] as const,
    wallet: ["wallet"] as const,
    addresses: ["customer", "addresses"] as const,
    paymentMethods: ["payments", "methods"] as const,
    restaurant: (id: number) => ["restaurant", id] as const,
    customerOrders: ["customer", "orders"] as const,
    restaurantDashboard: ["restaurant", "dashboard"] as const,
    riderDashboard: ["rider", "dashboard"] as const,
    adminOverview: ["admin", "overview"] as const,
    adminFinance: (days: number) => ["admin", "finance", days] as const,
    payoutProviders: ["admin", "payoutProviders"] as const,
  },
  coverFor(id: number, imageUrl?: string | null) {
    return imageUrl || covers[id % covers.length];
  },
  heroImage: "/_cdn/static/1149f5e7-eba2-48b5-9ae6-871a086e1b15.png",

  useSettings() {
    return useQuery({ queryKey: ziptoHooks.keys.settings, queryFn: () => getSettings(), staleTime: 5 * 60 * 1000 });
  },
  useRestaurants(town: string, vegOnly = false) {
    return useQuery({
      queryKey: ziptoHooks.keys.restaurants(town, vegOnly),
      queryFn: () => getRestaurants({ town, vegOnly }),
      placeholderData: (previous) => previous,
    });
  },
  useWallet(userId: number | null) {
    const key = ziptoHooks.keys.wallet;
    useRealtimeInvalidation(userId === null ? null : channels.customer(userId), key);
    return useQuery({
      queryKey: key,
      queryFn: () => getWalletSummary(),
      enabled: userId !== null,
    });
  },
  useAddresses(enabled: boolean) {
    return useQuery({
      queryKey: ziptoHooks.keys.addresses,
      queryFn: () => getCustomerAddresses(),
      enabled,
    });
  },
  usePaymentMethods() {
    return useQuery({
      queryKey: ziptoHooks.keys.paymentMethods,
      queryFn: () => getPaymentMethods(),
      staleTime: 30 * 60 * 1000,
    });
  },
  useRestaurant(id: number) {
    return useQuery({ queryKey: ziptoHooks.keys.restaurant(id), queryFn: () => getRestaurant({ id }) });
  },
  useCustomerOrders(userId: number) {
    const key = ziptoHooks.keys.customerOrders;
    useRealtimeInvalidation(channels.customer(userId), key);
    useRealtimeResync([key]);
    return useQuery({ queryKey: key, queryFn: () => getCustomerOrders(), refetchOnMount: "always" });
  },
  useRestaurantDashboard() {
    const key = ziptoHooks.keys.restaurantDashboard;
    const query = useQuery({ queryKey: key, queryFn: () => getRestaurantDashboard(), refetchOnMount: "always" });
    const restaurantId = query.data?.restaurant?.id;
    useRealtimeInvalidation(restaurantId ? channels.restaurant(restaurantId) : null, key);
    useRealtimeResync([key]);
    return query;
  },
  useRiderDashboard() {
    const key = ziptoHooks.keys.riderDashboard;
    const query = useQuery({ queryKey: key, queryFn: () => getRiderDashboard(), refetchOnMount: "always" });
    const rider = query.data?.rider;
    useRealtimeInvalidation(rider ? channels.rider(rider.id) : null, key);
    useRealtimeInvalidation(rider && rider.status === "approved" ? channels.ridersTown(rider.town) : null, key);
    useRealtimeResync([key]);
    return query;
  },
  useAdminOverview() {
    const key = ziptoHooks.keys.adminOverview;
    useRealtimeInvalidation(channels.admin(), key);
    useRealtimeResync([key]);
    return useQuery({ queryKey: key, queryFn: () => getAdminOverview(), refetchOnMount: "always" });
  },
  useAdminFinance(days: number) {
    const key = ziptoHooks.keys.adminFinance(days);
    useRealtimeInvalidation(channels.admin(), key);
    useRealtimeResync([key]);
    return useQuery({
      queryKey: key,
      queryFn: () => getAdminFinance({ days }),
      refetchOnMount: "always",
      placeholderData: (previous) => previous,
    });
  },
  usePayoutProviders() {
    return useQuery({
      queryKey: ziptoHooks.keys.payoutProviders,
      queryFn: () => getPayoutProviders(),
      staleTime: 10 * 60 * 1000,
    });
  },
  useAction<TInput>(
    fn: (input: TInput) => Promise<unknown>,
    invalidate: QueryKey[],
    successMessage?: string | ((input: TInput) => string | undefined),
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: fn,
      onSuccess: (_result, input) => {
        invalidate.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
        const message = typeof successMessage === "function" ? successMessage(input) : successMessage;
        if (message) toast.success(message);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong"),
    });
  },
};