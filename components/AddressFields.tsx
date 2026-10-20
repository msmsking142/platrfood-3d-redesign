import { useRef, useState } from "react";
import type { z } from "zod";
import { LocateFixed } from "lucide-react";
import { addressFieldsSchema } from "../endpoints/customer/address_action_POST.schema";
import { useReverseGeocode } from "../helpers/useAddressSearch";
import { AddressSearch } from "./AddressSearch";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "./Form";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { ToggleGroup, ToggleGroupItem } from "./ToggleGroup";
import styles from "./AddressFields.module.css";

type Fields = z.infer<typeof addressFieldsSchema>;

type Props = {
  values: Fields;
  onChange: (updates: Partial<Fields>) => void;
  disabled: boolean;
  className?: string;
};

export const AddressFields = ({ values, onChange, disabled, className }: Props) => {
  const [locationState, setLocationState] = useState<"idle" | "loading" | "added" | "error">(
    values.lat !== undefined && values.lng !== undefined ? "added" : "idle",
  );

  const reverseGeocode = useReverseGeocode();
  const valuesRef = useRef(values);
  const locationRequestRef = useRef(0);
  valuesRef.current = values;

  function useLocation() {
    const request = ++locationRequestRef.current;
    if (!navigator.geolocation) {
      setLocationState("error");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequestRef.current) return;
        const { latitude: lat, longitude: lng } = position.coords;
        onChange({ lat, lng });
        setLocationState("added");

        if (!valuesRef.current.address.trim()) {
          void reverseGeocode.mutateAsync({ lat, lng }).then((result) => {
            if (request !== locationRequestRef.current || valuesRef.current.address.trim()) return;
            onChange({
              ...(result.formattedAddress ? { address: result.formattedAddress } : {}),
              ...(result.town && !valuesRef.current.town.trim() ? { town: result.town } : {}),
            });
          }).catch(() => {
            // Coordinates remain selected even if reverse geocoding is unavailable.
          });
        }
      },
      (error) => {
        if (request !== locationRequestRef.current) return;
        console.error("Could not get delivery location:", error);
        setLocationState("error");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className={`${styles.fields} ${className ?? ""}`}>
      <FormItem name="label">
        <FormLabel>Address label</FormLabel>
        <FormControl>
          <ToggleGroup
            type="single"
            aria-label="Address label"
            value={values.label}
            disabled={disabled}
            onValueChange={(label) => {
              if (label === "Home" || label === "Work" || label === "Other") onChange({ label });
            }}
          >
            <ToggleGroupItem value="Home">Home</ToggleGroupItem>
            <ToggleGroupItem value="Work">Work</ToggleGroupItem>
            <ToggleGroupItem value="Other">Other</ToggleGroupItem>
          </ToggleGroup>
        </FormControl>
        <FormMessage />
      </FormItem>
      <AddressSearch
        disabled={disabled}
        onSelect={({ formattedAddress, town, lat, lng }) => {
          locationRequestRef.current += 1;
          onChange({
            address: valuesRef.current.address.trim() ? valuesRef.current.address : formattedAddress,
            town: town ?? valuesRef.current.town,
            lat,
            lng,
          });
          setLocationState("added");
        }}
      />
      <FormItem name="address">
        <FormLabel>Full address</FormLabel>
        <FormControl>
          <Textarea
            value={values.address}
            disabled={disabled}
            placeholder="House number, street and area"
            onChange={(event) => onChange({ address: event.target.value })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      <FormItem name="landmark">
        <FormLabel>Landmark (optional)</FormLabel>
        <FormControl>
          <Input
            value={values.landmark ?? ""}
            disabled={disabled}
            onChange={(event) => onChange({ landmark: event.target.value })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
      <div className={styles.twoColumns}>
        <FormItem name="town">
          <FormLabel>Town</FormLabel>
          <FormControl>
            <Input
              value={values.town}
              disabled={disabled}
              onChange={(event) => onChange({ town: event.target.value })}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="phone">
          <FormLabel>Mobile number</FormLabel>
          <FormControl>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={values.phone}
              disabled={disabled}
              onChange={(event) => onChange({ phone: event.target.value })}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </div>
      <div className={styles.location}>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || locationState === "loading"}
          onClick={useLocation}
        >
          <LocateFixed size={17} aria-hidden="true" />
          {locationState === "loading" ? "Finding location…" : "Use my location"}
        </Button>
        {locationState === "added" && <span role="status">Location added ✓</span>}
        {locationState === "error" && (
          <span role="alert">Could not get your location. Please allow location access and try again.</span>
        )}
      </div>
      <FormItem name="isDefault">
        <div className={styles.defaultChoice}>
          <FormControl>
            <Checkbox
              checked={values.isDefault ?? false}
              disabled={disabled}
              onChange={(event) => onChange({ isDefault: event.target.checked })}
            />
          </FormControl>
          <FormLabel>Make default</FormLabel>
        </div>
        <FormMessage />
      </FormItem>
    </div>
  );
};