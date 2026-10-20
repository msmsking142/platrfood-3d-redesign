import { useState, type FormEvent } from "react";
import type { ProtectionSettings } from "../endpoints/admin/delivery_reliability_GET.schema";
import {
  schema as actionSchema,
} from "../endpoints/admin/delivery_protection_action_POST.schema";
import type { SubmitProtectionAction } from "../helpers/useAdminDeliveryReliability";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { Button } from "./Button";
import styles from "./AdminDeliverySettings.module.css";

type NumericKey = {
  [K in keyof ProtectionSettings]: ProtectionSettings[K] extends number ? K : never;
}[keyof ProtectionSettings];

const fields: Array<{
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: "km" | "percent";
}> = [
  { key: "riderSearchRadiusM", label: "Initial radius (km)", min: 0.5, max: 30, step: 0.1, unit: "km" },
  { key: "riderSearchExpandedRadiusM", label: "Expanded radius (km)", min: 0.5, max: 50, step: 0.1, unit: "km" },
  { key: "riderSearchExpandAfterMin", label: "Expand after (min)", min: 1, max: 30 },
  { key: "riderSearchReadyWindowMin", label: "READY priority window (min)", min: 5, max: 10 },
  { key: "riderSearchMaxMin", label: "Max search if never ready (min)", min: 10, max: 120 },
  { key: "riderSearchIncentiveAmount", label: "Incentive per step (₹)", min: 0, max: 200 },
  { key: "riderSearchIncentiveCap", label: "Cap per order (₹)", min: 0, max: 300 },
  { key: "deliveryFailureCompBps", label: "Food value compensation (%)", min: 0, max: 100, step: 0.01, unit: "percent" },
  { key: "deliveryFailureCompMin", label: "Minimum compensation (₹)", min: 0, max: 5000 },
  { key: "deliveryFailureCompMax", label: "Maximum compensation (₹)", min: 0, max: 5000 },
  { key: "deliveryFailurePrepGraceMin", label: "Preparation grace (min)", min: 0, max: 60 },
  { key: "areaPauseFailureThreshold", label: "Failure threshold", min: 1, max: 50 },
  { key: "areaPauseLookbackMin", label: "Lookback (min)", min: 10, max: 1440 },
  { key: "areaPauseDurationMin", label: "Pause duration (min)", min: 5, max: 1440 },
];

function initialValues(settings: ProtectionSettings): Record<NumericKey, string> {
  return Object.fromEntries(fields.map((field) => [
    field.key,
    String(field.unit === "km"
      ? settings[field.key] / 1000
      : field.unit === "percent"
        ? settings[field.key] / 100
        : settings[field.key]),
  ])) as Record<NumericKey, string>;
}

export function AdminDeliverySettings({
  settings, submit, isSaving, className,
}: {
  settings: ProtectionSettings;
  submit: SubmitProtectionAction;
  isSaving: boolean;
  className?: string;
}) {
  const [values, setValues] = useState(() => initialValues(settings));
  const [toggles, setToggles] = useState({
    riderSearchIncentiveEnabled: settings.riderSearchIncentiveEnabled,
    deliveryFailureCompEnabled: settings.deliveryFailureCompEnabled,
    areaPauseEnabled: settings.areaPauseEnabled,
    areaPauseWhenNoRiders: settings.areaPauseWhenNoRiders,
  });
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numbers = Object.fromEntries(fields.map((field) => [
      field.key,
      Number(values[field.key]) * (field.unit === "km" ? 1000
        : field.unit === "percent" ? 100 : 1),
    ]));
    const parsed = actionSchema.safeParse({
      action: "settings",
      ...numbers,
      ...toggles,
    });
    if (!parsed.success || parsed.data.action !== "settings") {
      setError(parsed.success ? "Invalid settings action" : parsed.error.issues[0].message);
      return;
    }
    if (parsed.data.riderSearchExpandedRadiusM < parsed.data.riderSearchRadiusM) {
      setError("Expanded radius must be at least the initial radius.");
      return;
    }
    if (parsed.data.deliveryFailureCompMax < parsed.data.deliveryFailureCompMin) {
      setError("Maximum compensation must be at least the minimum.");
      return;
    }
    try {
      setError(null);
      await submit(parsed.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings");
    }
  }

  function numeric(key: NumericKey) {
    const field = fields.find((item) => item.key === key);
    if (!field) throw new Error(`Unknown delivery setting: ${key}`);
    return (
      <label key={key} className={styles.field}>
        {field.label}
        <Input type="number" min={field.min} max={field.max}
          step={field.step ?? 1} required value={values[key]}
          onChange={(event) => setValues((previous) => ({
            ...previous, [key]: event.target.value,
          }))}
          disabled={isSaving} />
      </label>
    );
  }

  function toggle(key: keyof typeof toggles, label: string, description: string) {
    const id = `reliability-${key}`;
    return (
      <div className={styles.toggle} key={key}>
        <div>
          <label htmlFor={id}>{label}</label>
          <p>{description}</p>
        </div>
        <Switch id={id} checked={toggles[key]} disabled={isSaving}
          onCheckedChange={(checked) => setToggles((previous) => ({
            ...previous, [key]: checked,
          }))} />
      </div>
    );
  }

  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <div className={styles.heading}>
        <h3>Protection settings</h3>
        <p>Changes affect new search decisions. Review distances, rider incentives and compensation before saving.</p>
      </div>
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <fieldset className={styles.group}>
          <legend>Rider search</legend>
          <div className={styles.grid}>
            {numeric("riderSearchRadiusM")}
            {numeric("riderSearchExpandedRadiusM")}
            {numeric("riderSearchExpandAfterMin")}
            {numeric("riderSearchReadyWindowMin")}
            {numeric("riderSearchMaxMin")}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Rider incentive</legend>
          {toggle("riderSearchIncentiveEnabled", "Enable rider incentives", "Offer extra pay as the search escalates.")}
          <div className={styles.grid}>
            {numeric("riderSearchIncentiveAmount")}
            {numeric("riderSearchIncentiveCap")}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Restaurant compensation</legend>
          {toggle("deliveryFailureCompEnabled", "Enable compensation", "Assess eligible delivery-failure cancellations.")}
          <div className={styles.grid}>
            {numeric("deliveryFailureCompBps")}
            {numeric("deliveryFailureCompMin")}
            {numeric("deliveryFailureCompMax")}
            {numeric("deliveryFailurePrepGraceMin")}
          </div>
        </fieldset>
        <fieldset className={styles.group}>
          <legend>Area pause</legend>
          {toggle("areaPauseEnabled", "Automatic area pauses", "Pause a town after repeated delivery failures.")}
          {toggle("areaPauseWhenNoRiders", "Pause when no riders are online", "Block new orders when there are no recently located online riders.")}
          <div className={styles.grid}>
            {numeric("areaPauseFailureThreshold")}
            {numeric("areaPauseLookbackMin")}
            {numeric("areaPauseDurationMin")}
          </div>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Button type="submit" disabled={isSaving} className={styles.save}>
          {isSaving ? "Saving…" : "Save protection settings"}
        </Button>
      </form>
    </section>
  );
}