import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import { schema, type InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { deliveryPricing, type DeliverySlab } from "../helpers/deliveryPricing";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { Button } from "./Button";
import { Input } from "./Input";
import { Switch } from "./Switch";
import styles from "./AdminServiceAreas.module.css";

type Area = AdminFinance["serviceAreas"][number];
type OverrideKey =
  | "deliveryPerKmBeyond"
  | "deliveryMinFee"
  | "deliveryMaxFee"
  | "maxDeliveryKm"
  | "riderBasePay"
  | "riderPerKm";

const overrideFields: { key: OverrideKey; label: string }[] = [
  { key: "deliveryPerKmBeyond", label: "₹/km beyond last slab" },
  { key: "deliveryMinFee", label: "Minimum delivery fee ₹" },
  { key: "deliveryMaxFee", label: "Maximum delivery fee ₹" },
  { key: "maxDeliveryKm", label: "Maximum delivery km" },
  { key: "riderBasePay", label: "Rider base pay ₹" },
  { key: "riderPerKm", label: "Rider ₹/km" },
];

type Props = {
  areas: AdminFinance["serviceAreas"];
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  className?: string;
};

export const AdminServiceAreas = ({ areas, onAction, isPending, className }: Props) => {
  const [editing, setEditing] = useState<Area | null>(null);
  const [town, setTown] = useState("");
  const [active, setActive] = useState(true);
  const [note, setNote] = useState("");
  const [overrides, setOverrides] = useState<Record<OverrideKey, string>>({
    deliveryPerKmBeyond: "",
    deliveryMinFee: "",
    deliveryMaxFee: "",
    maxDeliveryKm: "",
    riderBasePay: "",
    riderPerKm: "",
  });
  const [overrideSlabs, setOverrideSlabs] = useState(false);
  const [slabs, setSlabs] = useState<DeliverySlab[]>([]);

  const selectArea = (area: Area | null) => {
    setEditing(area);
    setTown(area?.town ?? "");
    setActive(area?.isActive ?? true);
    setNote(area?.note ?? "");
    setOverrides({
      deliveryPerKmBeyond: String(area?.deliveryPerKmBeyond ?? ""),
      deliveryMinFee: String(area?.deliveryMinFee ?? ""),
      deliveryMaxFee: String(area?.deliveryMaxFee ?? ""),
      maxDeliveryKm: String(area?.maxDeliveryKm ?? ""),
      riderBasePay: String(area?.riderBasePay ?? ""),
      riderPerKm: String(area?.riderPerKm ?? ""),
    });
    setOverrideSlabs(area?.deliverySlabs != null);
    setSlabs(deliveryPricing.parseSlabs(area?.deliverySlabs));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (overrideSlabs && (
      !slabs.length ||
      slabs.some((slab, index) =>
        slab.maxKm <= 0 || slab.fee < 0 ||
        (index > 0 && slab.maxKm <= slabs[index - 1].maxKm)
      )
    )) {
      toast.error("Delivery slabs must have increasing distances and nonnegative fees.");
      return;
    }

    const result = schema.safeParse({
      action: "service_area_upsert",
      ...(editing ? { id: editing.id } : {}),
      town: town.trim(),
      isActive: active,
      note: note.trim() || null,
      deliverySlabs: overrideSlabs ? slabs : null,
      ...Object.fromEntries(
        overrideFields.map(({ key }) => [key, overrides[key] === "" ? null : Number(overrides[key])]),
      ),
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Invalid service area.");
      return;
    }
    onAction(result.data);
    selectArea(null);
  };

  const toggle = (area: Area) => {
    const result = schema.safeParse({
      action: "service_area_upsert",
      id: area.id,
      town: area.town,
      isActive: !area.isActive,
      note: area.note,
      deliverySlabs: area.deliverySlabs,
      deliveryPerKmBeyond: area.deliveryPerKmBeyond,
      deliveryMinFee: area.deliveryMinFee,
      deliveryMaxFee: area.deliveryMaxFee,
      maxDeliveryKm: area.maxDeliveryKm,
      riderBasePay: area.riderBasePay,
      riderPerKm: area.riderPerKm,
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Could not update the service area.");
      return;
    }
    onAction(result.data);
  };

  return (
    <section className={`${styles.root} ${className ?? ""}`}>
      <h2>Service areas</h2>
      <p>Towns without a row use global rates and are active.</p>
      <div className={styles.list}>
        {areas.map((area) => (
          <div className={styles.area} key={area.id}>
            <div>
              <strong>{area.town}</strong>
              <p>{area.note || "No note"} · {area.isActive ? "Active" : "Inactive"}</p>
            </div>
            <div className={styles.actions}>
              <Switch
                checked={area.isActive}
                onCheckedChange={() => toggle(area)}
                disabled={isPending}
                aria-label={`${area.isActive ? "Deactivate" : "Activate"} ${area.town}`}
              />
              <Button size="sm" variant="outline" onClick={() => selectArea(area)} disabled={isPending}>Edit</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  if (confirm(`Delete ${area.town}'s overrides? It will return to active global rates.`)) {
                    onAction({ action: "service_area_delete", id: area.id });
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className={styles.form}>
        <h3>{editing ? `Edit ${editing.town}` : "Add a town"}</h3>
        <label className={styles.field}>
          <span>Town</span>
          <Input list="admin-area-towns" value={town} onChange={(event) => setTown(event.target.value)} required disabled={isPending} />
          <datalist id="admin-area-towns">
            {ziptoConfig.towns.map((name) => <option value={name} key={name} />)}
          </datalist>
        </label>
        <div className={styles.switchRow}>
          <label htmlFor="area-active">Active</label>
          <Switch id="area-active" checked={active} onCheckedChange={setActive} disabled={isPending} />
        </div>
        <label className={styles.field}>
          <span>Note (optional)</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} disabled={isPending} />
        </label>
        <p>Leave an override blank to use the global rate.</p>
        <div className={styles.grid}>
          {overrideFields.map(({ key, label }) => (
            <label className={styles.field} key={key}>
              <span>{label}</span>
              <Input
                type="number"
                min="0"
                step="any"
                value={overrides[key]}
                onChange={(event) => setOverrides((previous) => ({ ...previous, [key]: event.target.value }))}
                disabled={isPending}
              />
            </label>
          ))}
        </div>
        <div className={styles.switchRow}>
          <label htmlFor="area-slabs">Override delivery slabs</label>
          <Switch id="area-slabs" checked={overrideSlabs} onCheckedChange={setOverrideSlabs} disabled={isPending} />
        </div>
        {overrideSlabs && (
          <div className={styles.slabs}>
            {slabs.map((slab, index) => (
              <div className={styles.slab} key={index}>
                <label className={styles.field}>
                  <span>Up to km</span>
                  <Input type="number" min="0.1" step="any" value={slab.maxKm} disabled={isPending} required
                    onChange={(event) => setSlabs((previous) => previous.map((row, position) =>
                      position === index ? { ...row, maxKm: Number(event.target.value) } : row
                    ))} />
                </label>
                <label className={styles.field}>
                  <span>Fee ₹</span>
                  <Input type="number" min="0" step="1" value={slab.fee} disabled={isPending} required
                    onChange={(event) => setSlabs((previous) => previous.map((row, position) =>
                      position === index ? { ...row, fee: Number(event.target.value) } : row
                    ))} />
                </label>
                <Button type="button" size="sm" variant="outline" disabled={isPending}
                  onClick={() => setSlabs((previous) => previous.filter((_, position) => position !== index))}>
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" disabled={isPending}
              onClick={() => setSlabs((previous) => [
                ...previous,
                { maxKm: (previous.at(-1)?.maxKm ?? 0) + 1, fee: previous.at(-1)?.fee ?? 0 },
              ])}>
              Add slab
            </Button>
          </div>
        )}
        <div className={styles.actions}>
          <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : editing ? "Save area" : "Add area"}</Button>
          {editing && <Button type="button" variant="ghost" onClick={() => selectArea(null)} disabled={isPending}>Cancel editing</Button>}
        </div>
      </form>
    </section>
  );
};