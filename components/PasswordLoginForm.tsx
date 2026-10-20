import React, { useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { PasswordResetForm } from "./PasswordResetForm";
import { OtpVerifyForm } from "./OtpVerifyForm";
import {
  schema,
  postLogin,
} from "../endpoints/auth/login_with_password_POST.schema";
import { useAuth } from "../helpers/useAuth";
import { authDestination } from "../helpers/authDestination";
import type { OtpChallengeResponse } from "../endpoints/auth/verify_otp_POST.schema";
import styles from "./PasswordLoginForm.module.css";

export type LoginFormData = z.infer<typeof schema>;

interface PasswordLoginFormProps {
  className?: string;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    schema,
  });

  const handleSubmit = async (data: LoginFormData) => {
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      const result = await postLogin(data);
      if (result.otpRequired === false) {
        onLogin(result.user);
        navigate(authDestination(result.user.role));
      } else {
        setChallenge(result);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Keep "Forgot password?" reachable: it is the only way back in for an
  // account without a working password (it works even when sign-up is closed).
  if (resetting) {
    return (
      <PasswordResetForm
        className={className}
        defaultEmail={form.values.email}
        onCancel={() => setResetting(false)}
        onDone={() => {
          setResetting(false);
          setError(null);
          setNotice("Password updated. Log in with your new password.");
        }}
      />
    );
  }

  if (challenge) {
    return (
      <OtpVerifyForm
        className={className}
        challengeId={challenge.challengeId}
        maskedEmail={challenge.maskedEmail}
        resendAvailableAt={challenge.resendAvailableAt}
        onVerified={(user) => {
          onLogin(user);
          navigate(authDestination(user.role));
        }}
        onBack={() => {
          setChallenge(null);
          form.setValues((current) => ({ ...current, password: "" }));
        }}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {notice && <div className={styles.noticeMessage}>{notice}</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="email">
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              placeholder="your@email.com"
              type="email"
              autoComplete="email"
              disabled={isLoading}
              value={form.values.email}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Password</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              value={form.values.password}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <button
          type="button"
          className={styles.forgotButton}
          onClick={() => setResetting(true)}
        >
          Forgot password?
        </button>

        <small>We'll email you a 6-digit code.</small>
        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <span className={styles.loadingText}>
              <Spinner className={styles.spinner} size="sm" />
              Continuing...
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
    </Form>
  );
};
