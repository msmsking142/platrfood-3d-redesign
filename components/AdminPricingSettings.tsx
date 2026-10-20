import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { OutputType as AdminFinance } from "../endpoints/admin/finance_GET.schema";
import { schema, type InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { deliveryPricing, type DeliverySlab, type PricingSettings } from "../helpers/deliveryPricing";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Switch } from "./Switch";
import styles from "./AdminPricingSettings.module.css";

type Pricing = AdminFinance["pricing"];

type Props = {
  pricing: Pricing;
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  className?: string;
};

export const AdminPricingSettings = ({ pricing, onAction, isPending, className }: Props) => {
  const [values, setValues] = useState(pricing);
  const [slabs, setSlabs] = useState<DeliverySlab[]>(
    () => deliveryPricing.parseSlabs(pricing.deliverySlabs),
  );
  const [peakStart, setPeakStart] = useState(
    pricing.peakStartHour === null ? "" : String(pricing.peakStartHour),
  );
  const [peakEnd, setPeakEnd] = useState(
    pricing.peakEndHour === null ? "" : String(pricing.peakEndHour),
  );

  const numberField = (key: keyof Pricing, label: string, note?: string) => (
    <label className={styles.field} key={key}>
      <span>{label}</span>
      <Input
        type="number"
        step="any"
        value={String(values[key] ?? "")}
        onChange={(event) =>
          setValues((previous) => ({ ...previous, [key]: Number(event.target.value) }))
        }
        disabled={isPending}
        required
      />
      {note && <small>{note}</small>}
    </label>
  );

  const settings: PricingSettings = {
    platformFee: values.platformFee,
    deliverySlabs: slabs,
    deliveryPerKmBeyond: values.deliveryPerKmBeyond,
    deliveryMinFee: values.deliveryMinFee,
    deliveryMaxFee: values.deliveryMaxFee,
    maxDeliveryM: values.maxDeliveryKm * 1000,
    defaultDistanceM: values.defaultDistanceKm * 1000,
    roadFactorPct: values.roadFactorPct,
    peakFee: values.peakFee,
    peakStartHour: peakStart === "" ? null : Number(peakStart),
    peakEndHour: peakEnd === "" ? null : Number(peakEnd),
    surgeEnabled: values.surgeEnabled,
    surgeFee: values.surgeFee,
    surgeReason: values.surgeReason,
    smallOrderFee: values.smallOrderFee,
    smallOrderThreshold: values.smallOrderThreshold,
    deliveryGstBps: values.deliveryGstPercent * 100,
    foodGstBps: values.foodGstPercent * 100,
    commissionGstBps: values.commissionGstPercent * 100,
    restaurantWithholdingBps: values.restaurantWithholdingPercent * 100,
    restaurantNoPanWithholdingBps: values.restaurantNoPanWithholdingPercent * 100,
    riderBasePay: values.riderBasePay,
    riderBaseM: values.riderBaseKm * 1000,
    riderPerKm: values.riderPerKm,
    riderBonus: values.riderIncentive,
    riderPeakIncentive: values.riderPeakIncentive,
    riderCancelAfterAcceptPay: values.riderCancelAfterAcceptPay,
    deliveryOpsCost: values.deliveryOpsCost,
    gatewayFeeBps: values.gatewayFeePercent * 100,
    promoDeliveryDiscount: values.promoDeliveryDiscount,
    promoMinOrder: values.promoMinOrder,
    basicCommissionPercent: pricing.basicCommissionPercent,
    proCommissionPercent: pricing.proCommissionPercent,
  };

  const previewReady =
    slabs.length > 0 &&
    slabs.every((slab, index) =>
      slab.maxKm > 0 &&
      slab.fee >= 0 &&
      (index === 0 || slab.maxKm > slabs[index - 1].maxKm)
    ) &&
    settings.deliveryMinFee <= settings.deliveryMaxFee &&
    (peakStart === "") === (peakEnd === "");

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!previewReady) {
      toast.error("Check the delivery slabs, fee limits and peak hours before saving.");
      return;
    }
    const result = schema.safeParse({
      action: "pricing_settings",
      ...values,
      deliverySlabs: slabs,
      peakStartHour: settings.peakStartHour,
      peakEndHour: settings.peakEndHour,
      surgeReason: values.surgeEnabled ? values.surgeReason?.trim() : null,
      ziptoGstin: values.ziptoGstin?.trim().toUpperCase() || null,
    });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Invalid pricing settings.");
      return;
    }
    onAction(result.data);
  };

  return (
    <section className={`${styles.root} ${className ?? ""}`}>
      <h2>Pricing controls</h2>
      <p>Changes to these rates require an explicit save.</p>
      <form onSubmit={save}>
        <fieldset className={styles.group}>
          <legend>Customer charges</legend>
          <div className={styles.grid}>
            {numberField("platformFee", "Platform fee ₹", "₹0 = no platform fee at launch")}
            {numberField("smallOrderFee", "Small-order fee ₹")}
            {numberField("smallOrderThreshold", "Small-order threshold ₹")}
          </div>
          <div className={styles.switchRow}>
            <label htmlFor="pricing-surge">Surge pricing</label>
            <Switch
              id="pricing-surge"
              checked={values.surgeEnabled}
              onCheckedChange={(checked) => setValues((previous) => ({ ...previous, surgeEnabled: checked }))}
              disabled={isPending}
            />
          </div>
          {values.surgeEnabled && (
            <div className={styles.grid}>
              {numberField("surgeFee", "Surge fee ₹")}
              <label className={styles.field}>
                <span>Reason shown to customers</span>
                <Input
                  value={values.surgeReason ?? ""}
                  onChange={(event) => setValues((previous) => ({ ...previous, surgeReason: event.target.value }))}
                  required
                  disabled={isPending}
                />
              </label>
            </div>
          )}
          <p className={styles.warning}>Only enable when operationally necessary – customers see it as a separate line.</p>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Delivery fee rules</legend>
          <div className={styles.slabs}>
            {slabs.map((slab, index) => (
              <div className={styles.slab} key={index}>
                <label className={styles.field}>
                  <span>Up to km</span>
                  <Input
                    type="number"
                    min="0.1"
                    step="any"
                    value={slab.maxKm}
                    onChange={(event) => setSlabs((previous) =>
                      previous.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, maxKm: Number(event.target.value) } : row
                      )
                    )}
                    disabled={isPending}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Fee ₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={slab.fee}
                    onChange={(event) => setSlabs((previous) =>
                      previous.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, fee: Number(event.target.value) } : row
                      )
                    )}
                    disabled={isPending}
                    required
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSlabs((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={isPending}
                  aria-label={`Remove slab ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() =>
              setSlabs((previous) => [...previous, { maxKm: (previous.at(-1)?.maxKm ?? 0) + 1, fee: previous.at(-1)?.fee ?? 0 }])
            }>
              Add slab
            </Button>
          </div>
          <div className={styles.grid}>
            {numberField("deliveryPerKmBeyond", "₹/km beyond last slab")}
            {numberField("deliveryMinFee", "Minimum fee ₹")}
            {numberField("deliveryMaxFee", "Maximum fee ₹")}
            {numberField("maxDeliveryKm", "Maximum delivery km")}
            {numberField("defaultDistanceKm", "Default distance km when no GPS")}
            {numberField("roadFactorPct", "Road factor %")}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Peak time</legend>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Start hour (0–23)</span>
              <Input type="number" min="0" max="23" step="1" value={peakStart} onChange={(event) => setPeakStart(event.target.value)} disabled={isPending} />
              <small>Leave both hours blank to turn peak time off.</small>
            </label>
            <label className={styles.field}>
              <span>End hour (0–23)</span>
              <Input type="number" min="0" max="23" step="1" value={peakEnd} onChange={(event) => setPeakEnd(event.target.value)} disabled={isPending} />
            </label>
            {numberField("peakFee", "Peak fee ₹")}
            {numberField("riderPeakIncentive", "Rider peak incentive ₹")}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Rider pay</legend>
          <div className={styles.grid}>
            {numberField("riderBasePay", "Base pay ₹")}
            {numberField("riderBaseKm", "Base km")}
            {numberField("riderPerKm", "₹/km after base")}
            {numberField("riderIncentive", "Incentive ₹")}
            {numberField("riderCancelAfterAcceptPay", "Cancel-after-accept pay ₹")}
            {numberField("riderEarningHoldHours", "Earning hold hours")}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Taxes</legend>
          <div className={styles.statutoryBox}>
            As per GST law (rates effective 22 Sept 2025): Food via platr™ = 5% GST (no ITC), collected from customer and paid by platr™ as e-commerce operator u/s 9(5). Delivery fee via platr™ = 18% GST (platr™ pays u/s 9(5) where riders are unregistered). Delivery fee is set to match rider pay. Platform fee = 18%. Commission charged to restaurants = 18% GST (restaurant can claim ITC if GST-registered). GST TCS u/s 52 does not apply to restaurant services taxed u/s 9(5). Income-tax TDS u/s 393(1) of the Income-tax Act 2025 (earlier 194-O, from 1 Apr 2026) = 0.1% of restaurant food sales, deducted on the weekly payout; 5% if the restaurant has no PAN. platr™ must hold a GSTIN (compulsory registration u/s 24). Confirm with your CA before go-live.
          </div>
          <div className={styles.grid}>
            {numberField("foodGstPercent", "GST % on food")}
            {numberField("deliveryGstPercent", "GST % on delivery & fees")}
            {numberField("commissionGstPercent", "GST % on commission")}
            {numberField("restaurantWithholdingPercent", "Income-tax TDS u/s 393(1) % (earlier 194-O)")}
            {numberField("restaurantNoPanWithholdingPercent", "No-PAN TDS %")}
            <label className={styles.field}>
              <span>platr™ GSTIN</span>
              <Input
                value={values.ziptoGstin ?? ""}
                onChange={(event) => setValues((previous) => ({
                  ...previous,
                  ziptoGstin: event.target.value.toUpperCase(),
                }))}
                maxLength={15}
                disabled={isPending}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Costs & promotions</legend>
          <div className={styles.grid}>
            {numberField("deliveryOpsCost", "Delivery ops cost ₹/order")}
            {numberField("gatewayFeePercent", "Gateway fee % estimate")}
            {numberField("promoDeliveryDiscount", "platr™ delivery discount ₹")}
            {numberField("promoMinOrder", "Promo minimum order ₹")}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Payout schedule</legend>
          <label className={styles.field}>
            <span>Payout weekday</span>
            <Select value={String(values.payoutWeekday)} onValueChange={(day) =>
              setValues((previous) => ({ ...previous, payoutWeekday: Number(day) }))
            } disabled={isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) =>
                  <SelectItem key={day} value={String(index)}>{day}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </label>
          <p>Automatic batch job runs Fridays 00:30 IST; the weekday is used for display/reporting.</p>
        </fieldset>

        <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Save pricing"}</Button>
      </form>

      <div className={styles.preview}>
        <h3>Sample bill · ₹400 order</h3>
        {!previewReady ? (
          <p>Enter valid, increasing delivery slabs and fee limits to see the sample bill.</p>
        ) : (
          <div className={styles.previewGrid}>
            {(["basic", "pro"] as const).flatMap((plan) => [1.5, 3.5, 8].map((km) => {
              const quote = deliveryPricing.quote({
                itemsTotal: 400,
                plan,
                distanceM: km * 1000,
                distanceSource: "gps",
                paymentMethod: "upi",
                at: new Date(),
                settings,
              });
              return (
                <div className={styles.previewCard} key={`${plan}-${km}`}>
                  <h4>{plan === "basic" ? "Basic" : "Pro"} · {km} km</h4>
                  <p>Customer total: ₹{quote.total}</p>
                  <p>Delivery fee: ₹{quote.deliveryFee}</p>
                  <p>Rider pay: ₹{quote.rider.total}</p>
                  <p>platr™ keeps per order: ₹{quote.economics.contribution}</p>
                </div>
              );
            }))}
          </div>
        )}
      </div>
    </section>
  );
};