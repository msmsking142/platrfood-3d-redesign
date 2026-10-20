import { MessageSquareWarning, Star } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import {
  MerchantCard,
  MerchantEmpty,
  MerchantSectionHeader,
} from "./MerchantUi";
import styles from "./MerchantReviews.module.css";

type MerchantReviewsProps = {
  data: OutputType;
  className?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const MerchantReviews = ({
  data,
  className,
}: MerchantReviewsProps) => {
  const { average, count } = data.ratingSummary;

  return (
    <section className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader eyebrow="Reviews" title="Customer reviews" />

      <MerchantCard className={styles.summary}>
        <div className={styles.summaryRating}>
          {average === null ? (
            <strong className={styles.noRating}>No ratings yet</strong>
          ) : (
            <strong className={styles.average}>
              {new Intl.NumberFormat("en-IN", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(average)}
              <Star size={30} fill="currentColor" aria-hidden="true" />
            </strong>
          )}
          <span className={styles.ratingCount}>
            {new Intl.NumberFormat("en-IN").format(count)}{" "}
            {count === 1 ? "rating" : "ratings"}
          </span>
        </div>
        <p className={styles.summaryText}>
          Feedback from customers after their delivered orders.
        </p>
      </MerchantCard>

      <div className={styles.columns}>
        <MerchantCard className={styles.listCard}>
          <h2 className={styles.cardTitle}>Recent ratings</h2>
          {data.recentRatings.length === 0 ? (
            <MerchantEmpty
              icon={<Star size={24} aria-hidden="true" />}
              title="No ratings yet"
              text="Customer ratings will appear here after delivery."
            />
          ) : (
            <ul className={styles.list}>
              {data.recentRatings.map((rating) => (
                <li key={rating.orderId} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <strong>Order #ZIP-{rating.orderId}</strong>
                    <time dateTime={rating.createdAt.toISOString()}>
                      {dateFormatter.format(rating.createdAt)}
                    </time>
                  </div>
                  <div
                    className={styles.stars}
                    aria-label={`${rating.rating} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={16}
                        fill={index < rating.rating ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {rating.comment && (
                    <p className={styles.description}>{rating.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </MerchantCard>

        <MerchantCard className={styles.listCard}>
          <h2 className={styles.cardTitle}>Food complaints</h2>
          {data.foodComplaints.length === 0 ? (
            <MerchantEmpty
              icon={<MessageSquareWarning size={24} aria-hidden="true" />}
              title="No food complaints"
              text="Food-related feedback will appear here."
            />
          ) : (
            <ul className={styles.list}>
              {data.foodComplaints.map((complaint) => (
                <li key={complaint.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <strong>Order #ZIP-{complaint.orderId}</strong>
                    <span
                      className={`${styles.status} ${
                        complaint.status === "approved"
                          ? styles.statusApproved
                          : complaint.status === "rejected"
                            ? styles.statusRejected
                            : styles.statusNeutral
                      }`}
                    >
                      {complaint.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <strong className={styles.reason}>
                    {complaint.reason.replaceAll("_", " ")}
                  </strong>
                  <p className={styles.description}>
                    {complaint.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MerchantCard>
      </div>
    </section>
  );
};