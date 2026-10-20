import type { ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import { CustomerCartView } from "./CustomerCartView";
import { Sheet, SheetContent, SheetTitle } from "./Sheet";
import styles from "./RestaurantCartSheet.module.css";

type RestaurantCartSheetProps = Omit<ComponentProps<typeof CustomerCartView>, "variant" | "className"> & {
  count: number;
  total: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

export function RestaurantCartSheet({
  count, total, open, onOpenChange, className, ...cartProps
}: RestaurantCartSheetProps) {
  return (
    <div className={`${styles.mobile} ${className ?? ""}`}>
      {count > 0 && (
        <button type="button" className={styles.bar} onClick={() => onOpenChange(true)}>
          <span>{count} item{count === 1 ? "" : "s"} · {total}</span>
          <strong>View cart →</strong>
        </button>
      )}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className={styles.sheetContent}>
          <SheetTitle className={styles.screenReaderOnly}>My Cart</SheetTitle>
          <button type="button" className={styles.back} onClick={() => onOpenChange(false)}>
            <ArrowLeft size={20} aria-hidden="true" /> Back to menu
          </button>
          <CustomerCartView {...cartProps} variant="sheet" className={styles.cartView} />
        </SheetContent>
      </Sheet>
    </div>
  );
}