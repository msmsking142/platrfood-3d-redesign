import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, ExternalLink } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { postMenuImageUpload } from "../endpoints/restaurant/menu_image_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { MerchantPinEditor } from "./MerchantPinEditor";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { FileDropzone } from "./FileDropzone";
import { MerchantSectionHeader, MerchantCard, MerchantField } from "./MerchantUi";
import styles from "./MerchantOutlet.module.css";

export const MerchantOutlet = ({ data, className }: { data: OutputType; className?: string }) => {
  const r = data.restaurant!;
  const act = ziptoHooks.useAction((x: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(x), [ziptoHooks.keys.restaurantDashboard], "Outlet details saved");
  const [f, setF] = useState({ description: r.description || "", cuisine: r.cuisine || "", address: r.address, phone: r.phone });

  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const photoAction = ziptoHooks.useAction(
    (input: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(input),
    [ziptoHooks.keys.restaurantDashboard],
    (input) => input.action === "submit_profile_image" ? "Photo sent for review" : "Photo review cancelled"
  );

  const uploadPhoto = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type))
        throw new Error("Please upload a JPG, PNG, WebP or AVIF image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be 8 MB or smaller.");
      const signed = await postMenuImageUpload({
        filename: file.name,
        contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/avif",
        sizeBytes: file.size,
        kind: "profile",
      });
      const response = await fetch(signed.presignedUrl, {
        method: "PUT",
        headers: signed.headers,
        body: file,
      });
      if (!response.ok) throw new Error("Photo upload failed. Please try again.");
      photoAction.mutate({ action: "submit_profile_image", imageUrl: signed.url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.address}, ${r.town}, Uttarakhand`)}`;
  const dirty = f.description !== (r.description || "") || f.cuisine !== (r.cuisine || "") || f.address !== r.address || f.phone !== r.phone;

  const save = () => {
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setError("Enter a valid 10-digit mobile number");
    if (f.address.trim().length < 8) return setError("Enter the full address");
    setError("");
    act.mutate({ action: "update_outlet", description: f.description.trim() || undefined, cuisine: f.cuisine.trim() || undefined, address: f.address.trim(), phone: f.phone });
  };

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader eyebrow="Outlet Information" title={r.name} subtitle="Keep these details accurate – customers and riders use them to find you." />
      <div className={styles.grid}>
        <MerchantCard>
          <h3 className={styles.h3}>Outlet details</h3>
          <div className={styles.form}>
            <div className={styles.locked}>
              <span><b>Name:</b> {r.name}</span>
              <span><b>Town:</b> {r.town}</span>
              <small>To change name or town, contact support (requires re-verification).</small>
            </div>
            <MerchantField label="Cuisine"><Input value={f.cuisine} maxLength={80} onChange={(e) => setF({ ...f, cuisine: e.target.value })} placeholder="North Indian, Chinese, Rajasthani…" /></MerchantField>
            <MerchantField label="About your restaurant"><Textarea rows={3} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What makes your food special?" /></MerchantField>
            <MerchantField label="Full address"><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></MerchantField>
            <MerchantField label="Outlet phone"><Input inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} /></MerchantField>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <Button disabled={!dirty || act.isPending} onClick={save}>{act.isPending ? "Saving…" : "Save details"}</Button>
          </div>
        </MerchantCard>
        <div className={styles.side}>
          <div id="outlet-pin">
            <MerchantCard>
              <h3 className={styles.h3}>Location</h3>
              <p className={styles.line}><MapPin size={16} /> {r.address}, {r.town}</p>
              <p className={styles.line}><Phone size={16} /> {r.phone}</p>
              <MerchantPinEditor lat={r.lat} lng={r.lng} />
              <a className={styles.mapLink} href={mapUrl} target="_blank" rel="noreferrer">
                Check on Google Maps <ExternalLink size={14} />
              </a>
            </MerchantCard>
          </div>
          <MerchantCard>
            <h3 className={styles.h3}>Display photo</h3>
            <p className={styles.photoHelp}>Customers see this photo on your restaurant page. Every new photo is reviewed by platr™ before it goes live.</p>
            <div className={styles.photoRow}>
              <div className={styles.photoGroup}>
                <span>Live</span>
                {r.profileImageUrl
                  ? <img className={styles.photoPreview} src={r.profileImageUrl} alt={`Live display photo for ${r.name}`} />
                  : <div className={styles.photoPlaceholder}>No live photo</div>}
              </div>
              {r.profileImageReview === "pending" && r.pendingProfileImageUrl && (
                <div className={styles.photoGroup}>
                  <span>Under review</span>
                  <img className={styles.photoPreview} src={r.pendingProfileImageUrl} alt={`Photo awaiting review for ${r.name}`} />
                </div>
              )}
            </div>
            {r.profileImageReview === "pending" ? (
              <Button variant="ghost" disabled={photoAction.isPending || uploading}
                onClick={() => photoAction.mutate({ action: "cancel_profile_image" })}>
                {photoAction.isPending ? "Cancelling…" : "Cancel photo review"}
              </Button>
            ) : (
              <>
                {r.profileImageReview === "rejected" && (
                  <p role="alert" className={styles.photoRejected}>
                    Photo rejected: {r.profileImageRejectReason || "Please upload a different photo."}
                  </p>
                )}
                <FileDropzone
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  maxFiles={1}
                  maxSize={8 * 1024 * 1024}
                  disabled={uploading || photoAction.isPending}
                  onFilesSelected={uploadPhoto}
                  title={uploading ? "Uploading photo…" : "Upload display photo"}
                  subtitle="JPG, PNG, WebP or AVIF · max 8 MB"
                />
                {photoAction.isPending && <p className={styles.photoHelp}>Sending photo for review…</p>}
              </>
            )}
          </MerchantCard>

        </div>
      </div>
    </div>
  );
};