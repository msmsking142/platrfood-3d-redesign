import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { postRiderAction, schema as riderActionSchema } from "../endpoints/rider/action_POST.schema";
import { riderVehicleTypes } from "../helpers/riderVehicleTypes";

import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Input } from "./Input";
import { MerchantCard, MerchantField, MerchantSectionHeader } from "./MerchantUi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { RiderPayoutDetails } from "./RiderPayoutDetails";
import styles from "./RiderProfile.module.css";

export const RiderProfile = ({
  data,
  className,
}: {
  data: OutputType;
  className?: string;
}) => {
  const rider = data.rider;
  if (!rider) throw new Error("RiderProfile requires a registered rider");

  const [phone, setPhone] = useState(rider.phone);
  const [vehicleType, setVehicleType] = useState(rider.vehicleType);
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber ?? "");
  const [error, setError] = useState("");
  const action = ziptoHooks.useAction(
    postRiderAction,
    [ziptoHooks.keys.riderDashboard],
    "Profile updated",
  );

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = riderActionSchema.safeParse({
      action: "update_profile",
      phone,
      vehicleType,
      vehicleNumber: vehicleNumber.trim() || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your profile details");
      return;
    }
    if (result.data.action !== "update_profile") {
      throw new Error("Unexpected rider profile action");
    }
    setError("");
    action.mutate(result.data);
  };

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader eyebrow="Your details" title="Rider profile" subtitle="Keep your contact and vehicle details up to date." />
      <MerchantCard>
        <form className={styles.form} onSubmit={save}>
          <MerchantField label="Mobile number">
            <Input
              required
              type="tel"
              inputMode="numeric"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
            />
          </MerchantField>
          <MerchantField label="Vehicle type">
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger aria-label="Vehicle type"><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
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
            />
          </MerchantField>
          <MerchantField label="Town" hint="To change town, email support.">
            <Input readOnly value={rider.town} aria-label="Town, read only" />
          </MerchantField>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" size="lg" disabled={action.isPending}>
              {action.isPending ? "Saving…" : "Save profile"}
            </Button>
            <Link to="/support">Contact platr™ Support to request a town change</Link>
          </div>
        </form>
      </MerchantCard>
      <RiderPayoutDetails details={data.payoutDetails} />
    </div>
  );
};