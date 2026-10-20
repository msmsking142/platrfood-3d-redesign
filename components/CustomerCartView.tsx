import type { ReactNode } from "react";
import {
  BadgeIndianRupee,
  ChevronRight,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import type { CustomerQuote } from "../endpoints/customer/quote_POST.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { CustomerQuoteBill } from "./CustomerQuoteBill";
import styles from "./CustomerCartView.module.css";

type CartLine = {
  id: number;
  name: string;
  price: number;
  qty: number;
  imageUrl: string | null;
  isVeg: boolean;
};

type CustomerCartViewProps = {
  lines: CartLine[];
  onChange: (itemId: number, delta: number) => void;
  deliverTo: { title: string; address: string } | null;
  onAddressClick: () => void;
  quote?: CustomerQuote;
  isFetching: boolean;
  error: Error | null;
  availability?: ReactNode;
  platformFee: number;
  payLabel: string;
  onProceed: () => void;
  proceedDisabled: boolean;
  variant: "sheet" | "panel";
  className?: string;
};

export function CustomerCartView({
  lines,
  onChange,
  deliverTo,
  onAddressClick,
  quote,
  isFetching,
  error,
  availability,
  platformFee,
  payLabel,
  onProceed,
  proceedDisabled,
  variant,
  className,
}: CustomerCartViewProps) {
  const payParts = payLabel.match(/^(.*?)(\s*\([^)]*\))$/);

  return (
    <section
      className={`${styles.cart} ${variant === "sheet" ? styles.sheet : styles.panel} ${className ?? ""}`}
      aria-label="My cart"
    >
      <h2 className={styles.heading}>My Cart</h2>

      {lines.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingBag size={40} strokeWidth={1.5} aria-hidden="true" />
          <h3>Your cart is empty</h3>
          <p>Add something you love from the menu to get started.</p>
        </div>
      ) : (
        <>
          <button type="button" className={styles.address} onClick={onAddressClick}>
            <span className={styles.addressIcon}><MapPin size={21} aria-hidden="true" /></span>
            <span className={styles.addressCopy}>
              <strong>{deliverTo ? `Deliver to ${deliverTo.title}` : "Add delivery address"}</strong>
              <span className={styles.addressSubtitle}>
                {deliverTo?.address ?? "Choose where we should deliver your order"}
              </span>
            </span>
            <ChevronRight size={19} className={styles.chevron} aria-hidden="true" />
          </button>

          <div className={styles.items} aria-label="Cart items">
            {lines.map((line) => (
              <div className={styles.item} key={line.id}>
                {line.imageUrl ? (
                  <img className={styles.thumbnail} src={line.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.thumbnailFallback}>
                    <UtensilsCrossed size={23} aria-hidden="true" />
                  </span>
                )}
                <div className={styles.itemInfo}>
                  <div className={styles.itemName}>
                    <span
                      className={line.isVeg ? styles.veg : styles.nonVeg}
                      aria-label={line.isVeg ? "Vegetarian" : "Non-vegetarian"}
                    />
                    <strong>{line.name}</strong>
                  </div>
                  <span className={styles.itemDetail}>
                    ×{line.qty} · {ziptoConfig.rupees(line.price * line.qty)}
                  </span>
                </div>
                <div className={styles.stepper} aria-label={`Quantity for ${line.name}`}>
                  <button
                    type="button"
                    className={styles.decrease}
                    onClick={() => onChange(line.id, -1)}
                    aria-label={`Remove one ${line.name}`}
                  >
                    <Minus size={15} aria-hidden="true" />
                  </button>
                  <span className={styles.quantity}>{line.qty}</span>
                  <button
                    type="button"
                    className={styles.increase}
                    onClick={() => onChange(line.id, 1)}
                    aria-label={`Add one ${line.name}`}
                    disabled={line.qty >= 20}
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.pricingNote}>
            <span className={styles.pricingIcon}>
              <BadgeIndianRupee size={22} aria-hidden="true" />
            </span>
            <div>
              <strong>Clear pricing with platr™</strong>
              <p>
                Menu-rate prices.{" "}
                {platformFee === 0
                  ? "No platform fee at launch."
                  : "Every charge shown before you pay."}
              </p>
            </div>
          </div>

          <div className={styles.bill}>
            <CustomerQuoteBill
              quote={quote}
              isFetching={isFetching}
              error={error}
              totalLabel="Total payable"
            />
            {availability}
          </div>

          <div className={styles.payArea}>
            <button
              type="button"
              className={styles.payButton}
              disabled={proceedDisabled}
              onClick={onProceed}
            >
              <span className={styles.payText}>
                {payParts ? (
                  <>
                    <span>{payParts[1]}</span>
                    <span className={styles.payAmount}>{payParts[2]}</span>
                  </>
                ) : (
                  payLabel
                )}
              </span>
              <img
                className={styles.cartImage}
                src="/_cdn/static/b6659724-d8c3-472d-ac2e-0087d9a26e9e.png"
                alt=""
                aria-hidden="true"
              />
            </button>
          </div>
        </>
      )}
    </section>
  );
}