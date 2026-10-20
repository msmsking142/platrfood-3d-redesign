export type TrackingPoint = { lat: number; lng: number };

export function asTrackingPoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
): TrackingPoint | null {
  if (
    lat === null || lat === undefined ||
    lng === null || lng === undefined ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export function trackingDistanceMeters(a: TrackingPoint, b: TrackingPoint): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

/** Snap only when the nearest projection onto a real route segment is within 35 m. */
export function snapToTrackingRoute(
  gps: TrackingPoint,
  route: readonly TrackingPoint[],
): TrackingPoint {
  if (route.length < 2) return gps;

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(gps.lat * Math.PI / 180);
  if (Math.abs(metersPerDegreeLng) < 1) return gps;

  let nearest: TrackingPoint = gps;
  let nearestDistanceSquared = 35 * 35;

  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1];
    const end = route[index];
    const ax = (start.lng - gps.lng) * metersPerDegreeLng;
    const ay = (start.lat - gps.lat) * metersPerDegreeLat;
    const bx = (end.lng - gps.lng) * metersPerDegreeLng;
    const by = (end.lat - gps.lat) * metersPerDegreeLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const x = ax + fraction * dx;
    const y = ay + fraction * dy;
    const distanceSquared = x * x + y * y;

    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared;
      nearest = {
        lat: gps.lat + y / metersPerDegreeLat,
        lng: gps.lng + x / metersPerDegreeLng,
      };
    }
  }

  return nearest;
}