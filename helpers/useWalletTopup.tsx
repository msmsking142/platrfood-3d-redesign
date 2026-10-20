import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postWalletTopup } from "../endpoints/wallet/topup_POST.schema";
import { postWalletTopupVerify } from "../endpoints/wallet/topup_verify_POST.schema";
import { loadRazorpayCheckout } from "./loadRazorpayCheckout";
import { ziptoConfig } from "./ziptoConfig";
import { ziptoHooks } from "./ziptoHooks";
import { waitForCheckoutModalClose } from "./waitForCheckoutModalClose";

const incompleteMessage =
  "Top-up not completed (if the money was deducted it will be added automatically once confirmed by Razorpay).";

export function useWalletTopup(): {
  startTopup: (amount: number, options?: { onBeforeCheckoutOpen?: () => void }) => Promise<void>;
  isProcessing: boolean;
} {
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const queryClient = useQueryClient();

  async function startTopup(
    amount: number,
    options?: { onBeforeCheckoutOpen?: () => void },
  ): Promise<void> {
    if (processingRef.current) throw new Error("A wallet top-up is already in progress.");
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const { walletTxnId, payment } = await postWalletTopup({ amount });
      const Razorpay = await loadRazorpayCheckout();
      options?.onBeforeCheckoutOpen?.();
      await waitForCheckoutModalClose();

      await new Promise<void>((resolve, reject) => {
        let completed = false;
        const fail = (error: Error) => {
          if (completed) return;
          completed = true;
          reject(error);
        };

        const checkout = new Razorpay({
          key: payment.keyId,
          amount: payment.amount,
          currency: payment.currency,
          order_id: payment.razorpayOrderId,
          name: "platr™",
          description: "platr™ Wallet top-up",
          prefill: payment.prefill,
          theme: { color: "#FFC400" },
          handler: async (response) => {
            if (completed) return;
            completed = true;
            try {
              await postWalletTopupVerify({
                walletTxnId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              await queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.wallet });
              toast.success(`${ziptoConfig.rupees(amount)} added to your platr™ Wallet`);
              resolve();
            } catch (error) {
              console.error("Wallet top-up verification failed:", error);
              reject(error instanceof Error ? error : new Error("Could not verify wallet top-up"));
            }
          },
          modal: { ondismiss: () => fail(new Error(incompleteMessage)) },
        });

        checkout.on("payment.failed", () => fail(new Error(incompleteMessage)));
        try {
          checkout.open();
        } catch (error) {
          fail(error instanceof Error ? error : new Error("Could not open Razorpay checkout"));
        }
      });
    } catch (error) {
      console.error("Wallet top-up failed:", error);
      toast.error(error instanceof Error ? error.message : incompleteMessage);
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }

  return { startTopup, isProcessing };
}