import { z } from "zod";
import type { CustomerAddress } from "../endpoints/customer/addresses_GET.schema";
import { addressFieldsSchema } from "../endpoints/customer/address_action_POST.schema";
import { useAddressAction } from "../helpers/useAddressAction";
import { AddressFields } from "./AddressFields";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Form, useForm } from "./Form";
import styles from "./AddressEditDialog.module.css";

const editSchema = addressFieldsSchema.extend({
  action: z.literal("update"),
  id: z.number().int().positive(),
});

type Props = {
  address: CustomerAddress;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

function EditForm({ address, onClose }: { address: CustomerAddress; onClose: () => void }) {
  const action = useAddressAction();
  const form = useForm({
    schema: editSchema,
    defaultValues: {
      action: "update",
      id: address.id,
      label: address.label === "Work" || address.label === "Other" ? address.label : "Home",
      address: address.address,
      landmark: address.landmark ?? "",
      town: address.town,
      phone: address.phone,
      lat: address.lat ?? undefined,
      lng: address.lng ?? undefined,
      isDefault: address.isDefault,
    },
  });

  return (
    <Form {...form}>
      <form
        className={styles.form}
        onSubmit={form.handleSubmit(async (input) => {
          try {
            await action.mutateAsync(input);
            onClose();
          } catch {
            // The mutation hook displays the error.
          }
        })}
      >
        <AddressFields
          values={form.values}
          disabled={action.isPending}
          onChange={(updates) => form.setValues((previous) => ({ ...previous, ...updates }))}
        />
        <DialogFooter className={styles.footer}>
          <Button type="button" variant="secondary" disabled={action.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={action.isPending}>
            {action.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export const AddressEditDialog = ({ address, open, onOpenChange, className }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`${styles.dialog} ${className ?? ""}`}>
      <DialogHeader>
        <DialogTitle>Edit address</DialogTitle>
        <DialogDescription>Update your delivery details.</DialogDescription>
      </DialogHeader>
      {open && <EditForm key={address.id} address={address} onClose={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
);