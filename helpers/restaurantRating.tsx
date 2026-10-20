export function restaurantRatingAverage(
  ratingSum: number,
  ratingCount: number,
): number | null {
  return ratingCount === 0
    ? null
    : Math.round((ratingSum / ratingCount) * 10) / 10;
}