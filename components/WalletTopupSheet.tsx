import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./Sheet";
import { WALLET_LIMITS } from "../endpoints/wallet/summary_GET.schema";
import { useWalletTopup } from "../helpers/useWalletTopup";
import { ziptoConfig } from "../helpers/ziptoConfig";
import styles from "./WalletTopupSheet.module.css";

export type WalletTopupSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeCheckoutOpen?: () => void;
  initialAmount?: number;
  balance: number;
  className?: string;
};

export const WalletTopupSheet = ({
  open,
  onOpenChange,
  onBeforeCheckoutOpen,
  initialAmount,
  balance,
  className,
}: WalletTopupSheetProps) => {
  const [amountText, setAmountText] = useState(String(initialAmount ?? WALLET_LIMITS.quickAmounts[0]));
  const { startTopup, isProcessing } = useWalletTopup();
  const amount = amountText.trim() === "" ? NaN : Number(amountText);
  const remaining = Math.max(0, WALLET_LIMITS.maxBalance - balance);
  const error = !Number.isInteger(amount) || amount < WALLET_LIMITS.minTopup
    ? `Enter at least ${ziptoConfig.rupees(WALLET_LIMITS.minTopup)} in whole rupees.`
    : amount > WALLET_LIMITS.maxTopup
      ? `Maximum ${ziptoConfig.rupees(WALLET_LIMITS.maxTopup)} per top-up.`
      : amount > remaining
        ? `Only ${ziptoConfig.rupees(remaining)} room remains in your wallet.`
        : null;

  useEffect(() => {
    if (open) setAmountText(String(initialAmount ?? WALLET_LIMITS.quickAmounts[0]));
  }, [open, initialAmount]);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!isProcessing) onOpenChange(next); }}>
      <SheetContent side="bottom" className={`${styles.sheet} ${className ?? ""}`}>
        <SheetHeader>
          <SheetTitle>Add money to platr™ Wallet</SheetTitle>
          <SheetDescription>Choose an amount or enter your own, then pay securely online.</SheetDescription>
        </SheetHeader>
        <div className={styles.body}>
          <div className={styles.room}>
            <span>Current balance <strong>{ziptoConfig.rupees(balance)}</strong></span>
            <span>Room to add <strong>{ziptoConfig.rupees(remaining)}</strong></span>
          </div>
          <div className={styles.chips} aria-label="Quick top-up amounts">
            {WALLET_LIMITS.quickAmounts.map((quickAmount) => (
              <button
                type="button"
                key={quickAmount}
                className={`${styles.chip} ${amount === quickAmount ? styles.selected : ""}`}
                onClick={() => setAmountText(String(quickAmount))}
                disabled={isProcessing}
                aria-pressed={amount === quickAmount}
              >
                {ziptoConfig.rupees(quickAmount)}
              </button>
            ))}
          </div>
          <label className={styles.field} htmlFor="wallet-topup-amount">
            <span>Custom amount · whole rupees</span>
            <Input
              id="wallet-topup-amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amountText}
              disabled={isProcessing}
              aria-invalid={Boolean(error)}
              aria-describedby="wallet-topup-error"
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) setAmountText(event.target.value);
              }}
            />
          </label>
          <p className={styles.error} id="wallet-topup-error" role={error ? "alert" : undefined}>
            {error ?? `Top up ${ziptoConfig.rupees(WALLET_LIMITS.minTopup)}–${ziptoConfig.rupees(WALLET_LIMITS.maxTopup)} at a time.`}
          </p>
          <p className={styles.note}>Wallet balance can be used only on platr™ and is non-withdrawable.</p>
        </div>
        <SheetFooter>
          <Button
            size="lg"
            disabled={Boolean(error) || isProcessing}
            onClick={async () => {
              try {
                await startTopup(amount, {
                  onBeforeCheckoutOpen: () => {
                    onOpenChange(false);
                    onBeforeCheckoutOpen?.();
                  },
                });
              } catch {
                // useWalletTopup displays the payment or verification error.
              }
            }}
          >
            {isProcessing ? "Processing…" : `Add ${Number.isFinite(amount) ? ziptoConfig.rupees(amount) : "money"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};