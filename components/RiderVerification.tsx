import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, FileText, ShieldCheck, Upload, XCircle } from "lucide-react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { postRiderAction } from "../endpoints/rider/action_POST.schema";
import { riderAcademyScenes } from "../helpers/riderAcademyScenes";
import { formatPaise } from "../helpers/formatPaise";
import { useRiderOnboardingFeeCheckout } from "../helpers/useRiderOnboardingFeeCheckout";
import { uploadRiderDocument } from "../helpers/uploadRiderDocument";
import { useOnboardingVideoWatched } from "../helpers/useOnboardingVideoWatched";

import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { HindiOnboardingVideo } from "./HindiOnboardingVideo";
import { MerchantCard, MerchantSectionHeader } from "./MerchantUi";
import { RiderAcademyScreens } from "./RiderAcademyScreens";
import { StatusPill } from "./StatusPill";
import styles from "./RiderVerification.module.css";

type UploadedDocument = { filename: string; previewUrl: string; isImage: boolean };

const Preview = ({
  url,
  isImage,
  label,
}: {
  url: string;
  isImage: boolean;
  label: string;
}) => (
  <a className={styles.preview} href={url} target="_blank" rel="noreferrer">
    {isImage ? <img src={url} alt={`${label} preview`} /> : <FileText size={24} aria-hidden="true" />}
    <span>View {label.toLowerCase()}</span>
  </a>
);

