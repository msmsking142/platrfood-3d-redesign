import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { LocateFixed, MapPin } from "lucide-react";
import { AddressSearch } from "./AddressSearch";
import { Button } from "./Button";
import "leaflet/dist/leaflet.css";
import styles from "./LocationPinPicker.module.css";

export type LocationPinPickerProps = {
  lat: number | null;
  lng: number | null;
  onChange: (pos: { lat: number; lng: number }) => void;
  onAddressFound?: (r: { formattedAddress: string; town: string | null }) => void;
  disabled?: boolean;
  autoLocate?: boolean;
  label?: string;
  helpText?: string;
  className?: string;
};

const DEFAULT_POSITION: [number, number] = [28.9845, 79.4141];

const pinIcon = L.divIcon({
  className: styles.pinIcon,
  html: renderToStaticMarkup(
    <span className={styles.pinBody}>
      <MapPin size={22} strokeWidth={2.5} aria-hidden="true" />
    </span>,
  ),
  iconSize: [42, 42],
  iconAnchor: [21, 42],
});

export function LocationPinPicker({
  lat,
  lng,
  onChange,
  onAddressFound,
  disabled = false,
  autoLocate = false,
  label = "Delivery location",
  helpText,
  className,
}: LocationPinPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const mountedRef = useRef(false);
  const shouldAutoLocateRef = useRef(autoLocate && (lat === null || lng === null));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  function setPin(pos: { lat: number; lng: number }, notify: boolean) {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([pos.lat, pos.lng]);
    } else {
      const marker = L.marker([pos.lat, pos.lng], {
        icon: pinIcon,
        draggable: !disabledRef.current,
        title: "Selected location — drag to adjust",
      }).addTo(map);

      marker.on("dragend", () => {
        if (disabledRef.current) return;
        const position = marker.getLatLng();
        onChangeRef.current({ lat: position.lat, lng: position.lng });
      });

      markerRef.current = marker;
    }

    if (notify) onChangeRef.current(pos);
  }

  function locate() {
    if (disabledRef.current || !mountedRef.current) return;

    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Could not get your location. Move the pin on the map instead.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mountedRef.current) return;
        setLocating(false);
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setPin(pos, true);
        mapRef.current?.setView([pos.lat, pos.lng], 17);
      },
      (error) => {
        if (!mountedRef.current) return;
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location is blocked. Turn on location / allow it in your browser or phone settings, then try again."
            : "Could not get your location. Move the pin on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const hasPosition = lat !== null && lng !== null;
    const map = L.map(container, {
      scrollWheelZoom: false,
    }).setView(
      hasPosition ? [lat, lng] : DEFAULT_POSITION,
      hasPosition ? 17 : 13,
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (disabledRef.current) return;
      setLocationError(null);
      setPin({ lat: event.latlng.lat, lng: event.latlng.lng }, true);
    });

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; refs keep its event handlers current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      map.setView(DEFAULT_POSITION, 13);
      return;
    }

    setPin({ lat, lng }, false);
    map.setView([lat, lng], 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  useEffect(() => {
    if (!markerRef.current) return;
    if (disabled) {
      markerRef.current.dragging?.disable();
    } else {
      markerRef.current.dragging?.enable();
    }
  }, [disabled, lat, lng]);

  useEffect(() => {
    if (shouldAutoLocateRef.current) {
      shouldAutoLocateRef.current = false;
      locate();
    }
    // Auto-location is requested only on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPosition = lat !== null && lng !== null;

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label={label}>
      <div className={styles.heading}>
        <strong className={styles.label}>{label}</strong>
        {helpText && <p className={styles.helpText}>{helpText}</p>}
      </div>

      {!disabled && (
        <AddressSearch
          className={styles.search}
          onSelect={(result) => {
            setPin({ lat: result.lat, lng: result.lng }, true);
            mapRef.current?.setView([result.lat, result.lng], 17);
            onAddressFound?.({
              formattedAddress: result.formattedAddress,
              town: result.town,
            });
          }}
        />
      )}

      <div
        ref={containerRef}
        className={styles.map}
        role="application"
        aria-label={`${label} map. Tap to place a pin or drag an existing pin.`}
      />

      <div className={styles.actions}>
        <Button
          type="button"
          size="lg"
          onClick={locate}
          disabled={disabled || locating}
          aria-busy={locating}
        >
          <LocateFixed size={19} aria-hidden="true" />
          {locating ? "Finding your location…" : "Use my current location"}
        </Button>
      </div>

      {locationError && (
        <p className={styles.error} role="alert">
          {locationError}
        </p>
      )}

      <div className={styles.status} role="status">
        <span>
          {hasPosition
            ? "📍 Pin set – drag the pin or tap the map to adjust"
            : "No pin yet – use your location or tap the map"}
        </span>
        {hasPosition && (
          <a
            className={styles.mapsLink}
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps ↗
          </a>
        )}
      </div>
    </section>
  );
}