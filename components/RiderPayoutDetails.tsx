import { useState, type FormEvent } from "react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { postRiderAction, schema } from "../endpoints/rider/action_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Input } from "./Input";
import { MerchantCard, MerchantField } from "./MerchantUi";
import styles from "./RiderPayoutDetails.module.css";

export const RiderPayoutDetails = ({
  details,
  className,
}: {
  details: OutputType["payoutDetails"];
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    accountHolder: details.accountHolder ?? "",
    accountNumber: "",
    ifsc: "",
    upiId: details.upiId ?? "",
  });
  const action = ziptoHooks.useAction(
    postRiderAction,
    [ziptoHooks.keys.riderDashboard],
    "Payout details saved",
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schema.safeParse({ action: "update_payout_details", ...form });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your payout details.");
      return;
    }
    if (parsed.data.action !== "update_payout_details") {
      throw new Error("Unexpected rider payout action");
    }
    if (Boolean(parsed.data.accountNumber) !== Boolean(parsed.data.ifsc)) {
      setError("Bank account and IFSC must be provided together.");
      return;
    }
    if (!parsed.data.accountNumber && !parsed.data.upiId) {
      setError("Add a bank account and IFSC, or a UPI ID.");
      return;
    }
    setError("");
    action.mutate(parsed.data, {
      onSuccess: () => {
        setEditing(false);
        setForm((current) => ({ ...current, accountNumber: "", ifsc: "" }));
      },
    });
  };

  return (
    <MerchantCard className={className}>
      <div className={styles.heading}>
        <h2>Payout details</h2>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {details.hasDetails ? "Edit details" : "Add details"}
          </Button>
        )}
      </div>
      {!details.hasDetails && <p className={styles.warning}>Add a UPI ID or bank account to receive payouts.</p>}
      {details.hasDetails && (
        <dl className={styles.details}>
          <div><dt>Account holder</dt><dd>{details.accountHolder ?? "—"}</dd></div>
          <div><dt>Bank account</dt><dd>{details.accountNumberLast4 ? `••••${details.accountNumberLast4}` : "—"}</dd></div>
          <div><dt>IFSC</dt><dd>{details.ifsc ?? "—"}</dd></div>
          <div><dt>UPI ID</dt><dd>{details.upiId ?? "—"}</dd></div>
        </dl>
      )}
      {editing && (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.hint}>
            Enter a bank account and IFSC, or a UPI ID. Saving replaces all existing payout details.
            Re-enter your bank account to keep it.
          </p>
          <MerchantField label="Account holder">
            <Input required value={form.accountHolder} onChange={(event) => setForm((current) => ({ ...current, accountHolder: event.target.value }))} />
          </MerchantField>
          <MerchantField label="Bank account number">
            <Input inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))} />
          </MerchantField>
          <MerchantField label="IFSC">
            <Input autoCapitalize="characters" value={form.ifsc} onChange={(event) => setForm((current) => ({ ...current, ifsc: event.target.value }))} />
          </MerchantField>
          <MerchantField label="UPI ID">
            <Input value={form.upiId} onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))} />
          </MerchantField>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" disabled={action.isPending}>{action.isPending ? "Saving…" : "Save details"}</Button>
            <Button variant="ghost" disabled={action.isPending} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
    </MerchantCard>
  );
};