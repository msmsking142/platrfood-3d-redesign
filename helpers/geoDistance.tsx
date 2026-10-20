/** Great-circle distance between two latitude/longitude pairs, in meters. */
export function distanceInMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latB - latA);
  const longitudeDelta = radians(lngB - lngA);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latA)) *
      Math.cos(radians(latB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, arc)));
}