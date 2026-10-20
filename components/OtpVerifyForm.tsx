import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { postResendOtp } from "../endpoints/auth/resend_otp_POST.schema";
import {
  OtpError,
  postVerifyOtp,
  type OtpErrorCode,
} from "../endpoints/auth/verify_otp_POST.schema";
import type { User } from "../helpers/User";
import { useCallbackRef } from "../helpers/useCallbackRef";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import styles from "./OtpVerifyForm.module.css";

interface OtpVerifyFormProps {
  challengeId: string;
  maskedEmail: string;
  resendAvailableAt: Date;
  onVerified: (user: User) => void;
  onBack: () => void;
  className?: string;
}

const emptyDigits = () => Array<string>(6).fill("");

const secondsUntil = (timestamp: number) =>
  Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));

export const OtpVerifyForm = ({
  challengeId,
  maskedEmail,
  resendAvailableAt,
  onVerified,
  onBack,
  className,
}: OtpVerifyFormProps) => {
  const [digits, setDigits] = useState(emptyDigits);
  const [displayEmail, setDisplayEmail] = useState(maskedEmail);
  const [resendAt, setResendAt] = useState(resendAvailableAt.getTime());
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    secondsUntil(resendAvailableAt.getTime()),
  );
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<OtpErrorCode | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingRef = useRef(false);
  const resendingRef = useRef(false);
  const lastAutoSubmitted = useRef("");

  const initialResendAt = resendAvailableAt.getTime();

  useEffect(() => {
    setDigits(emptyDigits());
    setDisplayEmail(maskedEmail);
    setError(null);
    setErrorCode(null);
    lastAutoSubmitted.current = "";
    inputRefs.current[0]?.focus();
  }, [challengeId, maskedEmail]);

  useEffect(() => {
    setResendAt(initialResendAt);
  }, [challengeId, initialResendAt]);

  useEffect(() => {
    const updateCountdown = () => setRemainingSeconds(secondsUntil(resendAt));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [resendAt]);

  const verify = useCallbackRef(async (code: string) => {
    if (verifyingRef.current || resendingRef.current || errorCode === "RESTART") {
      return;
    }

    verifyingRef.current = true;
    setIsVerifying(true);
    setError(null);
    setErrorCode(null);

    try {
      const result = await postVerifyOtp({ challengeId, code });
      onVerified(result.user);
    } catch (caught) {
      console.error("OTP verification failed:", caught);
      const nextCode = caught instanceof OtpError ? caught.code : undefined;
      setError(
        caught instanceof Error
          ? caught.message
          : "Code verify nahi ho paya. Please try again.",
      );
      setErrorCode(nextCode ?? null);

      if (nextCode === "WRONG") {
        setDigits(emptyDigits());
        lastAutoSubmitted.current = "";
        inputRefs.current[0]?.focus();
      }
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  });

  useEffect(() => {
    const code = digits.join("");
    if (code.length !== 6 || code === lastAutoSubmitted.current) return;

    lastAutoSubmitted.current = code;
    void verify(code);
  }, [digits, verify]);

  const updateDigit = (index: number, rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, "");

    // Some OTP autofill providers insert the entire code into the first input.
    if (numbers.length === 6) {
      lastAutoSubmitted.current = "";
      setDigits(numbers.split(""));
      inputRefs.current[5]?.focus();
      return;
    }

    const digit = numbers.slice(-1);
    lastAutoSubmitted.current = "";
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedCode = event.clipboardData.getData("text").replace(/\D/g, "");
    if (pastedCode.length !== 6) return;

    event.preventDefault();
    lastAutoSubmitted.current = "";
    setDigits(pastedCode.split(""));
    inputRefs.current[5]?.focus();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      lastAutoSubmitted.current = "";
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const resend = async () => {
    if (
      remainingSeconds > 0 ||
      verifyingRef.current ||
      resendingRef.current ||
      errorCode === "RESTART"
    ) {
      return;
    }

    resendingRef.current = true;
    setIsResending(true);
    setError(null);
    setErrorCode(null);

    try {
      const result = await postResendOtp({ challengeId });
      setResendAt(result.resendAvailableAt.getTime());
      setDisplayEmail(result.maskedEmail);
      setDigits(emptyDigits());
      lastAutoSubmitted.current = "";
      inputRefs.current[0]?.focus();
      toast.success("New code sent");
    } catch (caught) {
      console.error("OTP resend failed:", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Naya code bhej nahi paye. Please try again.",
      );
    } finally {
      resendingRef.current = false;
      setIsResending(false);
    }
  };

  const isBusy = isVerifying || isResending;
  const mustRestart = errorCode === "RESTART";
  const isComplete = digits.every((digit) => digit.length === 1);

  return (
    <div className={`${styles.form} ${className ?? ""}`}>
      <div className={styles.heading}>
        <h2 className={styles.title}>Verify your email</h2>
        <p className={styles.sentText}>
          Code sent to <strong>{displayEmail}</strong>
        </p>
      </div>

      <div
        className={styles.digitGroup}
        role="group"
        aria-label="Six-digit email verification code"
        aria-describedby={error ? "otp-verify-error" : undefined}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            className={styles.digitInput}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            aria-label={`Digit ${index + 1} of 6`}
            aria-invalid={Boolean(error)}
            disabled={isBusy || mustRestart}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={handlePaste}
          />
        ))}
      </div>

      {error && (
        <div id="otp-verify-error" className={styles.error} role="alert">
          {error}
          {errorCode === "EXPIRED" && (
            <span className={styles.errorHint}>
              Code expire ho gaya. Naya code resend karein.
            </span>
          )}
        </div>
      )}

      {mustRestart ? (
        <Button className={styles.verifyButton} onClick={onBack}>
          Start again
        </Button>
      ) : (
        <Button
          className={styles.verifyButton}
          disabled={!isComplete || isBusy}
          onClick={() => void verify(digits.join(""))}
        >
          {isVerifying ? (
            <>
              <Spinner size="sm" /> Verifying…
            </>
          ) : (
            "Verify"
          )}
        </Button>
      )}

      {!mustRestart && (
        <div className={styles.resendSection}>
          <p className={styles.spamHint}>
            Inbox mein nahi mila? Spam/Promotions folder bhi check karein.
          </p>
          <Button
            variant="ghost"
            className={styles.resendButton}
            disabled={remainingSeconds > 0 || isBusy}
            onClick={() => void resend()}
          >
            {isResending ? (
              <>
                <Spinner size="sm" /> Sending…
              </>
            ) : remainingSeconds > 0 ? (
              `Resend code in ${remainingSeconds}s`
            ) : (
              "Resend code"
            )}
          </Button>
        </div>
      )}

      <Button
        variant="ghost"
        className={styles.backButton}
        disabled={isBusy}
        onClick={onBack}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Change email / back
      </Button>
    </div>
  );
};