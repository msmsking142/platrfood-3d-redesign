import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postRiderOnboardingFeeOrder } from "../endpoints/rider/onboarding_fee_order_POST.schema";
import { postRiderOnboardingFeeVerify } from "../endpoints/rider/onboarding_fee_verify_POST.schema";
import { loadRazorpayCheckout } from "./loadRazorpayCheckout";
import { waitForCheckoutModalClose } from "./waitForCheckoutModalClose";
import { ziptoHooks } from "./ziptoHooks";

export function useRiderOnboardingFeeCheckout() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "opening" | "verifying">("idle");
  const busy = useRef(false);

  const start = async (options?: { onBeforeCheckoutOpen?: () => void }) => {
    if (busy.current) return;
    busy.current = true;
    setPhase("opening");

    try {
      const order = await postRiderOnboardingFeeOrder({});
      const Razorpay = await loadRazorpayCheckout();
      let completed = false;
      let failed = false;

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "platr™",
        description: "platr™ rider onboarding fee (one-time)",
        prefill: order.prefill,
        theme: { color: "#FFC400" },
        handler: async (response) => {
          completed = true;
          setPhase("verifying");

          try {
            await postRiderOnboardingFeeVerify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await queryClient.invalidateQueries({
              queryKey: ziptoHooks.keys.riderDashboard,
            });
            toast.success("Onboarding fee paid. Now upload your documents.");
          } catch (error) {
            console.error("Rider onboarding fee verification failed:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not verify the payment. Please contact support.",
            );
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
      console.error("Could not open rider onboarding checkout:", error);
      busy.current = false;
      setPhase("idle");
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not open Razorpay checkout.",
      );
    }
  };

  return { start, phase, isBusy: phase !== "idle" };
}