---
created: 2026-10-14T09:45:15.332Z
updated: 2026-10-14T09:45:15.332Z
---

## Summary
Add an email one-time code (OTP) as a second step for **all roles** (customer, restaurant, rider, admin):
- **Login:** email + password first. If the password is correct, a 6-digit code is emailed. The session starts only after the code is entered.
- **Signup:** after filling the form, a code is sent to the email. The account is created only after the code is verified, so every account has a real, working email.
- Forgot password stays as-is (it already uses an emailed code).

## Prerequisite (must do before publishing)
No email domain is verified yet, so emails currently reach **only the project owner** (Manpreet). Before go-live:
1. Open the **Email tab in the right sidebar** → "Add email domain" → use a subdomain such as `mail.<your-domain>` → add the DNS records shown (or "Set up automatically").
2. After it verifies, the sender address in code is set to `Zipto <noreply@mail.<your-domain>>` (also for password reset and Pro emails in `sendZiptoEmail`).
Limit: 1,000 emails/day from the published app (each login = 1 email).

## Database changes (one migration)
- New enum `otp_purpose` = `login | signup`.
- New table `email_otp_challenges`: `id uuid PK`, `email text`, `purpose otp_purpose`, `user_id int null → users.id`, `code_hash text`, `signup_payload jsonb null` (displayName, phone, role, passwordHash — never plain password), `attempts int default 0`, `expires_at timestamptz`, `used_at timestamptz null`, `last_sent_at timestamptz`, `send_count int default 1`, `created_at timestamptz default now()`. Index on `(email, created_at)`.
- `users.email_verified_at timestamptz null` (set on first successful OTP).

## Files to Create
- **helpers/emailOtp** (backend): generate 6-digit code (`crypto.randomInt`), hash (sha256 of `challengeId:code`), create challenge, send the OTP email (Zipto-branded HTML + text, "Code expires in 10 minutes, never share it"), verify code (constant-time compare, max 5 attempts, expiry, single use), mask email for display (`ma***@gmail.com`). Rate limits: max 5 codes per email per hour, 60-second resend cooldown.
- **endpoints/auth/verify_otp_POST** `{ challengeId, code }`: login → create session + set cookie, log success in `login_attempts`; signup → re-check email not taken & launch-mode rules, create user + password row + session in one transaction. Sets `email_verified_at`. Returns `{ user }`.
- **endpoints/auth/resend_otp_POST** `{ challengeId }`: new code on the same challenge (respecting cooldown/limits), returns `{ resendAvailableAt }`.
- **components/OtpVerifyForm**: 6-box code input (paste supported, numeric keypad on mobile, auto-submit when 6 digits filled), "Code sent to ma***@gmail.com", resend button with 60s countdown, "Change email / back" link, error states (wrong code, expired, too many attempts → start again). Hinglish-friendly copy.

## Files to Modify
- **endpoints/auth/login_with_password_POST** (+schema): on correct password, do NOT create a session; create a `login` challenge, send the code, return `{ otpRequired: true, challengeId, maskedEmail, resendAvailableAt }`. Keep existing lockout/rate limiting. Wrong password behaviour unchanged.
- **endpoints/auth/register_with_password_POST** (+schema): keep all validation (site paused, launch mode for customers, email in use), hash password, create a `signup` challenge with the payload, send code, return the same OTP-required shape. No user row created yet.
- **components/PasswordLoginForm**: after password step show `OtpVerifyForm`; on verify call `onLogin(user)` and navigate by role (same as today).
- **pages/login**: join form shows `OtpVerifyForm` after submit; on verify → `onLogin` + navigate to /partner, /rider or /.
- **helpers/sendZiptoEmail** / **request_password_reset_POST**: point sender at the verified domain once available (single constant).
- **static/__dev/system-prompt.md**: note "Login = password + email OTP for all roles; signup verified by email OTP."

## Approach
1. Run the DB migration and pull schema.
2. Build `helpers/emailOtp`, then the two new endpoints, then modify login/register endpoints.
3. Build `OtpVerifyForm`, wire into login form and join form.
4. Verify via runCodeInBrowser: wrong code counts attempts, 6th attempt blocked, expired code rejected, resend cooldown, signup creates user only after verify, login session only after verify. (In preview, codes arrive only at the owner's email — test with the owner account.)

## Risks & Considerations
- **Until an email domain is verified, nobody except the owner can log in or sign up** once this is live. Do not publish this change before the domain is verified.
- Existing logged-in sessions stay valid; OTP applies on the next login.
- Emails can land in spam/promotions at first; the OTP screen will say "Check spam folder too".
- Sessions last 7 days, so users won't need a code every visit.
- Riders/merchants with mistyped emails at signup can no longer create an account until they use a correct email (intended).
- Admin is included (strongest protection for the founder account).
