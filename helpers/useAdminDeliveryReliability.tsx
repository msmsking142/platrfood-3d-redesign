import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminDeliveryReliability,
} from "../endpoints/admin/delivery_reliability_GET.schema";
import {
  postAdminDeliveryProtectionAction,
  type InputType,
} from "../endpoints/admin/delivery_protection_action_POST.schema";
import { channels } from "./realtimeChannels";
import {
  useRealtimeInvalidation,
  useRealtimeResync,
} from "../components/FlootRealtimeProvider";

export type SubmitProtectionAction = (input: InputType) => Promise<void>;

export function useAdminDeliveryReliability(days: number) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "deliveryReliability", days] as const;
  useRealtimeInvalidation(channels.admin(), ["admin", "deliveryReliability"]);
  useRealtimeResync([queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => getAdminDeliveryReliability({ days }),
    placeholderData: (previous) => previous,
    refetchOnMount: "always",
  });

  const mutation = useMutation({
    mutationFn: postAdminDeliveryProtectionAction,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "deliveryReliability"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
      toast.success(result.message);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delivery protection action failed");
    },
  });

  const submit: SubmitProtectionAction = async (input) => {
    await mutation.mutateAsync(input);
  };

  return { query, submit, isSaving: mutation.isPending };
}