import type { OutputType } from "../endpoints/admin/overview_GET.schema";
import type { InputType } from "../endpoints/admin/action_POST.schema";
import { Button } from "./Button";
import styles from "./AdminDishPhotoReviews.module.css";

type Props = {
  photos: OutputType["pendingDishPhotos"];
  onAction: (action: InputType) => void;
  isPending: boolean;
  className?: string;
};

export const AdminDishPhotoReviews = ({ photos, onAction, isPending, className }: Props) => (
  <section className={`${styles.section} ${className || ""}`}>
    <h2>Dish photos pending review</h2>
    {!photos.length ? <p>No dish photos waiting for review.</p> : photos.map((photo) => (
      <div className={styles.item} key={photo.id}>
        <div>
          <b>{photo.name}</b>
          <p>{photo.restaurantName} · {photo.town}</p>
          <div className={styles.photos}>
            {photo.imageUrl && (
              <div>
                <small>Current live photo</small>
                <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                  <img src={photo.imageUrl} alt={`Current photo for ${photo.name}`} />
                </a>
              </div>
            )}
            {photo.pendingImageUrl && (
              <div>
                <small>New photo</small>
                <a href={photo.pendingImageUrl} target="_blank" rel="noreferrer">
                  <img src={photo.pendingImageUrl} alt={`Proposed photo for ${photo.name}`} />
                </a>
              </div>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <Button size="sm" disabled={isPending} onClick={() => onAction({ action: "dish_image_review", id: photo.id, decision: "approve" })}>
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => {
            const reason = prompt("Reason for rejecting this photo", "Photo did not meet platr™ guidelines");
            if (reason !== null) onAction({ action: "dish_image_review", id: photo.id, decision: "reject", reason });
          }}>
            Reject
          </Button>
        </div>
      </div>
    ))}
  </section>
);