import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ShieldCheck, Upload } from "lucide-react";
import { postOnboarding, schema as postOnboardingSchema } from "../endpoints/onboarding_POST.schema";
import { riderVehicleTypes } from "../helpers/riderVehicleTypes";
import { formatPaise } from "../helpers/formatPaise";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Input } from "./Input";
import { MerchantCard, MerchantField } from "./MerchantUi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { Skeleton } from "./Skeleton";
import styles from "./RiderOnboarding.module.css";

export const RiderOnboarding = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const settings = ziptoHooks.useSettings();
  const action = ziptoHooks.useAction(
    postOnboarding,
    [ziptoHooks.keys.riderDashboard],
    "Registration saved. Upload your documents next.",
  );
  const [town, setTown] = useState<string>(ziptoConfig.towns[0]);
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>(riderVehicleTypes[0]);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      kind: "rider" as const,
      town,
      phone,
      vehicleType,
      vehicleNumber: vehicleNumber.trim() || undefined,
    };
    const validated = postOnboardingSchema.safeParse(input);
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Check your registration details");
      return;
    }
    setError("");
    action.mutate(validated.data, {
      onSuccess: () => navigate("/rider?section=verification", { replace: true }),
    });
  };

  return (
    <main className={`${styles.wrap} ${className ?? ""}`}>
      <header className={styles.hero}>
        <span className={styles.kicker}>PLATR DELIVERY PARTNER</span>
        <h1>Deliver local.<br />Earn fairly.</h1>
        {settings.isFetching && !settings.data ? (
          <Skeleton className={styles.heroSkeleton} />
        ) : settings.isError ? (
          <div className={styles.settingsError} role="alert">
            Could not load current payout details.
            <Button variant="secondary" size="sm" onClick={() => void settings.refetch()}>Retry</Button>
          </div>
        ) : settings.data ? (
          <p>
            Delivery pay is {ziptoConfig.rupees(settings.data.riderBasePay)} base for the first {settings.data.riderBaseKm} km,
            plus {ziptoConfig.rupees(settings.data.riderPerKm)}/km after that and a {ziptoConfig.rupees(settings.data.riderIncentive)} incentive.
          </p>
        ) : null}
      </header>

      <div className={styles.steps} aria-label="Registration steps">
        <div><Bike size={20} aria-hidden="true" /><span><b>1. Register</b> Add your details</span></div>
        <div><ShieldCheck size={20} aria-hidden="true" /><span><b>2. Pay</b> Onboarding fee</span></div>
        <div><Upload size={20} aria-hidden="true" /><span><b>3. Upload</b> Licence &amp; selfie</span></div>
        <div><ShieldCheck size={20} aria-hidden="true" /><span><b>4. Approval</b> Ready to ride</span></div>
      </div>

      <MerchantCard className={styles.formCard}>
        <h2>Join as a rider</h2>
        <p>Apne town mein deliver karo. Verification comes next.</p>
        <div className={styles.feeNotice}>
          <strong>One-time onboarding fee</strong>
          {settings.isFetching && !settings.data ? (
            <Skeleton className={styles.heroSkeleton} />
          ) : settings.isError || !settings.data ? (
            <p role="alert">
              Could not load the onboarding fee.{" "}
              <Button variant="secondary" size="sm" onClick={() => void settings.refetch()}>Retry</Button>
            </p>
          ) : (
            <p>
              {formatPaise(settings.data.riderOnboardingFee * 100)} + {settings.data.riderOnboardingFeeGstPercent}% GST
              {" "}({formatPaise(settings.data.riderOnboardingFeeTotalPaise)} total), non-refundable.
              Pay after registering, before document verification.
            </p>
          )}
        </div>
        <form className={styles.form} onSubmit={submit}>
          <MerchantField label="Town">
            <Select value={town} onValueChange={setTown}>
              <SelectTrigger aria-label="Town"><SelectValue placeholder="Choose town" /></SelectTrigger>
              <SelectContent>
                {ziptoConfig.towns.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </MerchantField>
          <MerchantField label="Mobile number">
            <Input
              required
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
              placeholder="10-digit mobile number"
            />
          </MerchantField>
          <MerchantField label="Vehicle">
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger aria-label="Vehicle"><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
              <SelectContent>
                {riderVehicleTypes.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </MerchantField>
          <MerchantField label="Vehicle number" hint="Optional for cycles">
            <Input
              maxLength={20}
              value={vehicleNumber}
              onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
              placeholder="e.g. UK06 AB 1234"
            />
          </MerchantField>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" size="lg" disabled={action.isPending}>
            {action.isPending ? "Saving…" : "Register & continue"}
          </Button>
        </form>
      </MerchantCard>
    </main>
  );
};