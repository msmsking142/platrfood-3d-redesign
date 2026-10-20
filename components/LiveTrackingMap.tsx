import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Skeleton } from "./Skeleton";
import {
  loadTrackingMaps,
  mapStyles,
  markerIcon,
  type TrackingMap,
  type TrackingMapsApi,
  type TrackingMarker,
  type TrackingPolyline,
  type TrackingListener,
} from "../helpers/googleTrackingMaps";
import {
  asTrackingPoint,
  snapToTrackingRoute,
  trackingDistanceMeters,
  type TrackingPoint,
} from "../helpers/trackingMapGeometry";
import styles from "./LiveTrackingMap.module.css";

export type LiveTrackingMapProps = {
  riderLat: number | null;
  riderLng: number | null;
  riderAt: Date | string | null;
  restaurantLat: number | null;
  restaurantLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  target: "restaurant" | "destination";
  encodedPolyline: string | null;
  riderName?: string | null;
  className?: string;
  onUnavailable?: () => void;
};

type PinName = "restaurant" | "destination" | "rider";

type LastFix = {
  point: TrackingPoint;
  timestamp: number | null;
  receivedAt: number;
};

const fitPadding = { top: 56, bottom: 24, left: 24, right: 24 };

function fixTimestamp(value: Date | string | null): number | null {
  if (value === null) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function LiveTrackingMap({
  riderLat,
  riderLng,
  riderAt,
  restaurantLat,
  restaurantLng,
  destinationLat,
  destinationLng,
  target,
  encodedPolyline,
  riderName,
  className,
  onUnavailable,
}: LiveTrackingMapProps) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [hasMap, setHasMap] = useState(false);
  const [manualFraming, setManualFraming] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const mapElementRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TrackingMapsApi | null>(null);
  const mapRef = useRef<TrackingMap | null>(null);
  const markersRef = useRef<Record<PinName, TrackingMarker | null>>({
    restaurant: null,
    destination: null,
    rider: null,
  });
  const linesRef = useRef<TrackingPolyline[]>([]);
  const routeRef = useRef<string | null>(null);
  const routePointsRef = useRef<TrackingPoint[]>([]);
  const displayedRiderRef = useRef<TrackingPoint | null>(null);
  const lastFixRef = useRef<LastFix | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const listenersRef = useRef<TrackingListener[]>([]);
  const idleListenerRef = useRef<TrackingListener | null>(null);
  const animationRef = useRef<number | null>(null);
  const manualRef = useRef(false);
  const framingRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const rider = asTrackingPoint(riderLat, riderLng);
  const restaurant = asTrackingPoint(restaurantLat, restaurantLng);
  const destination = asTrackingPoint(destinationLat, destinationLng);
  const activeTarget = target === "restaurant" ? restaurant : destination;

  function fitMap() {
    const api = apiRef.current;
    const map = mapRef.current;
    if (!api || !map) return;

    const points = [
      ...routePointsRef.current,
      ...(rider ? [rider] : []),
      ...(activeTarget ? [activeTarget] : []),
      ...(destination ? [destination] : []),
    ];
    if (points.length === 0) return;

    const bounds = new api.LatLngBounds();
    points.forEach((point) => bounds.extend(point));

    framingRef.current = true;
    idleListenerRef.current?.remove();
    idleListenerRef.current = map.addListener("idle", () => {
      const zoom = map.getZoom();
      if (zoom !== undefined && zoom > 17) {
        map.setZoom(17);
        return;
      }
      framingRef.current = false;
      idleListenerRef.current?.remove();
      idleListenerRef.current = null;
    });
    map.fitBounds(bounds, fitPadding);
  }

  useEffect(() => {
    let cancelled = false;

    loadTrackingMaps()
      .then((api) => {
        if (cancelled) return;
        apiRef.current = api;
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        console.error("Google live-tracking map unavailable:", error);
        if (cancelled) return;
        setLoadState("unavailable");
        onUnavailableRef.current?.();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loadState !== "ready") return;
    const api = apiRef.current;
    if (!api) return;

    const routeChanged = routeRef.current !== encodedPolyline;
    if (routeChanged) {
      routeRef.current = encodedPolyline;
      routePointsRef.current = [];
      if (encodedPolyline) {
        try {
          routePointsRef.current = api.geometry.encoding
            .decodePath(encodedPolyline)
            .map((point) => ({ lat: point.lat(), lng: point.lng() }));
        } catch (error: unknown) {
          console.error("Could not decode the delivery route:", error);
        }
      }
    }

    const initialPoints = [
      ...routePointsRef.current,
      ...(rider ? [rider] : []),
      ...(activeTarget ? [activeTarget] : []),
      ...(destination ? [destination] : []),
    ];
    let map = mapRef.current;
    let created = false;

    // Do not center the map on a fabricated location while real positions are pending.
    if (!map && initialPoints.length > 0 && mapElementRef.current) {
      map = new api.Map(mapElementRef.current, {
        center: initialPoints[0],
        zoom: 15,
        backgroundColor: "#f5f3ee",
        styles: mapStyles,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: api.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: "cooperative",
        clickableIcons: false,
        keyboardShortcuts: false,
      });
      mapRef.current = map;
      created = true;
      setHasMap(true);

      const stopAutoFraming = () => {
        manualRef.current = true;
        setManualFraming(true);
      };
      listenersRef.current.push(
        map.addListener("dragstart", stopAutoFraming),
        map.addListener("zoom_changed", () => {
          if (!framingRef.current) stopAutoFraming();
        }),
      );
    }

    if (!map) return;

    if (routeChanged || created) {
      linesRef.current.forEach((line) => line.setMap(null));
      linesRef.current = [];
      if (routePointsRef.current.length >= 2) {
        linesRef.current = [
          new api.Polyline({
            map,
            path: routePointsRef.current,
            strokeColor: "#ffffff",
            strokeOpacity: 1,
            strokeWeight: 9,
            clickable: false,
          }),
          new api.Polyline({
            map,
            path: routePointsRef.current,
            strokeColor: "#111111",
            strokeOpacity: 1,
            strokeWeight: 5,
            clickable: false,
          }),
        ];
      }
    }

    function updateFixedPin(name: "restaurant" | "destination", point: TrackingPoint | null) {
      const existing = markersRef.current[name];
      if (!point) {
        existing?.setMap(null);
        markersRef.current[name] = null;
      } else if (existing) {
        existing.setPosition(point);
      } else {
        markersRef.current[name] = new api!.Marker({
          map: map!,
          position: point,
          icon: markerIcon(api!, name),
          title: name === "restaurant" ? "Restaurant" : "Delivery address",
        });
      }
    }

    updateFixedPin("restaurant", restaurant);
    updateFixedPin("destination", destination);

    let displayedRider: TrackingPoint | null = null;
    if (!rider) {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      markersRef.current.rider?.setMap(null);
      markersRef.current.rider = null;
      displayedRiderRef.current = null;
      lastFixRef.current = null;
    } else {
      displayedRider = snapToTrackingRoute(rider, routePointsRef.current);
      const previousFix = lastFixRef.current;
      const receivedAt = Date.now();
      const timestamp = fixTimestamp(riderAt);
      const isNewFix =
        !previousFix ||
        previousFix.point.lat !== rider.lat ||
        previousFix.point.lng !== rider.lng;

      if (isNewFix) {
        lastFixRef.current = { point: rider, timestamp, receivedAt };
      }

      let marker = markersRef.current.rider;
      if (!marker) {
        marker = new api.Marker({
          map,
          position: displayedRider,
          icon: markerIcon(api, "rider"),
          title: riderName ? `${riderName}'s live location` : "Rider's live location",
        });
        markersRef.current.rider = marker;
        displayedRiderRef.current = displayedRider;
      } else if (isNewFix || routeChanged) {
        if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;

        const from = displayedRiderRef.current ?? displayedRider;
        const gap = previousFix
          ? timestamp !== null && previousFix.timestamp !== null
            ? Math.max(0, timestamp - previousFix.timestamp)
            : Math.max(0, receivedAt - previousFix.receivedAt)
          : 0;
        const duration = Math.min(1500, gap);
        const shouldAnimate =
          isNewFix &&
          previousFix !== null &&
          duration > 0 &&
          trackingDistanceMeters(previousFix.point, rider) <= 2000 &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (shouldAnimate) {
          const destinationPoint = displayedRider;
          const movingMarker = marker;
          let startedAt: number | null = null;
          const step = (time: number) => {
            if (startedAt === null) startedAt = time;
            const progress = Math.min(1, (time - startedAt) / duration);
            const eased = progress * progress * (3 - 2 * progress);
            const position = {
              lat: from.lat + (destinationPoint.lat - from.lat) * eased,
              lng: from.lng + (destinationPoint.lng - from.lng) * eased,
            };
            movingMarker.setPosition(position);
            displayedRiderRef.current = position;
            if (progress < 1) {
              animationRef.current = window.requestAnimationFrame(step);
            } else {
              animationRef.current = null;
            }
          };
          animationRef.current = window.requestAnimationFrame(step);
        } else {
          marker.setPosition(displayedRider);
          displayedRiderRef.current = displayedRider;
        }
      }
      marker.setTitle(riderName ? `${riderName}'s live location` : "Rider's live location");
    }

    // Without a decoded road route, explicitly show only an approximate straight line.
    if (routePointsRef.current.length < 2) {
      const endpoints = displayedRider && activeTarget ? [displayedRider, activeTarget] : [];
      const existingDash = linesRef.current[0];
      if (existingDash) {
        existingDash.setPath(endpoints);
      } else if (endpoints.length === 2) {
        linesRef.current = [
          new api.Polyline({
            map,
            path: endpoints,
            strokeOpacity: 0,
            clickable: false,
            icons: [{
              icon: {
                path: "M 0,-1 0,1",
                strokeColor: "#7a7a7a",
                strokeOpacity: 1,
                strokeWeight: 2,
                scale: 4,
              },
              offset: "0",
              repeat: "16px",
            }],
          }),
        ];
      }
    }

    const targetKey = `${target}:${activeTarget?.lat ?? ""}:${activeTarget?.lng ?? ""}`;
    const targetChanged = lastTargetRef.current !== targetKey;
    lastTargetRef.current = targetKey;

    if (!manualRef.current) {
      if (created || targetChanged) {
        fitMap();
      } else if (displayedRider) {
        const bounds = map.getBounds();
        if (bounds && !bounds.contains(displayedRider)) map.panTo(displayedRider);
      }
    }
  }, [
    loadState,
    riderLat,
    riderLng,
    riderAt,
    restaurantLat,
    restaurantLng,
    destinationLat,
    destinationLng,
    target,
    encodedPolyline,
    riderName,
  ]);

  useEffect(() => {
    const timestamp = fixTimestamp(riderAt);
    const stale = timestamp !== null && now - timestamp > 10 * 60_000;
    markersRef.current.rider?.setOpacity(stale ? 0.5 : 1);
  }, [riderAt, now, hasMap]);

  useEffect(
    () => () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
      idleListenerRef.current?.remove();
      listenersRef.current.forEach((listener) => listener.remove());
      linesRef.current.forEach((line) => line.setMap(null));
      Object.values(markersRef.current).forEach((marker) => marker?.setMap(null));
      mapRef.current = null;
    },
    [],
  );

  function recenter() {
    manualRef.current = false;
    setManualFraming(false);
    fitMap();
  }

  return (
    <div className={`${styles.root} ${className ?? ""}`}>
      <div className={styles.mapShell}>
        <div
          ref={mapElementRef}
          className={styles.map}
          role="region"
          aria-label="Live delivery map"
        />

        {loadState === "loading" && (
          <Skeleton className={styles.loading} aria-label="Loading live delivery map" />
        )}
        {loadState === "ready" && !hasMap && (
          <div className={styles.message} role="status">
            Waiting for delivery location…
          </div>
        )}
        {loadState === "unavailable" && (
          <div className={styles.message} role="alert">
            Live map is unavailable right now.
          </div>
        )}
        {loadState === "ready" && hasMap && manualFraming && (
          <button
            type="button"
            className={styles.recenter}
            aria-label="Recenter map"
            title="Recenter map"
            onClick={recenter}
          >
            <LocateFixed size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}