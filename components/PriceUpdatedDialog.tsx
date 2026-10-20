import type { CustomerQuote } from "../endpoints/customer/quote_POST.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { CustomerQuoteBill } from "./CustomerQuoteBill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import { Spinner } from "./Spinner";
import styles from "./PriceUpdatedDialog.module.css";

type PriceUpdatedDialogProps = {
  data: { message: string; quote: CustomerQuote } | null;
  placing: boolean;
  confirmDisabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  className?: string;
};

export function PriceUpdatedDialog({
  data, placing, confirmDisabled, onCancel, onConfirm, className,
}: PriceUpdatedDialogProps) {
  return (
    <Dialog open={data !== null} onOpenChange={(open) => {
      if (!open && !placing) onCancel();
    }}>
      <DialogContent className={`${styles.dialog} ${className ?? ""}`}>
        <DialogHeader><DialogTitle>Price updated</DialogTitle></DialogHeader>
        {data && (
          <>
            <p className={styles.muted}>{data.message}</p>
            <CustomerQuoteBill
              quote={data.quote}
              isFetching={false}
              error={null}
              totalLabel="Total payable"
            />
            <div className={styles.actions}>
              <Button variant="outline" disabled={placing} onClick={onCancel}>Cancel</Button>
              <Button disabled={placing || confirmDisabled} onClick={onConfirm}>
                {placing ? <Spinner size="sm" /> : null}
                Confirm new total {ziptoConfig.rupees(data.quote.total)}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}