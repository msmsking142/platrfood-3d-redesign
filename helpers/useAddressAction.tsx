import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  postCustomerAddressAction,
  type InputType,
} from "../endpoints/customer/address_action_POST.schema";
import { ziptoHooks } from "./ziptoHooks";

export function useAddressAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InputType) => postCustomerAddressAction(input),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.addresses });
      toast.success(
        input.action === "create" ? "Address added"
          : input.action === "update" ? "Address updated"
          : input.action === "delete" ? "Address deleted"
          : "Default address updated",
      );
    },
    onError: (error) => {
      console.error("Address action failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not save address");
    },
  });
}