import { useQuery } from "@tanstack/react-query";
import { getAdminPaymentReconcile } from "../endpoints/admin/payment_reconcile_GET.schema";

export function useAdminPaymentReconcile() {
  return useQuery({
    queryKey: ["admin", "paymentReconcile"] as const,
    queryFn: () => getAdminPaymentReconcile(),
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });
}