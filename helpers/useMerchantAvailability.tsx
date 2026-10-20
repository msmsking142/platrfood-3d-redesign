import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { ziptoHooks } from "./ziptoHooks";
import { ziptoSound } from "./ziptoSound";

/** One availability action shared by the merchant header and overview. */
export const useMerchantAvailability = () => {
  const action = ziptoHooks.useAction(
    postRestaurantAction,
    [ziptoHooks.keys.restaurantDashboard],
    (input) =>
      input.action === "set_open"
        ? input.isOpen
          ? "Outlet is now open"
          : "Outlet closed"
        : undefined,
  );

  return {
    isPending: action.isPending,
    setOpen: (isOpen: boolean) => {
      ziptoSound.playToggle(isOpen);
      action.mutate({ action: "set_open", isOpen });
    },
  };
};