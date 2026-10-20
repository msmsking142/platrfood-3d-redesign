import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import { postAdminAction, schema } from "../endpoints/admin/action_POST.schema";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Input } from "./Input";
import styles from "./AdminWalletCard.module.css";

type Props = {
  wallet: AdminFinance["wallet"];
  isFetching: boolean;
  className?: string;
};

export const AdminWalletCard = ({ wallet, isFetching, className }: Props) => {
  const [userEmail, setUserEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const adjustment = ziptoHooks.useAction(
    postAdminAction,
    [["admin", "finance"]],
    "Customer wallet adjusted.",
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = schema.safeParse({
      action: "wallet_adjust",
      userEmail,
      amount: Number(amount),
      note,
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Enter valid wallet adjustment details.");
      return;
    }

    adjustment.mutate(result.data, {
      onSuccess: () => {
        setUserEmail("");
        setAmount("");
        setNote("");
      },
    });
  };

  return (
    <section className={`${styles.card} ${className ?? ""}`} aria-busy={isFetching}>
      <h3>platr™ Wallet</h3>
      <div className={styles.balance}>
        <span>Total wallet balance (liability)</span>
        <strong>{ziptoConfig.rupees(wallet.totalLiability)}</strong>
        <p>Customer money held as closed-loop wallet balance (non-withdrawable). Keep this amount available in the Razorpay settlement account.</p>
      </div>
      <dl className={styles.figures}>
        <div><dt>Users with balance</dt><dd>{wallet.walletUsers.toLocaleString("en-IN")}</dd></div>
        <div><dt>Top-ups in range</dt><dd>{ziptoConfig.rupees(wallet.topupsInRange)}</dd></div>
        <div><dt>Spent in range</dt><dd>{ziptoConfig.rupees(wallet.spentInRange)}</dd></div>
        <div><dt>Refunds in range</dt><dd>{ziptoConfig.rupees(wallet.refundsInRange)}</dd></div>
      </dl>
      <form className={styles.form} onSubmit={submit}>
        <h4>Adjust a customer's wallet</h4>
        <div className={styles.fields}>
          <label>
            Customer email
            <Input type="email" autoComplete="email" required value={userEmail} onChange={(event) => setUserEmail(event.target.value)} disabled={adjustment.isPending} />
          </label>
          <label>
            Amount (± ₹)
            <Input type="number" step="1" min="-10000" max="10000" required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={adjustment.isPending} />
          </label>
          <label>
            Reason
            <Input required minLength={3} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} disabled={adjustment.isPending} />
          </label>
        </div>
        <Button type="submit" disabled={adjustment.isPending}>
          {adjustment.isPending ? "Saving…" : "Adjust wallet"}
        </Button>
      </form>
    </section>
  );
};