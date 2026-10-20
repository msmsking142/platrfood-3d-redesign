import { useState, type FormEvent } from "react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction, schema } from "../endpoints/restaurant/action_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Input } from "./Input";
import { MerchantCard, MerchantField } from "./MerchantUi";
import styles from "./MerchantPayoutAccount.module.css";

export const MerchantPayoutAccount = ({
  details,
  panMasked,
  hasPan,
  className,
}: {
  details: OutputType["payoutDetails"];
  panMasked: string | null;
  hasPan: boolean;
  className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    accountHolder: details.accountHolder ?? "",
    accountNumber: "",
    ifsc: "",
    upiId: details.upiId ?? "",
    pan: "",
  });
  const action = ziptoHooks.useAction(
    postRestaurantAction,
    [ziptoHooks.keys.restaurantDashboard],
    "Payout details saved",
  );
  const hasDetails = Boolean(details.accountNumberMasked || details.upiId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ action: "update_payout_details", ...form });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your payout details.");
      return;
    }
    action.mutate(parsed.data, {
      onSuccess: () => {
        setEditing(false);
        setForm((current) => ({ ...current, accountNumber: "", ifsc: "", pan: "" }));
      },
    });
  };

  return (
    <MerchantCard className={className}>
      <div className={styles.heading}>
        <h3>Payout account</h3>
        {!editing && <Button variant="secondary" onClick={() => {
          setForm({
            accountHolder: details.accountHolder ?? "",
            accountNumber: "",
            ifsc: "",
            upiId: details.upiId ?? "",
            pan: "",
          });
          setError(null);
          setEditing(true);
        }}>{hasDetails ? "Edit details" : "Add details"}</Button>}
      </div>
      {!hasDetails && <p role="alert" className={styles.warning}>Add bank or UPI details – payouts are held until then.</p>}
      {!hasPan && <p role="alert" className={styles.warning}>Add your PAN before your first payout.</p>}
      {hasDetails && (
        <dl className={styles.details}>
          <div><dt>Account holder</dt><dd>{details.accountHolder ?? "—"}</dd></div>
          <div><dt>Account number</dt><dd>{details.accountNumberMasked ?? "—"}</dd></div>
          <div><dt>IFSC</dt><dd>{details.ifsc ?? "—"}</dd></div>
          <div><dt>UPI ID</dt><dd>{details.upiId ?? "—"}</dd></div>
        </dl>
      )}
      {hasPan && <p className={styles.hint}>Saved PAN: {panMasked}</p>}
      <p className={styles.hint}>Without PAN, 5% TDS applies by law (Income-tax Act 2025, Sec 393(1)). With PAN it’s only 0.1%.</p>
      {editing && (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.hint}>Enter a bank account and IFSC, or a UPI ID. Saving replaces all existing payout details; re-enter your bank account to keep it.</p>
          <MerchantField label="Account holder">
            <Input required value={form.accountHolder} onChange={(event) => setForm((current) => ({ ...current, accountHolder: event.target.value }))} />
          </MerchantField>
          <MerchantField label="Account number">
            <Input inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))} />
          </MerchantField>
          <MerchantField label="IFSC">
            <Input autoCapitalize="characters" value={form.ifsc} onChange={(event) => setForm((current) => ({ ...current, ifsc: event.target.value }))} />
          </MerchantField>
          <MerchantField label="UPI ID">
            <Input value={form.upiId} onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))} />
          </MerchantField>
          <MerchantField label="PAN">
            <Input placeholder="ABCDE1234F" autoCapitalize="characters" autoComplete="off" maxLength={10} value={form.pan} onChange={(event) => setForm((current) => ({ ...current, pan: event.target.value.toUpperCase() }))} />
          </MerchantField>
          {hasPan && <p className={styles.hint}>Leave PAN blank to keep your saved PAN.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" disabled={action.isPending}>{action.isPending ? "Saving…" : "Save details"}</Button>
            <Button variant="ghost" disabled={action.isPending} onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </MerchantCard>
  );
};