import { useState } from "react";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { CustomerAddress } from "../endpoints/customer/addresses_GET.schema";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { AddressEditDialog } from "./AddressEditDialog";
import styles from "./AddressEntry.module.css";

type Props = {
  address: CustomerAddress;
  isPending: boolean;
  onDelete: () => void;
  onSetDefault: () => void;
  className?: string;
};

export const AddressEntry = ({
  address,
  isPending,
  onDelete,
  onSetDefault,
  className,
}: Props) => {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <article className={`${styles.entry} ${className ?? ""}`}>
      <div className={styles.top}>
        <span className={styles.icon}><MapPin size={20} aria-hidden="true" /></span>
        <div className={styles.title}>
          <Badge variant="secondary">{address.label}</Badge>
          {address.isDefault && <Badge variant="success">Default</Badge>}
        </div>
      </div>
      <p className={styles.address}>{address.address}</p>
      {address.landmark && <p className={styles.detail}>Landmark: {address.landmark}</p>}
      <p className={styles.detail}>{address.town} · {address.phone}</p>
      <div className={styles.actions}>
        <Button variant="secondary" disabled={isPending} onClick={() => setEditOpen(true)}>
          <Pencil size={16} /> Edit
        </Button>
        {!address.isDefault && (
          <Button variant="ghost" disabled={isPending} onClick={onSetDefault}>Set as default</Button>
        )}
        <Button variant="ghost" disabled={isPending} onClick={onDelete}>
          <Trash2 size={16} /> Delete
        </Button>
      </div>
      <AddressEditDialog address={address} open={editOpen} onOpenChange={setEditOpen} />
    </article>
  );
};