import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postRestaurantProOrder } from "../endpoints/restaurant/pro_order_POST.schema";
import { postRestaurantProVerify } from "../endpoints/restaurant/pro_verify_POST.schema";
import { loadRazorpayCheckout } from "./loadRazorpayCheckout";
import { ziptoHooks } from "./ziptoHooks";
import { waitForCheckoutModalClose } from "./waitForCheckoutModalClose";

export function formatProDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function useMerchantProCheckout() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "opening" | "verifying">("idle");
  const [lastState, setLastState] = useState<"active" | "awaiting_activation" | null>(null);
  const busy = useRef(false);

  const start = async (options?: { onBeforeCheckoutOpen?: () => void }) => {
    if (busy.current) return;
    busy.current = true;
    setLastState(null);
    setPhase("opening");

    try {
      const order = await postRestaurantProOrder({});
      const Razorpay = await loadRazorpayCheckout();
      let completed = false;
      let failed = false;

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "platr™",
        description: "platr™ Pro plan · 30 days",
        prefill: order.prefill,
        theme: { color: "#FFC400" },
        handler: async (response) => {
          completed = true;
          setPhase("verifying");
          try {
            const verified = await postRestaurantProVerify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await queryClient.invalidateQueries({
              queryKey: ziptoHooks.keys.restaurantDashboard,
            });
            if (verified.state === "awaiting_activation") {
              setLastState("awaiting_activation");
            } else if (verified.proPaidUntil) {
              setLastState("active");
              toast.success(`Payment successful – Pro plan active till ${formatProDate(verified.proPaidUntil)}`);
            } else {
              throw new Error("Payment was received, but the Pro expiry date is unavailable. Please contact support.");
            }
          } catch (error) {
            console.error("Pro payment verification failed:", error);
            toast.error(error instanceof Error ? error.message : "Could not verify the Pro payment. Please contact support.");
          } finally {
            busy.current = false;
            setPhase("idle");
          }
        },
        modal: {
          ondismiss: () => {
            if (completed || failed) return;
            busy.current = false;
            setPhase("idle");
            toast.info("Payment cancelled");
          },
        },
      });

      checkout.on("payment.failed", () => {
        failed = true;
        busy.current = false;
        setPhase("idle");
        toast.error("Payment failed. Please try again.");
      });
      options?.onBeforeCheckoutOpen?.();
      await waitForCheckoutModalClose();
      checkout.open();
    } catch (error) {
      console.error("Could not open Pro checkout:", error);
      busy.current = false;
      setPhase("idle");
      toast.error(error instanceof Error ? error.message : "Could not open Razorpay checkout.");
    }
  };

  return { start, phase, isBusy: phase !== "idle", lastState, clearLastState: () => setLastState(null) };
}