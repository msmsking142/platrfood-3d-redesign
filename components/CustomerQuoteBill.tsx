import type { CustomerQuote } from "../endpoints/customer/quote_POST.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Skeleton } from "./Skeleton";
import styles from "./CustomerQuoteBill.module.css";

type CustomerQuoteBillProps = {
  quote?: CustomerQuote;
  isFetching: boolean;
  error: Error | null;
  totalLabel?: string;
  className?: string;
};

export function CustomerQuoteBill({
  quote,
  isFetching,
  error,
  totalLabel = "To pay",
  className,
}: CustomerQuoteBillProps) {
  const settings = ziptoHooks.useSettings();
  if (isFetching || (!quote && !error)) {
    return (
      <div className={`${styles.bill} ${className ?? ""}`} aria-label="Loading price quote">
        <Skeleton />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <p className={`${styles.error} ${className ?? ""}`} role="alert">
        {error?.message ?? "Could not load the price quote. Please try again."}
      </p>
    );
  }

  return (
    <div className={`${styles.bill} ${className ?? ""}`}>
      {quote.lineItems.map((item) =>
        item.key === "total" ? (
          <div key={item.key} className={styles.finalSection}>
            <p className={styles.trust}>
              {quote.platformFee === 0
                ? "Clear pricing. No platform fee at launch."
                : "Clear pricing – every charge is shown before you pay."}
              <br />
              No hidden convenience, handling or checkout fees.
            </p>
            <div className={styles.total}>
              <span>{totalLabel}</span>
              <strong>{ziptoConfig.rupees(quote.total)}</strong>
            </div>
          </div>
        ) : (
          <div key={item.key} className={styles.row}>
            <span>
              {item.label}
              {item.note && <small className={styles.note}>{item.note}</small>}
            </span>
            <span>
              {item.amount < 0 ? "−" : ""}
              {ziptoConfig.rupees(Math.abs(item.amount))}
            </span>
          </div>
        ),
      )}
      {settings.isFetching && <Skeleton />}
      {settings.error && !settings.isFetching && <small className={styles.error} role="alert">Could not load platr™ GSTIN: {settings.error.message}</small>}
      {!settings.isFetching && settings.data?.ziptoGstin && (
        <small className={styles.note}>platr™ GSTIN: {settings.data.ziptoGstin}</small>
      )}
    </div>
  );
}