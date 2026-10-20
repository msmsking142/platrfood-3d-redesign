import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAdminAction } from "../endpoints/admin/action_POST.schema";

export function useAdminRefundRetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) =>
      postAdminAction({ action: "retry_order_refund", orderId }),
    // Includes the finance and on-demand payment reconciliation queries,
    // regardless of the reporting-period key currently in use.
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}