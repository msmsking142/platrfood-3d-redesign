import { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";
import { AddressCreateDialog } from "../components/AddressCreateDialog";
import { AddressEntry } from "../components/AddressEntry";
import { Button } from "../components/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { CustomerRoute } from "../components/ProtectedRoute";
import { Skeleton } from "../components/Skeleton";
import { useAddressAction } from "../helpers/useAddressAction";
import { ziptoHooks } from "../helpers/ziptoHooks";
import styles from "./account.addresses.module.css";

function AddressesContent() {
  const addresses = ziptoHooks.useAddresses(true);
  const action = useAddressAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const addressToDelete = addresses.data?.addresses.find((address) => address.id === deleteId);

  return (
    <div className={styles.page}>
      <Helmet><title>Address book | platr™</title></Helmet>
      <Link to="/account" className={styles.back}>← Account</Link>
      <div className={styles.heading}>
        <div>
          <h1>Address book</h1>
          <p>Apna delivery address ready rakho.</p>
        </div>
        <Button
          size="lg"
          disabled={!addresses.data || addresses.data.addresses.length >= 10}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} /> Add new address
        </Button>
      </div>

      {addresses.isFetching && !addresses.data ? (
        <div className={styles.loading} aria-label="Loading addresses">
          <Skeleton className={styles.addressSkeleton} />
          <Skeleton className={styles.addressSkeleton} />
        </div>
      ) : addresses.data ? (
        <>
          {addresses.data.addresses.length >= 10 && (
            <p className={styles.limit}>You’ve saved the maximum of 10 addresses. Delete one to add another.</p>
          )}
          {addresses.data.addresses.length ? (
            <div className={styles.list}>
              {addresses.data.addresses.map((address) => (
                <AddressEntry
                  key={address.id}
                  address={address}
                  isPending={action.isPending}
                  onDelete={() => setDeleteId(address.id)}
                  onSetDefault={() => action.mutate({ action: "set_default", id: address.id })}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <MapPin size={32} aria-hidden="true" />
              <h2>No saved addresses yet</h2>
              <p>Add an address to make checkout easier when ordering opens.</p>
            </div>
          )}
          <AddressCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
        </>
      ) : (
        <div role="alert" className={styles.error}>
          <p>Could not load addresses. {addresses.error instanceof Error ? addresses.error.message : ""}</p>
          <Button onClick={() => void addresses.refetch()}>Retry</Button>
        </div>
      )}

      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open && !action.isPending) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete address?</DialogTitle>
            <DialogDescription>
              {addressToDelete
                ? `Remove your ${addressToDelete.label} address? This cannot be undone.`
                : "This address will be removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary" disabled={action.isPending}>Keep address</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={deleteId === null || action.isPending}
              onClick={async () => {
                if (deleteId === null) return;
                try {
                  await action.mutateAsync({ action: "delete", id: deleteId });
                  setDeleteId(null);
                } catch {
                  // useAddressAction displays the error; keep confirmation open.
                }
              }}
            >
              {action.isPending ? "Deleting…" : "Delete address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountAddressesPage() {
  return <CustomerRoute><AddressesContent /></CustomerRoute>;
}