export const RiderVerification = ({
  data,
  video,
  onGoOnline,
  onlinePending,
  className,
}: {
  data: OutputType;
  video?: ReactNode;
  onGoOnline: () => void;
  onlinePending: boolean;
  className?: string;
}) => {
  const rider = data.rider;
  if (!rider) throw new Error("RiderVerification requires a registered rider");

  const { watched, markCompleted } = useOnboardingVideoWatched("rider");
  const [licence, setLicence] = useState<UploadedDocument | null>(null);
  const [selfie, setSelfie] = useState<UploadedDocument | null>(null);
  const [vehicleType, setVehicleType] = useState<"Ebike" | "Normal bike">(rider.vehicleType === "Normal bike" ? "Normal bike" : "Ebike");
  const [vehicleNumber, setVehicleNumber] = useState(rider.vehicleNumber || "");
  const [alternatePhone, setAlternatePhone] = useState(rider.alternatePhone || "");
  const [licenceExpiryDate, setLicenceExpiryDate] = useState(rider.licenceExpiryDate ? new Date(rider.licenceExpiryDate).toISOString().slice(0, 10) : "");
  const [accountHolder, setAccountHolder] = useState(data.payoutDetails.accountHolder || "");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState(data.payoutDetails.ifsc || "");
  const [uploading, setUploading] = useState<"licence" | "selfie" | null>(null);
  const [error, setError] = useState("");
  const [replaceDocuments, setReplaceDocuments] = useState(false);
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const checkout = useRiderOnboardingFeeCheckout();
  const submit = ziptoHooks.useAction(
    postRiderAction,
    [ziptoHooks.keys.riderDashboard],
    "Documents sent for review",
  );

  const underReview = rider.status === "pending" && rider.documentsSubmittedAt !== null;
  const showUploads =
    rider.status !== "approved" &&
    rider.status !== "suspended" &&
    rider.onboardingFeePaidAt !== null &&
    (!underReview || replaceDocuments);

  const uploadFile = async (kind: "licence" | "selfie", file?: File) => {
    if (!file) return;
    setError("");
    if (kind === "licence") setLicence(null);
    else setSelfie(null);
    setUploading(kind);
    try {
      const result = await uploadRiderDocument(kind, file);
      const document = { ...result, isImage: file.type.startsWith("image/") };
      if (kind === "licence") setLicence(document);
      else setSelfie(document);
    } catch (caught) {
      console.error(`Rider ${kind} upload failed:`, caught);
      setError(caught instanceof Error ? caught.message : "Document upload failed");
    } finally {
      setUploading(null);
    }
  };

  const sendForReview = () => {
    if (!licence || !selfie || !vehicleNumber.trim() || !alternatePhone.trim() || !licenceExpiryDate || !accountHolder.trim() || !accountNumber.trim() || !ifsc.trim()) {
      setError("Complete every required vehicle, contact, driving licence and bank detail, then upload your driving licence and selfie.");
      return;
    }
    if (new Date(`${licenceExpiryDate}T23:59:59`) < new Date()) { setError("Your driving licence has expired. Enter a valid expiry date."); return; }
    if (!/^[6-9]\d{9}$/.test(alternatePhone)) { setError("Enter a valid 10-digit alternate phone number."); return; }
    if (!/^\d{9,18}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) { setError("Enter a valid bank account number and IFSC code."); return; }
    setError("");
    submit.mutate(
      {
        action: "submit_documents",
        licenceFile: licence.filename,
        selfieFile: selfie.filename,
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        alternatePhone,
        licenceExpiryDate,
        accountHolder: accountHolder.trim(),
        accountNumber,
        ifsc: ifsc.trim().toUpperCase(),
      },
      {
        onSuccess: () => {
          setLicence(null);
          setSelfie(null);
          setAccountNumber("");
          setReplaceDocuments(false);
        },
      },
    );
  };

  const steps = [
    { label: "Registered", done: true },
    { label: "Onboarding fee paid", done: rider.onboardingFeePaidAt !== null },
    { label: "Driving licence uploaded", done: rider.hasLicence || licence !== null },
    { label: "Vehicle and bank details completed", done: Boolean(rider.vehicleNumber && rider.alternatePhone && rider.licenceExpiryDate && data.payoutDetails.hasDetails) },
    { label: "Selfie uploaded", done: rider.hasSelfie || selfie !== null },
    { label: "platr™ review", done: rider.status === "approved" },
    { label: "Ready to accept orders", done: rider.status === "approved" },
  ];

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader
        eyebrow="Verification"
        title="Ready to ride?"
        subtitle="Upload your documents so platr™ can approve your delivery partner account."
      />

      {!rider.onboardingFeePaidAt && rider.status !== "approved" && rider.status !== "suspended" && (
        <MerchantCard className={styles.feeCard}>
          <h2>Step 2: Pay the mandatory onboarding fee</h2>
          <p>Payment is required before you can continue to training, documents, or the rest of your rider dashboard.</p>
          <div className={styles.feeBreakdown}>
            <span>Onboarding fee</span><span>{formatPaise(data.onboardingFee.baseAmountPaise)}</span>
            <span>GST ({data.onboardingFee.gstPercent}%)</span><span>{formatPaise(data.onboardingFee.gstAmountPaise)}</span>
            <strong>Total due</strong><strong>{formatPaise(data.onboardingFee.amountPaise)}</strong>
          </div>
          <p>One-time, non-refundable. Secure payment via Razorpay (UPI, cards, netbanking).</p>
          <label>
            <Checkbox
              required
              checked={feeAcknowledged}
              onChange={(event) => setFeeAcknowledged(event.target.checked)}
            />{" "}
            I understand the one-time onboarding fee of {formatPaise(data.onboardingFee.amountPaise)} ({formatPaise(data.onboardingFee.baseAmountPaise)} + {data.onboardingFee.gstPercent}% GST {formatPaise(data.onboardingFee.gstAmountPaise)}) is non-refundable once paid and is charged before document verification. See{" "}
            <Link to="/terms#rider-onboarding-fee">Terms</Link>.
          </label>
          <Button size="lg" disabled={checkout.isBusy || !feeAcknowledged} onClick={() => void checkout.start()}>
            {checkout.phase === "opening" ? "Opening…" : checkout.phase === "verifying" ? "Verifying…" : `Pay ${formatPaise(data.onboardingFee.amountPaise)}`}
          </Button>
        </MerchantCard>
      )}

      {rider.reviewNote && (
        <MerchantCard className={styles.banner}>
          <div className={styles.bannerCopy}>
            <h2>{rider.status === "rejected" ? "Action required on your documents" : "Message from platr™"}</h2>
            <p>{rider.reviewNote}</p>
          </div>
        </MerchantCard>
      )}

      {rider.onboardingFeePaidAt && <div className={styles.columns}>
        <MerchantCard className={styles.videoCard}>
          <h2>Rider training video (Hindi)</h2>
          {video ?? (
            <HindiOnboardingVideo
              scenes={riderAcademyScenes}
              renderScreen={(sceneIndex, progress) => (
                <RiderAcademyScreens sceneIndex={sceneIndex} progress={progress} />
              )}
              endTitle="वीडियो पूरा हुआ ✓"
              endText="अब डॉक्यूमेंट अपलोड करें और ऑनलाइन होकर कमाई शुरू करें!"
              ariaLabel="platr™ Rider Academy हिंदी वीडियो"
              completed={watched}
              onComplete={markCompleted}
            />
          )}
        </MerchantCard>
        <MerchantCard className={styles.stepsCard}>
          <h2>Your progress</h2>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.label} className={step.done ? styles.done : ""}>
                <span className={styles.stepIcon}>
                  {step.done ? <CheckCircle2 size={18} aria-hidden="true" /> : index + 1}
                </span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </MerchantCard>
      </div>}

      {rider.onboardingFeePaidAt && <MerchantCard className={`${styles.banner} ${rider.status === "approved" ? styles.approved : rider.status === "rejected" ? styles.rejected : ""}`}>
        <div className={styles.bannerIcon}>
          {rider.status === "rejected" ? <XCircle size={25} /> : <ShieldCheck size={25} />}
        </div>
        <div className={styles.bannerCopy}>
          <StatusPill status={rider.status} />
          <h2>
            {rider.status === "approved"
              ? "Approved – you're ready to accept orders"
              : rider.status === "suspended"
                ? "Account suspended"
                : rider.status === "rejected"
                  ? "Please re-upload your documents"
                  : underReview
                    ? "Under review – usually within 24 hours"
                    : "Upload documents to get started"}
          </h2>
          {rider.onboardingFeePaidAt && <p>Onboarding fee paid ✓</p>}
          {rider.status === "suspended" && (
            <p>Need help? <Link to="/support">Contact platr™ Support</Link>.</p>
          )}
        </div>
        {rider.status === "approved" && !rider.isOnline && (
          <Button size="lg" disabled={onlinePending} onClick={onGoOnline}>Go online</Button>
        )}
        {underReview && !replaceDocuments && (
          <Button variant="secondary" onClick={() => setReplaceDocuments(true)}>Replace documents</Button>
        )}
      </MerchantCard>}

      {showUploads && rider.onboardingFeePaidAt && (
        <MerchantCard className={styles.uploadCard}>
          <div>
            <h2>Required rider details &amp; document upload</h2>
            <p>Complete all required fields below and upload your driving licence and selfie. Bank details are required for rider payouts.</p>
          </div>
          <div className={styles.uploadGrid}>
            <div className={styles.document}>
              <h3>Vehicle and contact details</h3>
              <label className={styles.rcField}>Vehicle type
                <select required value={vehicleType} onChange={(event) => setVehicleType(event.target.value as "Ebike" | "Normal bike")}><option value="Ebike">Ebike</option><option value="Normal bike">Normal bike</option></select>
              </label>
              <label className={styles.rcField}>Vehicle number
                <input required value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())} maxLength={20} placeholder="e.g. UK06AB1234" />
              </label>
              <label className={styles.rcField}>Alternate phone number
                <input required type="tel" inputMode="numeric" maxLength={10} value={alternatePhone} onChange={(event) => setAlternatePhone(event.target.value.replace(/\D/g, ""))} placeholder="10-digit mobile number" />
              </label>
              <label className={styles.rcField}>Driving licence expiry date
                <input required type="date" min={new Date().toISOString().slice(0, 10)} value={licenceExpiryDate} onChange={(event) => setLicenceExpiryDate(event.target.value)} />
              </label>
            </div>
            <div className={styles.document}>
              <h3>Bank details for payouts</h3>
              <label className={styles.rcField}>Account holder name
                <input required value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} maxLength={80} autoComplete="name" />
              </label>
              <label className={styles.rcField}>Bank account number
                <input required inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))} maxLength={18} />
              </label>
              <label className={styles.rcField}>IFSC code
                <input required value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} maxLength={11} autoCapitalize="characters" placeholder="e.g. SBIN0001234" />
              </label>
            </div>
            <div className={styles.document}>
              <h3>Driving licence</h3>
              <p>Clear photo or PDF · JPG, PNG, WebP or PDF · max 5 MB</p>
              {licence ? (
                <Preview url={licence.previewUrl} isImage={licence.isImage} label="Driving licence" />
              ) : rider.licenceUrl ? (
                <Preview url={rider.licenceUrl} isImage={!rider.licenceUrl.toLowerCase().split("?")[0].endsWith(".pdf")} label="Current driving licence" />
              ) : null}
              <label className={styles.fileLabel}>
                <Upload size={18} aria-hidden="true" />
                {uploading === "licence" ? "Uploading…" : licence ? "Change licence" : "Choose licence"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading !== null || submit.isPending}
                  onChange={(event) => {
                    void uploadFile("licence", event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className={styles.document}>
              <h3>Selfie</h3>
              <p>Clear face, no helmet or sunglasses, good light · max 5 MB</p>
              {selfie ? (
                <Preview url={selfie.previewUrl} isImage label="Selfie" />
              ) : rider.selfieUrl ? (
                <Preview url={rider.selfieUrl} isImage label="Current selfie" />
              ) : null}
              <label className={styles.fileLabel}>
                <Upload size={18} aria-hidden="true" />
                {uploading === "selfie" ? "Uploading…" : selfie ? "Retake selfie" : "Take or choose selfie"}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  disabled={uploading !== null || submit.isPending}
                  onChange={(event) => {
                    void uploadFile("selfie", event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button
            size="lg"
            className={styles.submitButton}
            disabled={!licence || !selfie || !vehicleNumber.trim() || !alternatePhone.trim() || !licenceExpiryDate || !accountHolder.trim() || !accountNumber.trim() || !ifsc.trim() || uploading !== null || submit.isPending}
            onClick={sendForReview}
          >
            {submit.isPending ? "Sending…" : "Send for review"}
          </Button>
        </MerchantCard>
      )}
    </div>
  );
};