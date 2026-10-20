import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import {
  postCustomerRateOrder,
  schema as ratingSchema,
} from "../endpoints/customer/rate_order_POST.schema";
import {
  postCustomerComplaint,
  schema as complaintSchema,
  type InputType as ComplaintInput,
} from "../endpoints/customer/complaint_POST.schema";
import type { OutputType as CustomerOrdersOutput } from "../endpoints/customer/orders_GET.schema";
import { uploadComplaintPhoto } from "../helpers/uploadComplaintPhoto";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Spinner } from "./Spinner";
import { Textarea } from "./Textarea";
import styles from "./OrderFeedback.module.css";

type Order = CustomerOrdersOutput["orders"][number];
type ComplaintSummary = CustomerOrdersOutput["complaintSummary"];
type Photo = { filename: string; previewUrl: string };

const reasons: { value: ComplaintInput["reason"]; label: string }[] = [
  { value: "quality", label: "Bad taste / quality" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "missing_item", label: "Item missing" },
  { value: "hygiene", label: "Hygiene issue" },
  { value: "stale", label: "Stale / cold food" },
  { value: "other", label: "Other" },
];

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

function complaintStatus(order: Order): string {
  const complaint = order.complaint;
  if (!complaint) return "";

  switch (complaint.status) {
    case "pending":
      return "Under review by platr™";
    case "approved":
      return `Approved – ${money(complaint.refundAmount)} refund`;
    case "rejected":
      return "Not approved";
    case "feedback_only":
      return "We have received your feedback and will inform the restaurant.";
  }
}

function refundStatus(order: Order): string | null {
  const complaint = order.complaint;
  if (!complaint || complaint.status !== "approved") return null;

  switch (complaint.refundStatus) {
    case "processed":
      return complaint.refundMethod === "wallet"
        ? "Refunded to platr™ Wallet"
        : "Refund sent to your original payment method";
    case "processing":
      return "Refund processing";
    case "failed":
      return "Refund delayed – our team is retrying";
    default:
      return null;
  }
}

