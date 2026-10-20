import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { PaymentDetails } from "../endpoints/customer/place_order_POST.schema";
import { postCustomerPaymentVerify } from "../endpoints/customer/payment_verify_POST.schema";
import { loadRazorpayCheckout } from "./loadRazorpayCheckout";
import { ziptoHooks } from "./ziptoHooks";
import { waitForCheckoutModalClose } from "./waitForCheckoutModalClose";

export function useCustomerOnlineCheckout() {
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function startPayment(
    orderId: number,
    payment: PaymentDetails,
    options?: { onBeforeCheckoutOpen?: () => void },
  ) {
    setIsProcessing(true);
    let completed = false;

    const goToOrders = () => {
      void queryClient.invalidateQueries({
        queryKey: ziptoHooks.keys.customerOrders,
      });
      navigate("/orders");
    };

    const notCompleted = () => {
      if (completed) return;
      completed = true;
      setIsProcessing(false);
      toast.error(
        "Payment not completed. You can pay from My orders or cancel.",
      );
      goToOrders();
    };

    try {
      const Razorpay = await loadRazorpayCheckout();
      const checkout = new Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        order_id: payment.razorpayOrderId,
        name: "platr™",
        description: `platr™ order #${orderId}`,
        prefill: payment.prefill,
        theme: { color: "#FFC400" },
        handler: async (response) => {
          if (completed) return;
          completed = true;
          try {
            await postCustomerPaymentVerify({
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment successful – order sent to restaurant");
          } catch (error) {
            console.error("Customer payment verification failed:", error);
            toast.error(
              "Payment verification could not be completed. Check My orders before trying to pay again, or contact platr™ support.",
            );
          } finally {
            setIsProcessing(false);
            goToOrders();
          }
        },
        modal: { ondismiss: notCompleted },
      });

      checkout.on("payment.failed", notCompleted);
      if (options?.onBeforeCheckoutOpen) {
        options.onBeforeCheckoutOpen();
        await waitForCheckoutModalClose();
      }
      checkout.open();
      setIsProcessing(false);
    } catch (error) {
      console.error("Could not open customer checkout:", error);
      if (!completed) {
        completed = true;
        setIsProcessing(false);
        toast.error(
          error instanceof Error
            ? `${error.message} You can pay from My orders or cancel.`
            : "Could not open payment checkout. You can pay from My orders or cancel.",
        );
        goToOrders();
      }
    }
  }

  return { startPayment, isProcessing };
}