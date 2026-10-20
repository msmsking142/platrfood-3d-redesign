import { Star } from "lucide-react";
import styles from "./RestaurantRatingStars.module.css";

export interface RestaurantRatingStarsProps {
  ratingAverage: number | null;
  ratingCount: number;
  size?: "sm" | "md";
  className?: string;
}

export function RestaurantRatingStars({
  ratingAverage,
  ratingCount,
  size = "md",
  className,
}: RestaurantRatingStarsProps) {
  const hasRating =
    ratingCount > 0 &&
    ratingAverage !== null &&
    Number.isFinite(ratingAverage);

  const average = hasRating
    ? Math.max(0, Math.min(5, ratingAverage))
    : null;
  const displayedAverage = average?.toFixed(1);
  const formattedCount = new Intl.NumberFormat("en-IN").format(ratingCount);

  const label =
    average === null
      ? "New restaurant, no ratings yet"
      : `Rated ${displayedAverage} out of 5 by ${formattedCount} ${
          ratingCount === 1 ? "customer" : "customers"
        }`;

  return (
    <span
      className={`${styles.root} ${size === "sm" ? styles.small : ""} ${className ?? ""}`}
      role="img"
      aria-label={label}
    >
      <span className={styles.stars} aria-hidden="true">
        <span className={styles.outlineStars}>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className={styles.star} />
          ))}
        </span>
        <span
          className={styles.filledOverlay}
          style={{ width: `${(average ?? 0) * 20}%` }}
        >
          <span className={styles.filledStars}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star key={index} className={styles.star} />
            ))}
          </span>
        </span>
      </span>
      <span className={styles.label}>
        {displayedAverage === undefined
          ? "New · no ratings yet"
          : `${displayedAverage} (${formattedCount})`}
      </span>
    </span>
  );
}