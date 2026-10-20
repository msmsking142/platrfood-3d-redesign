import type { ComponentProps } from "react";
import { PhoneCall } from "lucide-react";
import { Button } from "./Button";

export const ZIPTO_SUPPORT_PHONE = "+918064261835";
type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

export function CallSupportButton({
  label = "Call support",
  variant = "secondary",
  size,
  className,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={`tel:${ZIPTO_SUPPORT_PHONE}`} aria-label={`${label}, +91 80642 61835`}>
        <PhoneCall size={16} aria-hidden="true" /> {label}
      </a>
    </Button>
  );
}