export function OrderFeedback({
  order,
  complaintSummary,
  className,
}: {
  order: Order;
  complaintSummary: ComplaintSummary;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ComplaintInput["reason"] | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const uploadGeneration = useRef(0);

  const rate = useMutation({
    mutationFn: postCustomerRateOrder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.customerOrders }),
        queryClient.invalidateQueries({ queryKey: ["restaurant"] }),
        queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
      ]);
      toast.success("Thanks for rating!");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your rating."),
  });

  const report = useMutation({
    mutationFn: postCustomerComplaint,
    onSuccess: async (result) => {
      setOpen(false);
      resetReport();
      await queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.customerOrders });
      toast.success(result.message);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send your report."),
  });

  function resetReport() {
    uploadGeneration.current += 1;
    setReason(null);
    setDescription("");
    setPhotos([]);
    setFormError(null);
  }

  function changeOpen(next: boolean) {
    if (report.isPending) return;
    setOpen(next);
    if (!next) resetReport();
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (photos.length + files.length > 3) {
      setFormError("Choose up to 3 food photos.");
      return;
    }
    if (files.some((file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size <= 0 ||
      file.size > 5 * 1024 * 1024
    )) {
      setFormError("Each photo must be JPG, PNG or WebP and no more than 5 MB.");
      return;
    }

    setFormError(null);
    setUploading(true);
    const generation = uploadGeneration.current;
    try {
      for (const file of files) {
        const uploaded = await uploadComplaintPhoto(file);
        if (generation !== uploadGeneration.current) return;
        setPhotos((previous) => [...previous, uploaded]);
      }
    } catch (error) {
      console.error("Food complaint photo upload failed:", error);
      if (generation === uploadGeneration.current) {
        setFormError(error instanceof Error ? error.message : "Could not upload a photo.");
      }
    } finally {
      if (generation === uploadGeneration.current) setUploading(false);
    }
  }

  function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = ratingSchema.safeParse({ orderId: order.id, rating, comment });
    if (!input.success) {
      toast.error(rating === 0 ? "Choose a star rating first." : input.error.issues[0].message);
      return;
    }
    rate.mutate(input.data);
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const input = complaintSchema.safeParse({
      orderId: order.id,
      reason,
      description,
      imageFiles: photos.map((photo) => photo.filename),
    });
    if (!input.success) {
      setFormError(input.error.issues[0].message);
      return;
    }
    setFormError(null);
    report.mutate(input.data);
  }

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label={`Feedback for order ${order.id}`}>
      {order.rating ? (
        <div className={styles.ratingBlock}>
          <h3>Your rating for {order.restaurantName}</h3>
          <div className={styles.stars} aria-label={`${order.rating.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                className={index < order.rating!.rating ? styles.starFilled : styles.starEmpty}
                aria-hidden="true"
              />
            ))}
          </div>
          {order.rating.comment && <p className={styles.comment}>{order.rating.comment}</p>}
        </div>
      ) : (
        <form className={styles.ratingBlock} onSubmit={submitRating}>
          <h3>Rate {order.restaurantName}</h3>
          <div className={styles.stars} role="group" aria-label="Choose a rating from 1 to 5 stars">
            {Array.from({ length: 5 }, (_, index) => (
              <button
                key={index}
                type="button"
                className={styles.starButton}
                aria-label={`${index + 1} ${index === 0 ? "star" : "stars"}`}
                aria-pressed={rating === index + 1}
                onClick={() => setRating(index + 1)}
                disabled={rate.isPending}
              >
                <Star
                  className={index < rating ? styles.starFilled : styles.starEmpty}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <label className={styles.field}>
            <span>Comment (optional)</span>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              placeholder="Kaisa laga? Tell us about your food."
              disabled={rate.isPending}
            />
          </label>
          <Button type="submit" disabled={rate.isPending}>
            {rate.isPending ? "Submitting…" : "Submit rating"}
          </Button>
        </form>
      )}

      {order.complaint ? (
        <div className={styles.statusBlock} role="status">
          <strong>{complaintStatus(order)}</strong>
          {refundStatus(order) && <p>{refundStatus(order)}</p>}
          {order.complaint.status === "rejected" && order.complaint.adminNote && (
            <p>{order.complaint.adminNote}</p>
          )}
        </div>
      ) : order.complaintEligible ? (
        <>
          <Button variant="ghost" className={styles.reportButton} onClick={() => changeOpen(true)}>
            Food not good? Report a problem
          </Button>
          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent className={styles.dialog}>
              <DialogHeader>
                <DialogTitle>Report a food problem</DialogTitle>
                <DialogDescription>
                  Tell us what happened with order #{order.id}. platr™ will review your report.
                </DialogDescription>
              </DialogHeader>
              <form className={styles.reportForm} onSubmit={submitReport}>
                <div className={styles.info}>
                  {complaintSummary.remaining === 0
                    ? "You've used all refund complaints – your feedback will still be shared with the restaurant."
                    : `Approved complaints get 50% of food item value back (taxes & delivery excluded). You have ${complaintSummary.remaining} of ${complaintSummary.limit} refund complaints left.`}
                  <span>Report within {complaintSummary.windowHours} hours of delivery.</span>
                </div>
                <label className={styles.field} htmlFor={`reason-${order.id}`}>What went wrong?</label>
                <Select
                  value={reason ?? undefined}
                  onValueChange={(value) => setReason(value as ComplaintInput["reason"])}
                  disabled={report.isPending}
                >
                  <SelectTrigger id={`reason-${order.id}`} aria-label="Complaint reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className={styles.field}>
                  <span>Describe the problem</span>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    required
                    disabled={report.isPending}
                    placeholder="What was wrong with the food? At least 10 characters."
                  />
                </label>
                <label className={styles.field}>
                  <span>Food photos (1–3 required)</span>
                  <input
                    className={styles.fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => void addPhotos(event)}
                    disabled={uploading || report.isPending || photos.length >= 3}
                    aria-describedby={`photo-help-${order.id}`}
                  />
                  <small id={`photo-help-${order.id}`}>JPG, PNG or WebP · up to 5 MB each</small>
                </label>
                {uploading && <p className={styles.uploading} role="status"><Spinner size="sm" /> Uploading photos…</p>}
                {photos.length > 0 && (
                  <div className={styles.photos} aria-label="Uploaded photos">
                    {photos.map((photo) => (
                      <div className={styles.photo} key={photo.filename}>
                        <img src={photo.previewUrl} alt="Uploaded food evidence" />
                        <button
                          type="button"
                          className={styles.removePhoto}
                          aria-label="Remove photo"
                          onClick={() => setPhotos((previous) => previous.filter((item) => item.filename !== photo.filename))}
                          disabled={uploading || report.isPending}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {formError && <p className={styles.error} role="alert">{formError}</p>}
                <div className={styles.actions}>
                  <Button type="button" variant="ghost" onClick={() => changeOpen(false)} disabled={report.isPending}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading || report.isPending}>
                    {report.isPending ? "Sending…" : "Submit report"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </section>
  );
}