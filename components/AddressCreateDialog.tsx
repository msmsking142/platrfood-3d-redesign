import { z } from "zod";
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
import styles from "./AddressCreateDialog.module.css";

const createSchema = addressFieldsSchema.extend({
  action: z.literal("create"),
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  defaultIsDefault?: boolean;
};

function CreateForm({
  defaultIsDefault,
  onClose,
}: {
  defaultIsDefault: boolean;
  onClose: () => void;
}) {
  const action = useAddressAction();
  const form = useForm({
    schema: createSchema,
    defaultValues: {
      action: "create",
      label: "Home",
      address: "",
      landmark: "",
      town: "",
      phone: "",
      lat: undefined,
      lng: undefined,
      isDefault: defaultIsDefault,
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
            // The mutation hook displays the error; keep the form open.
          }
        })}
      >
        <AddressFields
          values={form.values}
          disabled={action.isPending}
          onChange={(updates) => form.setValues((previous) => ({ ...previous, ...updates }))}
        />
        <DialogFooter className={styles.footer}>
          <Button type="button" variant="secondary" disabled={action.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={action.isPending}>
            {action.isPending ? "Saving…" : "Save address"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export const AddressCreateDialog = ({
  open,
  onOpenChange,
  className,
  defaultIsDefault,
}: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`${styles.dialog} ${className ?? ""}`}>
      <DialogHeader>
        <DialogTitle>Add new address</DialogTitle>
        <DialogDescription>Save your delivery details for future orders.</DialogDescription>
      </DialogHeader>
      {open && (
        <CreateForm
          defaultIsDefault={defaultIsDefault ?? false}
          onClose={() => onOpenChange(false)}
        />
      )}
    </DialogContent>
  </Dialog>
);