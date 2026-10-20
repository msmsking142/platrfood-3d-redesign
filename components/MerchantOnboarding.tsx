import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Store,
  Upload,
} from "lucide-react";
import {
  postOnboarding,
  schema as onboardingSchema,
  type InputType,
} from "../endpoints/onboarding_POST.schema";
import { useOnboardingVideoWatched } from "../helpers/useOnboardingVideoWatched";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { uploadFssai } from "../helpers/uploadFssai";
import { Button } from "./Button";
import { HindiOnboardingVideo } from "./HindiOnboardingVideo";
import { Input } from "./Input";
import { MerchantCard, MerchantField, MerchantSectionHeader } from "./MerchantUi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Textarea } from "./Textarea";
import styles from "./MerchantOnboarding.module.css";

type RestaurantInput = Extract<InputType, { kind: "restaurant" }>;
type FieldErrors = Record<string, string>;


const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function tomorrowLocal(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export const MerchantOnboarding = ({ className }: { className?: string }) => {
  const [introComplete, setIntroComplete] = useState(false);
  const { watched, markCompleted } = useOnboardingVideoWatched();
  const settings = ziptoHooks.useSettings();
  const basicPct = settings.data?.basicCommissionPercent ?? 15;
  const proPct = settings.data?.proCommissionPercent ?? 8;
  const proFee = settings.data?.proMonthlyFee ?? 2499;
  const [values, setValues] = useState({
    name: "",
    phone: "",
    town: "Kichha",
    address: "",
    cuisine: "",
    description: "",
    plan: "basic" as RestaurantInput["plan"],
    fssaiLicenseNumber: "",
    fssaiExpiryDate: "",
  });
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onboarding = ziptoHooks.useAction(
    (input: RestaurantInput) => postOnboarding(input),
    [ziptoHooks.keys.restaurantDashboard],
    "Details submitted for approval",
  );

  const update = (field: keyof typeof values, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setDocumentUrl("");
    setUploadError("");
    setFieldErrors((previous) => ({ ...previous, fssaiDocumentUrl: "" }));
    setUploading(true);
    try {
      setDocumentUrl(await uploadFssai(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not upload your licence.";
      console.error("FSSAI licence upload failed:", error);
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading || onboarding.isPending) return;

    const errors: FieldErrors = {};
    if (!documentUrl) errors.fssaiDocumentUrl = "Upload your FSSAI licence first.";
    if (!values.fssaiExpiryDate || values.fssaiExpiryDate < tomorrowLocal()) {
      errors.fssaiExpiryDate = "Choose a future licence expiry date.";
    }

    const result = onboardingSchema.safeParse({
      kind: "restaurant",
      name: values.name,
      phone: values.phone,
      town: values.town,
      address: values.address,
      cuisine: values.cuisine || undefined,
      description: values.description || undefined,
      plan: values.plan,
      fssaiLicenseNumber: values.fssaiLicenseNumber,
      fssaiDocumentUrl: documentUrl,
      fssaiExpiryDate: values.fssaiExpiryDate,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field && !errors[field]) errors[field] = issue.message;
      }
    }

    setFieldErrors(errors);
    if (!result.success || Object.keys(errors).length > 0) return;
    if (result.data.kind !== "restaurant") {
      throw new Error("Expected restaurant onboarding details.");
    }
    onboarding.mutate(result.data);
  };

  if (!introComplete) {
    return (
      <div className={`${styles.wrap} ${className || ""}`}>
        <MerchantSectionHeader
          eyebrow="platr™ Partner Academy"
          title="पहले यह वीडियो देखें"
          subtitle="Watch the full Hindi onboarding video to unlock restaurant registration."
        />
        <HindiOnboardingVideo completed={watched} onComplete={markCompleted} />
        <div className={styles.academyActions}>
          <p>वीडियो पूरा देखने के बाद रजिस्ट्रेशन खुलेगा</p>
          <Button disabled={!watched} onClick={() => setIntroComplete(true)}>
            Continue to registration →
          </Button>
        </div>
        <p className={styles.support}>
          Need help? <Link to="/support">Contact platr™ Support</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${className || ""}`}>
      <MerchantSectionHeader
        eyebrow="platr™ Partner"
        title="Apna restaurant platr™ par lao."
        subtitle="Introduction complete. Submit your outlet details for founder approval."
      />
      <form className={styles.form} onSubmit={submit} noValidate>
        <MerchantCard className={styles.detailsCard}>
          <div className={styles.cardHeading}>
            <Store size={22} aria-hidden="true" />
            <div><h2>Restaurant details</h2><p>Use the details customers and riders will recognise.</p></div>
          </div>
          <div className={styles.fields}>
            <MerchantField label="Restaurant name">
              <Input
                required
                autoComplete="organization"
                value={values.name}
                aria-invalid={!!fieldErrors.name}
                onChange={(event) => update("name", event.target.value)}
              />
              {fieldErrors.name && <span className={styles.error} role="alert">{fieldErrors.name}</span>}
            </MerchantField>
            <MerchantField label="Phone number">
              <Input
                required
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={values.phone}
                aria-invalid={!!fieldErrors.phone}
                onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              {fieldErrors.phone && <span className={styles.error} role="alert">{fieldErrors.phone}</span>}
            </MerchantField>
            <MerchantField label="Town">
              <Select value={values.town} onValueChange={(town) => update("town", town)}>
                <SelectTrigger aria-label="Town" aria-invalid={!!fieldErrors.town}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ziptoConfig.towns.map((town) => (
                    <SelectItem key={town} value={town}>{town}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.town && <span className={styles.error} role="alert">{fieldErrors.town}</span>}
            </MerchantField>
            <MerchantField label="Full address" className={styles.wideField}>
              <Input
                required
                autoComplete="street-address"
                value={values.address}
                aria-invalid={!!fieldErrors.address}
                onChange={(event) => update("address", event.target.value)}
              />
              {fieldErrors.address && <span className={styles.error} role="alert">{fieldErrors.address}</span>}
            </MerchantField>
            <MerchantField label="Cuisine (optional)">
              <Input
                value={values.cuisine}
                maxLength={80}
                onChange={(event) => update("cuisine", event.target.value)}
              />
              {fieldErrors.cuisine && <span className={styles.error} role="alert">{fieldErrors.cuisine}</span>}
            </MerchantField>
            <MerchantField label="Short description (optional)" className={styles.wideField}>
              <Textarea
                value={values.description}
                maxLength={300}
                onChange={(event) => update("description", event.target.value)}
              />
              {fieldErrors.description && <span className={styles.error} role="alert">{fieldErrors.description}</span>}
            </MerchantField>
          </div>
        </MerchantCard>

        <MerchantCard className={styles.detailsCard}>
          <div className={styles.cardHeading}>
            <ShieldCheck size={22} aria-hidden="true" />
            <div><h2>FSSAI verification</h2><p>A valid licence is required before your outlet can go live.</p></div>
          </div>
          <div className={styles.fields}>
            <MerchantField label="14-digit FSSAI licence / registration number" hint="Enter the number exactly as printed on your certificate" className={styles.wideField}>
              <Input required inputMode="numeric" maxLength={14} value={values.fssaiLicenseNumber} aria-invalid={!!fieldErrors.fssaiLicenseNumber} onChange={(event) => update("fssaiLicenseNumber", event.target.value.replace(/\D/g, "").slice(0, 14))} />
              {fieldErrors.fssaiLicenseNumber && <span className={styles.error} role="alert">{fieldErrors.fssaiLicenseNumber}</span>}
            </MerchantField>
            <MerchantField label="FSSAI licence" hint="PDF, JPG or PNG · maximum 5 MB" className={styles.wideField}>
              <div className={styles.uploadPanel}>
                {documentUrl ? <CheckCircle2 size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
                <span>{uploading ? "Uploading licence…" : documentUrl ? "Licence uploaded ✓ · choose another file to replace" : "Choose a licence file"}</span>
                <input
                  className={styles.fileInput}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  disabled={uploading}
                  aria-invalid={!!(uploadError || fieldErrors.fssaiDocumentUrl)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onFile(file);
                  }}
                />
              </div>
              {uploadError && <span className={styles.error} role="alert">{uploadError}</span>}
              {fieldErrors.fssaiDocumentUrl && !uploadError && (
                <span className={styles.error} role="alert">{fieldErrors.fssaiDocumentUrl}</span>
              )}
            </MerchantField>
            <MerchantField label="Licence expiry date">
              <input
                className={styles.dateInput}
                required
                type="date"
                min={tomorrowLocal()}
                value={values.fssaiExpiryDate}
                aria-invalid={!!fieldErrors.fssaiExpiryDate}
                onChange={(event) => update("fssaiExpiryDate", event.target.value)}
              />
              {fieldErrors.fssaiExpiryDate && (
                <span className={styles.error} role="alert">{fieldErrors.fssaiExpiryDate}</span>
              )}
            </MerchantField>
          </div>
        </MerchantCard>

        <MerchantCard tone="gold" className={styles.detailsCard}>
          <div className={styles.cardHeading}>
            <FileCheck2 size={22} aria-hidden="true" />
            <div><h2>Choose your plan</h2><p>Fair pricing for your restaurant.</p></div>
          </div>
          {settings.isError && <p className={styles.error} role="alert">Could not load current plan pricing: {settings.error.message}. Showing indicative prices.</p>}
          <div className={styles.plans} role="radiogroup" aria-label="Restaurant plan">
            <label className={`${styles.planOption} ${values.plan === "basic" ? styles.selectedPlan : ""}`}>
              <input
                type="radio"
                name="plan"
                value="basic"
                checked={values.plan === "basic"}
                onChange={() => update("plan", "basic")}
              />
              <span className={styles.planCopy}>
                <strong>Basic</strong>
                <span className={styles.planPrice}>{rupees.format(0)} <small>/ month</small></span>
                <span>{basicPct}% commission per order</span>
              </span>
            </label>
            <label className={`${styles.planOption} ${values.plan === "pro" ? styles.selectedPlan : ""}`}>
              <input
                type="radio"
                name="plan"
                value="pro"
                checked={values.plan === "pro"}
                onChange={() => update("plan", "pro")}
              />
              <span className={styles.planCopy}>
                <strong>Pro</strong>
                <span className={styles.planPrice}>{rupees.format(proFee)} + GST <small>/ 30 days</small></span>
                <span>{proPct}% commission per order</span>
              </span>
            </label>
          </div>
          <div className={styles.feeNotice}>
            <strong>Fees to pay at onboarding</strong>
            <p>Basic: ₹0 – nothing to pay now.</p>
            <p>
              Pro: {rupees.format(proFee)} + {settings.data?.proGstPercent ?? 18}% GST
              {" "}= {rupees.format(settings.data?.proMonthlyTotal ?? 2949)} per 30 days,
              paid via Razorpay from your Subscription page after approval.
            </p>
            <p>No joining fee.</p>
          </div>
          <p className={styles.planNote}>+18% GST on commission. No payment gateway fee. No charge for orders requiring support. Delivery fee seedha rider ko.</p>
          
          <p className={styles.planNote}>Pro plan is paid securely via Razorpay after approval from your Subscription page.</p>
        </MerchantCard>

        <div className={styles.submitArea}>
          {onboarding.isError && (
            <p className={styles.error} role="alert">
              {onboarding.error instanceof Error ? onboarding.error.message : "Could not submit your details. Please try again."}
            </p>
          )}
          <Button type="submit" size="lg" disabled={uploading || onboarding.isPending}>
            {onboarding.isPending ? "Submitting details…" : "Submit for approval"}
          </Button>
          <p>Your outlet stays closed until platr™ approves verification.</p>
          <p>Questions? <Link to="/support">Contact platr™ Support</Link>.</p>
        </div>
      </form>
    </div>
  );
};