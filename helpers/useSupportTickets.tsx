import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMySupportTickets,
} from "../endpoints/support/my_tickets_GET.schema";
import {
  postSupportTicket,
} from "../endpoints/support/ticket_POST.schema";
import {
  getAdminSupportTickets,
  type InputType as AdminListInput,
} from "../endpoints/admin/support_tickets_GET.schema";
import {
  postAdminSupportAction,
} from "../endpoints/admin/support_action_POST.schema";

export const supportQueryKeys = {
  myTickets: ["support", "mine"] as const,
  admin: ["support", "admin"] as const,
  adminStatus: (status: NonNullable<AdminListInput["status"]>) =>
    ["support", "admin", status] as const,
};

function showError(error: Error): void {
  toast.error(error.message);
}

export function useMySupportTickets(enabled: boolean) {
  return useQuery({
    queryKey: supportQueryKeys.myTickets,
    queryFn: getMySupportTickets,
    enabled,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSupportTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportQueryKeys.myTickets });
      void queryClient.invalidateQueries({ queryKey: supportQueryKeys.admin });
      toast.success("Support request sent");
    },
    onError: showError,
  });
}

export function useAdminSupportTickets(
  status: NonNullable<AdminListInput["status"]> = "open",
) {
  return useQuery({
    queryKey: supportQueryKeys.adminStatus(status),
    queryFn: () => getAdminSupportTickets({ status }),
    placeholderData: (previous) => previous,
  });
}

export function useAdminSupportAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAdminSupportAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportQueryKeys.admin });
      void queryClient.invalidateQueries({ queryKey: supportQueryKeys.myTickets });
      toast.success("Support ticket updated");
    },
    onError: showError,
  });
}