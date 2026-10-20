import type { CustomerAddress } from "../endpoints/customer/addresses_GET.schema";
import { Checkbox } from "./Checkbox";
import styles from "./CheckoutAddressPicker.module.css";

export type CheckoutAddressPickerProps = {
  addresses: CustomerAddress[];
  selectedId: number | null;
  onSelect: (address: CustomerAddress | null) => void;
  saveNewAddress: boolean;
  onSaveNewAddressChange: (checked: boolean) => void;
  isFetching: boolean;
  error: Error | null;
  className?: string;
};

export const CheckoutAddressPicker = ({
  addresses,
  selectedId,
  onSelect,
  saveNewAddress,
  onSaveNewAddressChange,
  isFetching,
  error,
  className,
}: CheckoutAddressPickerProps) => (
  <div className={`${styles.picker} ${className ?? ""}`}>
    <span className={styles.heading}>Delivery address</span>
    {error && <p className={styles.error} role="alert">Could not load saved addresses: {error.message}</p>}
    {isFetching && addresses.length === 0 && !error && (
      <p className={styles.hint}>Loading saved addresses…</p>
    )}
    {addresses.length > 0 && (
      <div className={styles.options} aria-label="Saved delivery addresses">
        {addresses.map((address) => (
          <button
            key={address.id}
            type="button"
            className={`${styles.option} ${selectedId === address.id ? styles.selected : ""}`}
            aria-pressed={selectedId === address.id}
            onClick={() => onSelect(address)}
          >
            <strong>{address.label}</strong>
            <span>{address.address}, {address.town}</span>
          </button>
        ))}
      </div>
    )}
    <button
      type="button"
      className={`${styles.option} ${selectedId === null ? styles.selected : ""}`}
      aria-pressed={selectedId === null}
      onClick={() => onSelect(null)}
    >
      New address
    </button>
    {selectedId === null && addresses.length < 10 && (
      <label className={styles.save}>
        <Checkbox
          checked={saveNewAddress}
          onChange={(event) => onSaveNewAddressChange(event.target.checked)}
        />
        Save this address
      </label>
    )}
  </div>
);