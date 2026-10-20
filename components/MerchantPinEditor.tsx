import { useEffect, useState } from "react";
import type { InputType } from "../endpoints/restaurant/action_POST.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { LocationPinPicker } from "./LocationPinPicker";
import styles from "./MerchantPinEditor.module.css";

type Position = { lat: number | null; lng: number | null };
type SetLocationInput = Extract<InputType, { action: "set_location" }>;

export function MerchantPinEditor({
  lat,
  lng,
  onSaved,
  className,
}: {
  lat: number | null;
  lng: number | null;
  onSaved?: () => void;
  className?: string;
}) {
  const [saved, setSaved] = useState<Position>({ lat, lng });
  const [picked, setPicked] = useState<Position>({ lat, lng });

  useEffect(() => {
    setSaved({ lat, lng });
    setPicked({ lat, lng });
  }, [lat, lng]);

  const pinAction = ziptoHooks.useAction(
    (input: SetLocationInput) => postRestaurantAction(input),
    [ziptoHooks.keys.restaurantDashboard],
    "Outlet pin saved",
  );

  const canSave =
    picked.lat !== null &&
    picked.lng !== null &&
    (picked.lat !== saved.lat || picked.lng !== saved.lng);

  return (
    <div className={`${styles.editor} ${className || ""}`}>
      <LocationPinPicker
        lat={picked.lat}
        lng={picked.lng}
        onChange={setPicked}
        disabled={pinAction.isPending}
        autoLocate={lat === null || lng === null}
        label="Outlet pin"
        helpText="Tap the map or drag the pin to mark your restaurant entrance."
      />
      <p className={styles.status}>
        {saved.lat !== null && saved.lng !== null
          ? "Pin saved ✓"
          : "No pin yet – riders need it to reach you and to show distance & ETA"}
      </p>
      <Button
        className={styles.saveButton}
        disabled={!canSave || pinAction.isPending}
        onClick={() => {
          if (picked.lat === null || picked.lng === null) return;
          pinAction.mutate(
            { action: "set_location", lat: picked.lat, lng: picked.lng },
            {
              onSuccess: (_result, input) => {
                setSaved({ lat: input.lat, lng: input.lng });
                onSaved?.();
              },
            },
          );
        }}
      >
        {pinAction.isPending ? "Saving outlet pin…" : "Save outlet pin"}
      </Button>
    </div>
  );
}