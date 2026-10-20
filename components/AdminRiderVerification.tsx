import { useState } from "react";
import type { OutputType as Overview } from "../endpoints/admin/overview_GET.schema";
import type { InputType as AdminAction } from "../endpoints/admin/action_POST.schema";
import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import styles from "./AdminRiderVerification.module.css";

type Rider = Overview["riders"][number];

export const AdminRiderVerification = ({
  riders,
  onAction,
  isPending,
  className,
}: {
  riders: Rider[];
  onAction: (action: AdminAction) => void;
  isPending: boolean;
  className?: string;
}) => {
  const [actingOn, setActingOn] = useState<number | null>(null);
  const [rejectingRiderId, setRejectingRiderId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("Documents were unclear. Please upload again.");
  const waiting = riders.filter(
    (rider) => rider.status === "pending" && rider.documentsSubmittedAt !== null,
  ).length;
  const sorted = [...riders].sort(
    (a, b) =>
      Number(b.status === "pending" && b.documentsSubmittedAt !== null) -
      Number(a.status === "pending" && a.documentsSubmittedAt !== null),
  );
  const verificationChecks: Array<"identity" | "licence"> = ["identity", "licence"];

  const submit = (action: AdminAction, riderId: number) => {
    setActingOn(riderId);
    onAction(action);
  };

  return (
    <section id="rider-verification" className={`${styles.section} ${className ?? ""}`}>
      <div className={styles.heading}>
        <h2>Rider verification</h2>
        <span className={`${styles.badge} ${waiting > 0 ? styles.badgePending : ""}`}>{waiting} waiting for review</span>
      </div>
      {!sorted.length ? (
        <p>No rider registrations yet.</p>
      ) : (
        sorted.map((rider) => {
          const hasDocuments = Boolean(rider.licenceUrl && rider.selfieUrl);
          const feePaid = Boolean(rider.onboardingFeePaidAt);
          // Progress reflects whether the rider supplied both fields. Legacy registrations may
          // still contain vehicle types such as "Bike"; approval validation remains strict.
          const hasVehicle = Boolean(rider.vehicleType?.trim() && rider.vehicleNumber?.trim());
          const hasAlternatePhone = Boolean(rider.alternatePhone);
          const hasBankDetails = Boolean(rider.payoutAccountHolder && rider.payoutAccountNumber && rider.payoutIfsc);
          const steps = [
            { label: "Rider registered", done: true },
            { label: feePaid ? "₹234.82 onboarding fee paid" : "₹234.82 onboarding fee pending", done: feePaid },
            { label: "Hindi onboarding video", done: false, unknown: true },
            { label: "DL + selfie uploaded", done: hasDocuments },
            { label: "Identity checked", done: rider.identityVerificationStatus === "verified" },
            { label: "Driving licence checked", done: rider.licenceVerificationStatus === "verified" },
            { label: "Vehicle details", done: hasVehicle },
            { label: "Alternate phone", done: hasAlternatePhone },
            { label: "Bank details", done: hasBankDetails },
            { label: "Admin approval", done: rider.status === "approved" },
          ];
          const trackedSteps = steps.filter((step) => !step.unknown);
          const nextStep = trackedSteps.find((step) => !step.done);
          const suggestedMessage = nextStep
            ? nextStep.label === "₹234.82 onboarding fee pending"
              ? "Please complete your mandatory ₹234.82 onboarding fee payment in your platr™ Rider Centre. Training and document submission unlock after payment."
              : nextStep.label === "DL + selfie uploaded"
                ? "Please finish your platr™ rider verification by uploading a clear driving licence and selfie, and completing all required details on the Verification page."
                : `Please complete this pending platr™ rider onboarding step: ${nextStep.label}. Open Rider Centre → Verification to see what is needed next.`
            : "Your tracked onboarding steps are complete. platr™ will review your verification and update your status.";
          const licenceIsPdf = rider.licenceUrl
            ? new URL(rider.licenceUrl, window.location.origin).pathname.toLowerCase().includes(".pdf")
            : false;

          return (
            <div key={rider.id} className={styles.rider}>
              <div className={styles.details}>
                <b>{rider.name}</b>
                <p>{rider.town} · Vehicle: <strong>{rider.vehicleType}</strong> · Number: <strong>{rider.vehicleNumber || "not entered"}</strong></p>
                <small>{rider.phone} · {rider.email} · {rider.isOnline ? "Online" : "Offline"}</small>
                <p><StatusPill status={rider.status} /></p>
                <div className={styles.progress} aria-label="Rider onboarding progress">
                  <div className={styles.progressHeading}>
                    <b>Onboarding progress</b>
                    <span>{trackedSteps.filter((step) => step.done).length} of {trackedSteps.length} tracked steps complete</span>
                  </div>
                  <div className={styles.progressTrack}><span style={{ width: `${trackedSteps.filter((step) => step.done).length / trackedSteps.length * 100}%` }} /></div>
                  <ol className={styles.stepLine}>
                    {steps.map((step, index) => (
                      <li key={step.label} className={step.done ? styles.stepDone : step.unknown ? styles.stepUnknown : step === nextStep ? styles.stepNext : styles.stepTodo}>
                        <span className={styles.stepDot}>{step.done ? "✓" : step.unknown ? "?" : index + 1}</span>
                        <span>{step.label}</span>
                      </li>
                    ))}
                  </ol>
                  <p className={nextStep ? styles.nextStep : styles.allDone}>{nextStep ? `Next action: ${nextStep.label}${nextStep.label === "₹234.82 onboarding fee pending" ? " — rider must pay the one-time ₹199 fee + 18% GST before document submission" : nextStep.label === "Bank details" ? " — rider must add account holder, account number and IFSC" : nextStep.label === "Alternate phone" ? " — rider must enter an alternate contact number" : nextStep.label === "Vehicle details" ? " — rider must select Ebike or Normal bike and enter the vehicle number" : nextStep.label === "DL + selfie uploaded" ? " — rider must upload both documents" : nextStep.label === "Identity checked" || nextStep.label === "Driving licence checked" ? " — admin must review and mark verified" : ""}` : "All tracked onboarding checks are complete."}</p>
                  <div className={styles.feeStatus}>
                    <strong>Rider onboarding fee:</strong>{" "}
                    {feePaid ? `Paid${rider.onboardingFeePaidAt ? ` on ${new Date(rider.onboardingFeePaidAt).toLocaleString("en-IN")}` : ""} · ₹199 + 18% GST = ₹234.82` : "Not paid / payment not recorded · ₹199 + 18% GST = ₹234.82"}
                  </div>
                  <div className={styles.videoStatus}>
                    <strong>Hindi onboarding video:</strong> Available in the rider dashboard. Completion is currently stored only on the rider's device, so admin cannot yet confirm whether this rider watched it.
                  </div>
                </div>
                <div className={styles.manualChecks}>
                  <b>Manual checks</b>
                  <span>Identity: <strong>{rider.identityVerificationStatus || "not checked"}</strong></span>
                  <span>Driving licence: <strong>{rider.licenceVerificationStatus || "not checked"}</strong></span>
                  <span>Alternate phone: <strong>{rider.alternatePhone || "not entered"}</strong></span>
                  <span>Driving licence expiry: <strong>{rider.licenceExpiryDate ? new Date(rider.licenceExpiryDate).toLocaleDateString("en-IN") : "not entered"}</strong></span>
                  <span>Bank account holder: <strong>{rider.payoutAccountHolder || "not entered"}</strong></span>
                  <span>Bank account: <strong>{rider.payoutAccountNumber ? `••••${rider.payoutAccountNumber.slice(-4)}` : "not entered"}</strong></span>
                  <span>IFSC: <strong>{rider.payoutIfsc || "not entered"}</strong></span>
                </div>
                <p>
                  {rider.documentsSubmittedAt
                    ? `Submitted ${new Date(rider.documentsSubmittedAt).toLocaleDateString("en-IN")}`
                    : "Documents not uploaded yet"}
                </p>
                {rider.status === "rejected" && rider.reviewNote && (
                  <p className={styles.reviewNote}>Review note: {rider.reviewNote}</p>
                )}
                <div className={styles.documents}>
                  <div>
                    <small>Driving licence</small>
                    {rider.licenceUrl ? (
                      licenceIsPdf ? (
                        <a href={rider.licenceUrl} target="_blank" rel="noreferrer">
                          View licence PDF ↗
                        </a>
                      ) : (
                        <a href={rider.licenceUrl} target="_blank" rel="noreferrer">
                          <img src={rider.licenceUrl} alt={`${rider.name}'s driving licence`} />
                        </a>
                      )
                    ) : <p>Not uploaded</p>}
                  </div>
                  <div>
                    <small>Selfie</small>
                    {rider.selfieUrl ? (
                      <a href={rider.selfieUrl} target="_blank" rel="noreferrer">
                        <img src={rider.selfieUrl} alt={`${rider.name}'s selfie`} />
                      </a>
                    ) : <p>Not uploaded</p>}
                  </div>
                </div>
              </div>
              <div className={styles.actions}>
                <a className={styles.govLink} href="https://parivahan.gov.in/" target="_blank" rel="noreferrer">Check driving licence on Parivahan ↗</a>
                <a className={styles.govLink} href="https://uidai.gov.in/" target="_blank" rel="noreferrer">UIDAI guidance ↗</a>
                {verificationChecks
                  .filter((check) => (check === "identity"
                    ? rider.identityVerificationStatus
                    : rider.licenceVerificationStatus) !== "verified")
                  .map((check) => (
                    <Button key={check} size="sm" variant="outline" disabled={isPending || (check === "identity" && !rider.selfieUrl) || (check === "licence" && !rider.licenceUrl)} onClick={() => {
                      const note = prompt(`After checking the official record, enter your review note for ${check === "identity" ? "identity" : "driving licence"}.`);
                      if (note === null || note.trim().length < 3) return;
                      const status = prompt("Enter result exactly: verified, review_required, rejected", "verified");
                      if (status && ["verified", "review_required", "rejected"].includes(status)) {
                        submit({ action: "rider_manual_verification", id: rider.id, check, status: status as "verified" | "review_required" | "rejected", note }, rider.id);
                      }
                    }}>Review {check === "identity" ? "identity" : "DL"}</Button>
                  ))}
                <Button
                  className={styles.approveButton}
                  size="sm"
                  disabled={isPending}
                  onClick={() => submit({ action: "rider_status", id: rider.id, status: "approved" }, rider.id)}
                >
                  {isPending && actingOn === rider.id ? "Saving…" : "Approve"}
                </Button>
                <Button
                  className={styles.rejectButton}
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    setRejectingRiderId((current) => current === rider.id ? null : rider.id);
                    setRejectionReason("Documents were unclear. Please upload again.");
                  }}
                >
                  Reject
                </Button>
                <Button
                  className={styles.suspendButton}
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => submit({ action: "rider_status", id: rider.id, status: "suspended" }, rider.id)}
                >
                  Suspend
                </Button>
                {rejectingRiderId === rider.id && (
                  <div style={{ flexBasis: "100%", display: "grid", gap: 8, padding: 12, border: "1px solid #e5b7b7", borderRadius: 8, background: "#fff8f8" }}>
                    <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                      Rejection reason (shown to the rider)
                      <textarea
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        maxLength={200}
                        rows={3}
                        required
                        style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid #d8bcbc", borderRadius: 6, font: "inherit" }}
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending || !rejectionReason.trim()}
                        onClick={() => {
                          submit({ action: "rider_status", id: rider.id, status: "rejected", reason: rejectionReason.trim() }, rider.id);
                          setRejectingRiderId(null);
                        }}
                      >
                        Confirm rejection
                      </Button>
                      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRejectingRiderId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
};