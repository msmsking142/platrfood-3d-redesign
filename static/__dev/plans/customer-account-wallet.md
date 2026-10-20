---
created: 2026-10-14T09:48:25.877Z
updated: 2026-10-14T09:48:25.877Z
---

## Build order (this build implements ALL THREE plans)
1. `static/__dev/plans/customer-tracking-calls-sounds.md`: live tracking map, call rider, order sounds, home page dish grid cleanup. Read it and implement it fully.
2. `static/__dev/plans/customer-account-wallet.md` (this file): customer account hub, payment methods, Zipto Wallet, address book, veg mode.
3. `static/__dev/plans/email-otp-login.md`: email OTP for login and signup. Build it last. In the final message, remind the user to verify an email domain in the Email tab before publishing. Until that's done, OTP emails reach only the owner. Also fix the login page side panel copy, which says "₹5 platform fee / ₹5 bonus", to match current pricing (₹0 platform fee at launch; riders get base + distance pay + incentive).

## Summary
Give customers a proper account page with:
- **Food delivery** section: Your orders, Address book, Veg mode on/off.
- **Payments** section: Payment methods (every method enabled on Zipto's Razorpay account) and Zipto Wallet (top up once, pay for orders from the balance).
- **Settings**: "Allow calls from restaurant/rider" toggle. The column `users.allow_restaurant_calls` already exists, but the toggle was never built.

## Page / navigation
- New page **pages/account** (`/account`, CustomerRoute, AppShell layout). Customer nav in **components/AppShell** links "Account" (wallet balance chip) and keeps "My orders".
- Layout: a header card (name, email, wallet balance + "Add money"), then grouped menu cards:
  - **Food delivery** (expandable card/button group): Your orders → `/orders`; Address book → `/account/addresses`; Veg mode → Switch inline (saves instantly, green leaf badge when on).
  - **Payments**: Zipto Wallet → `/account/wallet`; Payment methods → `/account/payments`.
  - **Settings**: allow calls toggle; Support email; Terms; Logout.
- Sub-pages: `pages/account.addresses`, `pages/account.wallet`, `pages/account.payments` (same layout, back link to /account).
- Mobile-first: full-width cards, 48px tap targets.

## Payment methods
- **endpoints/payments/methods_GET**: calls Razorpay `GET https://api.razorpay.com/v1/methods` with Basic auth (RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET). Returns grouped, enabled methods: UPI (+ apps), Cards (networks: Visa, Mastercard, RuPay, Amex…), Netbanking (bank list count + top banks), Wallets (Paytm, PhonePe, Amazon Pay… as enabled), EMI, Pay Later. Cache the response in memory per Lambda for 1 hour. On failure, fall back to a static default list (UPI, Cards, Netbanking, Wallets) and log with console.error.
- **pages/account.payments**: shows each group with icons/badges, plus a "Zipto Wallet" card at the top with the balance. Note: "All payments are processed securely by Razorpay. Zipto never stores your card details."
- Checkout dialog in **pages/r.$restaurantId**: replace the single "Pay online" button with two choices: **Zipto Wallet** (shows balance; disabled with "Add ₹X" link if the balance is too low) and **Pay online** (UPI · Cards · Netbanking · Wallets · EMI · Pay Later).

## Zipto Wallet
Closed-loop wallet: usable only on Zipto, no withdrawal to bank, no transfers between users.

### Database (one migration)
- `wallet_txn_type` enum: `topup | order_payment | order_refund | admin_adjustment`.
- `wallet_txn_status` enum: `pending | success | failed`.
- `wallet_transactions`: `id serial PK`, `user_id → users.id`, `type`, `status`, `amount numeric(10,2)` (+ credit, − debit), `order_id int null → orders.id`, `razorpay_order_id text null UNIQUE`, `razorpay_payment_id text null UNIQUE`, `note text null`, `created_at`, `completed_at null`. Index `(user_id, created_at desc)`. Partial unique index on `(order_id, type)` where type in (order_payment, order_refund) for idempotency.
- `users.wallet_balance numeric(10,2) not null default 0` with `CHECK (wallet_balance >= 0)`.
- Add `'wallet'` to the orders `payment_method` enum. This goes in its own SQL call because it changes an enum.

### Rules
- Top-up amounts: ₹100 to ₹5,000 per top-up, with a maximum balance of ₹10,000. Quick chips: ₹200, ₹500, ₹1,000, ₹2,000.
- Top-up flow: **endpoints/wallet/topup_POST** creates a pending txn and a Razorpay order (notes: `{ kind: "wallet_topup", walletTxnId }`). The frontend opens Razorpay checkout using `helpers/loadRazorpayCheckout`. **endpoints/wallet/topup_verify_POST** verifies the signature and credits the wallet. The existing **helpers/processRazorpayWebhookEvent** also handles `payment.captured` for `wallet_topup` notes, as a fallback when the browser closes. Credit is idempotent: inside a transaction, flip the txn pending→success only once, then increment the balance.
- Paying with the wallet: **customer/place_order_POST** accepts `paymentMethod: "wallet"`. In one transaction: lock the user row (`FOR UPDATE`), check the balance ≥ the locked quote total, debit, insert an `order_payment` txn, and create the order with `paymentStatus = paid`. Then the usual notify flow runs, same as a successful online payment. Paying part from the wallet and part by Razorpay is not supported in v1: the full total comes from the wallet.
- Refunds: when a wallet-paid order is cancelled or rejected (customer/order_action, restaurant/rider/admin actions that refund today), credit the wallet instead of calling Razorpay refund. Insert an `order_refund` txn, idempotent through the unique index. Online-paid orders keep the current Razorpay refund flow.
- Ledger/payouts: a wallet-paid order counts as a paid online order for restaurant/rider payouts and the finance ledger. Check **helpers/financialLedger**, **helpers/orderPayments**, **helpers/createWeeklyPayouts**, and the admin finance figures wherever `paymentMethod === "upi"` is assumed, and treat `wallet` the same way.
- Admin: in **pages/admin**, add a total wallet balance figure (liability) to the finance view, plus a per-user `admin_adjustment` action with a mandatory note.
- **endpoints/wallet/summary_GET**: balance + the last 50 transactions. Hook `useWallet()` in **helpers/ziptoHooks**. Invalidate it via the customer realtime channel after a top-up, payment, or refund.
- **pages/account.wallet**: big balance card, "Add money" sheet with chips and a custom amount, transaction history (icon, label, order link, +/− amount, status). Text: "Wallet balance can be used only on Zipto and is non-withdrawable. Refunds for wallet orders come back to the wallet."
- **pages/terms**: add a "Zipto Wallet" section with the same rules.

## Address book
- Table `customer_addresses`: `id serial`, `user_id → users.id`, `label text` (Home/Work/Other), `address text`, `landmark text null`, `town text`, `lat/lng double null`, `phone text`, `is_default bool default false`, `created_at`. Allow only one default per user (partial unique index).
- **endpoints/customer/addresses_GET** and **endpoints/customer/address_action_POST** (actions `create | update | delete | set_default`; ownership checked; max 10 addresses).
- **pages/account.addresses**: list with edit/delete/default, plus an add/edit dialog with a "Use my location" button that fills lat/lng.
- Checkout dialog: an address picker at the top (default preselected) fills the phone, the address, and the coordinates used by the quote. Add a "Save this address" checkbox for new entries.

## Veg mode
- Column `users.veg_mode boolean default false`. Return it in the auth session user (**helpers/User**, session/login endpoints) so the frontend knows it immediately.
- **endpoints/customer/preferences_POST** `{ vegMode?, allowRestaurantCalls? }`. Update the auth state after saving.
- When on: the restaurant menu shows only veg items, with a "Veg mode on" banner and a quick toggle. On the home page, popular dishes are veg only, and restaurants with zero veg items are hidden. `restaurants_GET` gets a `vegOnly` param plus a veg item count. In the cart, non-veg items already added are flagged.
- A quick veg toggle in the AppShell header for customers. Logged-out visitors store veg mode in localStorage.

## Files to Modify (summary)
AppShell, pages/r.$restaurantId, pages/_index, pages/ordersContent (link to account), pages/terms, pages/admin + AdminFinanceDashboard, customer/place_order_POST (+schema), customer/order_action_POST, restaurant/action_POST, rider/action_POST, admin/action_POST (refund paths + wallet adjustment), processRazorpayWebhookEvent, orderPayments, financialLedger, createWeeklyPayouts, admin/finance_GET, restaurants_GET, auth/session_GET + login + User, ziptoHooks, realtime notify helper (notifyZipto), static/__dev/system-prompt.md (mention wallet + veg mode + account hub; payments = Razorpay online OR Zipto Wallet, still no COD), static/__dev/notes/payments-payouts-pro-activation.md (wallet rules).

## Risks & Considerations
- RBI: a closed-loop wallet (only for Zipto's own services, no cash-out) doesn't need a PPI licence, but keep it non-withdrawable and non-transferable. Add a question for the CA about the GST/accounting treatment of wallet balances (an advance, with tax applying at order time).
- Wallet money sits in Zipto's Razorpay settlement account. Admin finance should show the total wallet liability.
- Always lock the user row on debit to avoid double-spending from two tabs.
- Launch mode still blocks public customers, so test with an admin or test customer account in the preview. A real top-up uses live Razorpay keys, so test with ₹100.
