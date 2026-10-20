import type { ComponentProps } from "react";
import { Phone } from "lucide-react";
import { useCall } from "./CallProvider";
import { Button } from "./Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import styles from "./OrderCallButton.module.css";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

export type OrderCallButtonProps = {
  orderId: number;
  target: "rider" | "customer" | "restaurant";
  label: string;
  disabledReason?: string | null;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function OrderCallButton({
  orderId,
  target,
  label,
  disabledReason,
  variant = "secondary",
  size,
  className,
}: OrderCallButtonProps) {
  const { startCall, state, support } = useCall();
  const reason = disabledReason ?? (!support.available ? support.reason : null);
  const disabled =
    disabledReason != null || !support.available || state.status !== "idle";

  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      aria-label={`${label} (private in-app call)`}
      onClick={() => void startCall(orderId, target)}
    >
      <Phone aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <span className={`${styles.wrapper} ${className ?? ""}`}>
      {reason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={styles.tooltipTrigger} tabIndex={0}>
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      {reason && <span className={styles.reason}>{reason}</span>}
    </span>
  );
}