import { GOOGLE_MAPS_BROWSER_KEY } from "./_publicConfigs";
import type { TrackingPoint } from "./trackingMapGeometry";

export type TrackingListener = { remove(): void };
export type TrackingLatLng = { lat(): number; lng(): number };
export type TrackingBounds = {
  extend(point: TrackingPoint): void;
  contains(point: TrackingPoint): boolean;
};

export type TrackingMap = {
  addListener(name: string, callback: () => void): TrackingListener;
  fitBounds(
    bounds: TrackingBounds,
    padding: { top: number; bottom: number; left: number; right: number },
  ): void;
  getBounds(): TrackingBounds | undefined;
  getZoom(): number | undefined;
  setZoom(zoom: number): void;
  panTo(point: TrackingPoint): void;
};

export type TrackingMarker = {
  setMap(map: TrackingMap | null): void;
  setPosition(point: TrackingPoint): void;
  setOpacity(opacity: number): void;
  setTitle(title: string): void;
};

export type TrackingPolyline = {
  setMap(map: TrackingMap | null): void;
  setPath(points: TrackingPoint[]): void;
};

type MapStyle = {
  featureType?: string;
  elementType?: string;
  stylers: readonly Record<string, string>[];
};

type MarkerIcon = {
  url: string;
  scaledSize: object;
  anchor: object;
};

type PolylineOptions = {
  map: TrackingMap;
  path: TrackingPoint[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  clickable: false;
  icons?: {
    icon: {
      path: string;
      strokeColor: string;
      strokeOpacity: number;
      strokeWeight: number;
      scale: number;
    };
    offset: string;
    repeat: string;
  }[];
};

export type TrackingMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: TrackingPoint;
      zoom: number;
      backgroundColor: string;
      styles: readonly MapStyle[];
      disableDefaultUI: boolean;
      zoomControl: boolean;
      zoomControlOptions: { position: number };
      gestureHandling: string;
      clickableIcons: boolean;
      keyboardShortcuts: boolean;
    },
  ) => TrackingMap;
  LatLngBounds: new () => TrackingBounds;
  Marker: new (options: {
    map: TrackingMap;
    position: TrackingPoint;
    icon: MarkerIcon;
    title: string;
  }) => TrackingMarker;
  Polyline: new (options: PolylineOptions) => TrackingPolyline;
  Size: new (width: number, height: number) => object;
  Point: new (x: number, y: number) => object;
  ControlPosition: { RIGHT_BOTTOM: number };
  geometry: {
    encoding: { decodePath(polyline: string): TrackingLatLng[] };
  };
};

type MapsWindow = Window & {
  google?: { maps?: TrackingMapsApi };
  __ziptoGmapsReady?: () => void;
  gm_authFailure?: () => void;
};

let mapsPromise: Promise<TrackingMapsApi> | null = null;

export function loadTrackingMaps(): Promise<TrackingMapsApi> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<TrackingMapsApi>((resolve, reject) => {
    if (!GOOGLE_MAPS_BROWSER_KEY) {
      reject(new Error("Google Maps browser key is not configured."));
      return;
    }

    const host = window as MapsWindow;
    const existing = host.google?.maps;
    const existingDecodePath = (
      existing as unknown as {
        geometry?: { encoding?: { decodePath?: unknown } };
      } | undefined
    )?.geometry?.encoding?.decodePath;
    if (existing?.Map && typeof existingDecodePath === "function") {
      resolve(existing);
      return;
    }

    const previousReady = host.__ziptoGmapsReady;
    const previousAuthFailure = host.gm_authFailure;
    const script = document.createElement("script");
    let settled = false;
    let timeout: number;

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("error", handleError);
      if (host.__ziptoGmapsReady === handleReady) host.__ziptoGmapsReady = previousReady;
      if (host.gm_authFailure === handleAuthFailure) host.gm_authFailure = previousAuthFailure;
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(error);
    };

    const handleReady = () => {
      if (settled) return;
      const maps = host.google?.maps;
      if (!maps?.Map || !maps.geometry?.encoding?.decodePath) {
        fail(new Error("Google Maps loaded without the required geometry library."));
        return;
      }
      settled = true;
      cleanup();
      resolve(maps);
    };

    const handleAuthFailure = () => {
      try {
        previousAuthFailure?.();
      } finally {
        fail(new Error("Google Maps browser key authentication failed."));
      }
    };

    const handleError = () => fail(new Error("Google Maps JavaScript failed to load."));

    host.__ziptoGmapsReady = handleReady;
    host.gm_authFailure = handleAuthFailure;
    script.addEventListener("error", handleError);
    script.async = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_BROWSER_KEY)}` +
      "&v=weekly&libraries=geometry&loading=async&callback=__ziptoGmapsReady";

    timeout = window.setTimeout(
      () => fail(new Error("Google Maps JavaScript timed out after 10 seconds.")),
      10_000,
    );
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export const mapStyles: readonly MapStyle[] = [
  ...[
    "poi.business",
    "poi.attraction",
    "poi.place_of_worship",
    "poi.school",
    "poi.medical",
    "transit",
  ].map((featureType) => ({
    featureType,
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  })),
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f3ee" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e0ded8" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#fde9a8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbe7ee" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a7a7a" }] },
];

const restaurantSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
  <path d="M20 2C10 2 3 9 3 19c0 13 17 27 17 27s17-14 17-27C37 9 30 2 20 2Z"
    fill="#111111"/>
  <path d="M13 12v9m4-9v9m-4-5h4m-2 5v7m10-16v16m0-16c4 4 4 8 0 10"
    fill="none" stroke="#FFC400" stroke-width="2.2" stroke-linecap="round"
    stroke-linejoin="round"/>
</svg>`;

const destinationSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
  <path d="M20 2C10 2 3 9 3 19c0 13 17 27 17 27s17-14 17-27C37 9 30 2 20 2Z"
    fill="#ffffff" stroke="#111111" stroke-width="2"/>
  <path d="m12 21 8-7 8 7M15 20v9h10v-9m-7 0v-6h4v6"
    fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round"/>
  <circle cx="30" cy="11" r="3.5" fill="#E53935"/>
</svg>`;

const riderSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
  <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#111111" flood-opacity=".25"/>
  </filter></defs>
  <circle cx="23" cy="23" r="20" fill="#FFC400" stroke="#ffffff" stroke-width="3"
    filter="url(#shadow)"/>
  <circle cx="15" cy="30" r="3" fill="none" stroke="#111111" stroke-width="2"/>
  <circle cx="31" cy="30" r="3" fill="none" stroke="#111111" stroke-width="2"/>
  <path d="M15 30h8l5-11h-5m8 11-3-11m-7 4h-7l2 7m11-14h5"
    fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round"
    stroke-linejoin="round"/>
</svg>`;

export function markerIcon(
  maps: TrackingMapsApi,
  kind: "restaurant" | "destination" | "rider",
): MarkerIcon {
  const isRider = kind === "rider";
  const svg = kind === "restaurant" ? restaurantSvg : kind === "destination" ? destinationSvg : riderSvg;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(isRider ? 46 : 40, isRider ? 46 : 48),
    anchor: new maps.Point(isRider ? 23 : 20, isRider ? 23 : 46),
  };
}