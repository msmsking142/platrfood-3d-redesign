import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { OtpVerifyForm } from "./OtpVerifyForm";
import { useAuth } from "../helpers/useAuth";
import { authDestination } from "../helpers/authDestination";
import type { OtpChallengeResponse } from "../endpoints/auth/verify_otp_POST.schema";
import {
  schema,
  postRegister,
} from "../endpoints/auth/register_with_password_POST.schema";
import styles from "./PasswordRegisterForm.module.css";

export type RegisterFormData = z.infer<typeof schema>;

interface PasswordRegisterFormProps {
  className?: string;
  defaultValues?: Partial<RegisterFormData>;
}

export const PasswordRegisterForm: React.FC<PasswordRegisterFormProps> = ({
  className,
  defaultValues,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    schema,
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      phone: "",
      role: "user",
      ...defaultValues,
    },
  });

  const handleSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postRegister(data);
      setChallenge(result);
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err instanceof Error
          ? err.message.includes("Email already in use")
            ? "This email is already registered. Please try logging in instead."
            : err.message
          : "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

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
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {error && <div role="alert" className={styles.errorMessage}>{error}</div>}

        <FormItem name="email">
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              disabled={isLoading}
              value={form.values.email}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="displayName">
          <FormLabel>Display Name</FormLabel>
          <FormControl>
            <Input
              placeholder="Your Name"
              autoComplete="name"
              disabled={isLoading}
              value={form.values.displayName}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormDescription>
            Spaces, emojis, and special characters are all allowed
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="phone">
          <FormLabel>Mobile number</FormLabel>
          <FormControl>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              placeholder="98XXXXXXXX"
              disabled={isLoading}
              value={form.values.phone}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, ""),
                }))
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
              autoComplete="new-password"
              placeholder="••••••••"
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
          <FormDescription>At least 8 characters</FormDescription>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" /> Continuing...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
    </Form>
  );
};