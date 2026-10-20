import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertTriangle, Bike, House, MapPin, UtensilsCrossed } from "lucide-react";
import { distanceInMeters } from "../helpers/geoDistance";
import "leaflet/dist/leaflet.css";
import styles from "./RiderLiveMap.module.css";

export type RiderLiveMapProps = {
  riderLat: number | null;
  riderLng: number | null;
  updatedAt: Date | string | null;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationLabel?: string;
  distanceTo?: "restaurant" | "destination";
  /** Use {distance} to place the formatted distance within custom copy. */
  distanceLabel?: string;
  riderName?: string | null;
  className?: string;
};

const riderIcon = L.divIcon({
  className: styles.riderPin,
  html: renderToStaticMarkup(
    <span className={styles.markerBody}>
      <Bike size={21} strokeWidth={2.5} aria-hidden="true" />
    </span>,
  ),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const restaurantIcon = L.divIcon({
  className: styles.restaurantPin,
  html: renderToStaticMarkup(
    <span className={styles.markerBody}>
      <UtensilsCrossed size={19} strokeWidth={2.5} aria-hidden="true" />
    </span>,
  ),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const destinationIcon = L.divIcon({
  className: styles.destinationPin,
  html: renderToStaticMarkup(
    <span className={styles.markerBody}>
      <House size={19} strokeWidth={2.5} aria-hidden="true" />
    </span>,
  ),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export function RiderLiveMap({
  riderLat,
  riderLng,
  updatedAt,
  restaurantLat,
  restaurantLng,
  destinationLat,
  destinationLng,
  destinationLabel = "Delivery location",
  distanceTo = "restaurant",
  distanceLabel,
  riderName,
  className,
}: RiderLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const userPannedRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const hasRider = riderLat !== null && riderLng !== null;
  const hasRestaurant =
    restaurantLat !== null &&
    restaurantLat !== undefined &&
    restaurantLng !== null &&
    restaurantLng !== undefined;
  const hasDestination =
    destinationLat !== null &&
    destinationLat !== undefined &&
    destinationLng !== null &&
    destinationLng !== undefined;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasRider || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([riderLat, riderLng], 16);
    map.on("dragstart", () => {
      userPannedRef.current = true;
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
  }, [hasRider, riderLat, riderLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasRider) return;
    map.invalidateSize();

    const riderPosition: L.LatLngExpression = [riderLat, riderLng];
    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng(riderPosition);
    } else {
      riderMarkerRef.current = L.marker(riderPosition, {
        icon: riderIcon,
        title: riderName
          ? `${riderName}'s live location`
          : "Rider's live location",
      }).addTo(map);
    }
    riderMarkerRef.current.bindTooltip(riderName || "Rider");

    const positions: L.LatLngExpression[] = [riderPosition];

    if (hasRestaurant) {
      const position: L.LatLngExpression = [restaurantLat, restaurantLng];
      positions.push(position);
      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.setLatLng(position);
      } else {
        restaurantMarkerRef.current = L.marker(position, {
          icon: restaurantIcon,
          title: "Restaurant",
        }).addTo(map);
        restaurantMarkerRef.current.bindTooltip("Restaurant");
      }
    } else if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.remove();
      restaurantMarkerRef.current = null;
    }

    if (hasDestination) {
      const position: L.LatLngExpression = [destinationLat, destinationLng];
      positions.push(position);
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng(position);
      } else {
        destinationMarkerRef.current = L.marker(position, {
          icon: destinationIcon,
          title: destinationLabel,
        }).addTo(map);
      }
      destinationMarkerRef.current.bindTooltip(destinationLabel);
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (!userPannedRef.current) {
      if (positions.length > 1) {
        map.fitBounds(L.latLngBounds(positions), {
          padding: [35, 35],
          maxZoom: 16,
        });
      } else {
        map.setView(riderPosition, 16);
      }
    }
  }, [
    hasRider,
    riderLat,
    riderLng,
    hasRestaurant,
    restaurantLat,
    restaurantLng,
    hasDestination,
    destinationLat,
    destinationLng,
    destinationLabel,
    riderName,
  ]);

  useEffect(
    () => () => {
      riderMarkerRef.current = null;
      restaurantMarkerRef.current = null;
      destinationMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  const timestamp =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : NaN;
  const ageSeconds = Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((now - timestamp) / 1000))
    : null;
  const stale = ageSeconds !== null && ageSeconds > 120;
  const veryStale = ageSeconds !== null && ageSeconds > 600;

  useEffect(() => {
    riderMarkerRef.current?.getElement()?.classList.toggle(styles.veryStale, veryStale);
  }, [veryStale, hasRider]);

  const staleMinutes = ageSeconds === null ? 0 : Math.floor(ageSeconds / 60);
  const staleTitle = staleMinutes >= 60
    ? "Last updated over an hour ago"
    : `Last updated ${new Intl.NumberFormat("en-IN").format(staleMinutes)} ${staleMinutes === 1 ? "minute" : "minutes"} ago`;
  const elapsedText =
    ageSeconds === null
      ? "Waiting for update"
      : ageSeconds < 60
        ? `${new Intl.NumberFormat("en-IN").format(ageSeconds)}s ago`
        : `${new Intl.NumberFormat("en-IN").format(
            Math.floor(ageSeconds / 60),
          )}m ago`;

  const target =
    distanceTo === "destination"
      ? hasDestination
        ? { lat: destinationLat, lng: destinationLng }
        : null
      : hasRestaurant
        ? { lat: restaurantLat, lng: restaurantLng }
        : null;

  const meters =
    hasRider && target
      ? distanceInMeters(riderLat, riderLng, target.lat, target.lng)
      : null;
  const kilometers = meters === null ? null : meters / 1000;
  const formattedDistance =
    kilometers === null
      ? null
      : `~${new Intl.NumberFormat("en-IN", {
          maximumFractionDigits: 1,
        }).format(kilometers)} km`;
  const distanceText =
    formattedDistance === null
      ? null
      : distanceLabel
        ? distanceLabel.includes("{distance}")
          ? distanceLabel.replaceAll("{distance}", formattedDistance)
          : `${formattedDistance} ${distanceLabel}`
        : `${formattedDistance} away`;
  const eta =
    kilometers === null ? null : Math.max(1, Math.ceil((kilometers / 20) * 60));

  return (
    <section
      className={`${styles.root} ${className ?? ""}`}
      aria-label="Rider live location"
    >
      <div className={styles.mapShell}>
        <div
          ref={containerRef}
          className={`${styles.map} ${!hasRider ? styles.hiddenMap : ""}`}
          aria-label="Map showing rider and route locations"
        />
        {!hasRider && (
          <div className={styles.placeholder} role="status">
            <MapPin
              size={27}
              className={styles.waitingIcon}
              aria-hidden="true"
            />
            <strong>Waiting for rider&apos;s live location…</strong>
          </div>
        )}
      </div>

      {hasRider && stale && (
        <div className={styles.staleWarning} role="status" aria-live="polite">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong className={styles.staleWarningTitle}>{staleTitle}</strong>
            <p className={styles.staleWarningBody}>
              Rider&apos;s phone may be offline or the platr™ app is in the background. Location will refresh automatically when it reconnects.
            </p>
          </div>
        </div>
      )}

      {hasRider && (
        <div className={styles.details}>
          <span
            className={`${styles.chip} ${stale ? styles.stale : ""}`}
            role="status"
          >
            <span className={styles.dot} aria-hidden="true" />
            {stale
              ? "Location stale"
              : ageSeconds === null
                ? "Location received"
                : "Live"}
            {" · "}
            updated {elapsedText}
          </span>
          {!veryStale && distanceText && eta !== null && (
            <span className={styles.distance}>
              {distanceText} · ~{new Intl.NumberFormat("en-IN").format(eta)} min
            </span>
          )}
        </div>
      )}
    </section>
  );
}