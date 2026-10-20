import { useState } from "react";
import { CheckCircle2, Clock, FileText, XCircle, Upload } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { uploadFssai } from "../helpers/uploadFssai";
import { Button } from "./Button";
import { HindiOnboardingVideo } from "./HindiOnboardingVideo";
import { useOnboardingVideoWatched } from "../helpers/useOnboardingVideoWatched";
import { Input } from "./Input";
import { StatusPill } from "./StatusPill";
import { MerchantCard, MerchantSectionHeader, MerchantField } from "./MerchantUi";
import styles from "./MerchantVerification.module.css";

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export const MerchantVerification = ({ data, className }: { data: OutputType; className?: string }) => {
  const r = data.restaurant!;
  const { watched, markCompleted } = useOnboardingVideoWatched();
  const act = ziptoHooks.useAction((x: Parameters<typeof postRestaurantAction>[0]) => postRestaurantAction(x), [ziptoHooks.keys.restaurantDashboard], "Licence submitted for review");
  const currentExpiry = r.fssaiExpiryDate ? new Date(r.fssaiExpiryDate).toISOString().slice(0, 10) : "";
  const [url, setUrl] = useState("");
  const [licenseNumber, setLicenseNumber] = useState(r.fssaiLicenseNumber || "");
  const [expiry, setExpiry] = useState(currentExpiry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expired = r.fssaiExpiryDate ? new Date(r.fssaiExpiryDate) < new Date() : true;

  const steps = [
    { label: "Outlet registered", done: true, icon: CheckCircle2 },
    { label: "FSSAI licence uploaded", done: !!r.fssaiDocumentUrl, icon: FileText },
    { label: "platr™ review", done: r.status === "approved", icon: r.status === "rejected" ? XCircle : Clock },
    { label: "Live on platr™", done: r.status === "approved", icon: CheckCircle2 },
  ];

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(""); setBusy(true);
    try { setUrl(await uploadFssai(file)); } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  };
  const submit = () => {
    const doc = url || r.fssaiDocumentUrl;
    if (!doc) return setError("Upload your FSSAI licence first");
    if (!expiry || expiry < tomorrow()) return setError("Choose a future expiry date");
    setError("");
    if (!/^\d{14}$/.test(licenseNumber)) return setError("Enter the 14-digit FSSAI licence/registration number.");
    act.mutate({ action: "update_fssai", fssaiDocumentUrl: doc, fssaiLicenseNumber: licenseNumber, fssaiExpiryDate: expiry }, { onSuccess: () => setUrl("") });
  };

  const message =
    r.status === "approved" ? "You're verified. Keep your licence up to date to stay listed."
    : r.status === "pending" ? "Our team is reviewing your details. This usually takes 1–2 working days."
    : r.status === "rejected" ? "Your verification was not approved. Please upload a clear, valid licence and resubmit, or contact support."
    : "Your outlet is suspended. Please contact platr™ support.";

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader eyebrow="Verification" title="Verification" subtitle="platr™ checks every outlet's FSSAI licence before it goes live – it keeps customers safe and builds trust." />

      <MerchantCard>
        <h3 className={styles.h3}>Onboarding video (Hindi)</h3>
        <HindiOnboardingVideo completed={watched} onComplete={markCompleted} />
      </MerchantCard>

      <MerchantCard tone={r.status === "approved" ? "gold" : r.status === "pending" ? "plain" : "warn"}>
        <div className={styles.statusRow}>
          <div><b>Verification status</b><p>{message}</p></div>
          <StatusPill status={r.status} />
        </div>
        <ol className={styles.steps}>
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.label} className={s.done ? styles.done : ""}>
                <span className={styles.stepIcon}><Icon size={18} /></span>
                <span>{i + 1}. {s.label}</span>
              </li>
            );
          })}
        </ol>
      </MerchantCard>

      <MerchantCard>
        <h3 className={styles.h3}>FSSAI licence</h3>
        <MerchantField label="14-digit FSSAI licence / registration number">
          <Input inputMode="numeric" maxLength={14} value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value.replace(/\D/g, "").slice(0, 14))} />
        </MerchantField>
        <p>Official-record check: <b>{r.fssaiVerificationStatus === "verified" ? "Marked verified" : r.fssaiVerificationStatus === "review_required" ? "Manual review required" : r.fssaiVerificationStatus === "rejected" ? "Check failed / rejected" : "Not checked yet"}</b>{r.fssaiVerificationCheckedAt ? ` · checked ${new Date(r.fssaiVerificationCheckedAt).toLocaleDateString("en-IN")}` : ""}</p>
        {r.fssaiVerificationNote && <p>{r.fssaiVerificationNote}</p>}
        {r.fssaiDocumentUrl ? (
          <p className={styles.current}>
            <FileText size={16} />
            <a href={r.fssaiDocumentUrl} target="_blank" rel="noreferrer">View current licence</a>
            {r.fssaiExpiryDate && <span className={expired ? styles.bad : ""}> · {expired ? "Expired" : "Valid till"} {new Date(r.fssaiExpiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </p>
        ) : <p className={styles.bad}>No licence uploaded yet.</p>}

        <div className={styles.form}>
          <MerchantField label="Upload new / replacement licence" hint="PDF, JPG or PNG · max 5 MB">
            <label className={styles.upload}>
              <Upload size={18} />
              <span>{busy ? "Uploading…" : url ? "New file uploaded ✓ – click to change" : "Choose file"}</span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </MerchantField>
          <MerchantField label="Licence expiry date">
            <Input type="date" min={tomorrow()} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </MerchantField>
        </div>
        {error && <p role="alert" className={styles.bad}>{error}</p>}
        <div className={styles.actions}>
          <Button disabled={busy || act.isPending || (!url && expiry === currentExpiry)} onClick={submit}>Submit for review</Button>
          <small>Submitting a new licence sends your outlet back for review and closes it until approved.</small>
        </div>
      </MerchantCard>
    </div>
  );
};