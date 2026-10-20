import type { CustomerQuote } from "../endpoints/customer/quote_POST.schema";
import styles from "./CustomerQuoteAvailability.module.css";

type CustomerQuoteAvailabilityProps = {
  quote?: CustomerQuote;
  locating: boolean;
  onUseLocation: () => void;
  className?: string;
};

export function CustomerQuoteAvailability({
  quote,
  locating,
  onUseLocation,
  className,
}: CustomerQuoteAvailabilityProps) {
  if (!quote) return null;

  return (
    <div className={`${styles.availability} ${className ?? ""}`}>
      {quote.distanceSource === "estimated" ? (
        <button
          type="button"
          className={styles.location}
          disabled={locating}
          onClick={onUseLocation}
        >
          {locating
            ? "Finding your location…"
            : "📍 Use my location for an exact delivery fee"}
        </button>
      ) : (
        <span>Delivery fee based on your location</span>
      )}
      {quote.outOfRange && (
        <p className={styles.warning}>
          This address is beyond the {quote.maxDeliveryKm} km delivery range
        </p>
      )}
      {!quote.serviceAvailable && (
        <p className={styles.warning}>platr™ is not delivering here yet</p>
      )}
    </div>
  );
}