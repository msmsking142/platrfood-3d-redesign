---
created: 2026-10-15T16:23:27.002Z
updated: 2026-10-15T16:23:27.002Z
---

## Summary
Next reliability work after F1/F2/F3. Proposal only – each part needs owner approval. Launch mode and site pause stay on throughout.

## 1. Push notifications (Floot Push)
- Add the FLOOT_PUSH resource; store device subscriptions per user (web + native).
- Send pushes for: restaurant – new order; rider – new delivery offer nearby and assignment; customer – accepted / picked up / delivered / refund; incoming in-app call ("Zipto call from your rider").
- Opt-in prompt after login per role; settings toggle on /account, rider and partner pages.
- Needs a new Android/iOS build published from Floot; test on 2 real phones (app closed, screen locked).

## 2. TURN-based calling
- Add a GENERIC resource for a TURN provider (e.g. Cloudflare Realtime TURN or Metered); backend endpoint issues short-lived TURN credentials to authenticated call participants only.
- CallProvider uses STUN + TURN (udp/tcp/tls 443) iceServers; add ICE-failure retry and a "Connecting…/Poor network" state.
- Combine with push so a callee whose app is closed gets a ring notification.
- Test: Jio ↔ Airtel ↔ Wi‑Fi on real phones; confirm no phone numbers are exchanged.

## 3. Background rider tracking
- Native app: Capacitor background-geolocation plugin with an Android foreground-service notification ("Zipto is sharing your location for order #…"), only while the rider has an active order; stops on delivery.
- Throttle to ~15–30 s / 50 m; reuse rider/location_POST (unchanged shape).
- Web/PWA fallback: keep the screen-awake wake lock and the new stale-location warning.
- Requires Play Store background-location declaration + privacy policy wording; new native build.

## 4. Safe expiry jobs (only after F1/F2 verified with one real payment)
- Scheduled job every 15 min: pending wallet top-ups > 2 h old and unpaid online orders > 30 min old.
- Before expiring, read Razorpay payments for the order (GET only). Captured → run it through paymentReconciliation (credit/accept or refund) instead of expiring. Authorized → skip until resolved. None → mark failed / cancel order with reason "Payment not completed" and email customer.
- Never touch customer balances directly; all money movement via existing helpers.

## Files to Modify / Create
Determined per part at build time (CallProvider, call endpoints, useRiderLocationSharing, scheduled-jobs.json, new push helpers/endpoints).

## Risks & Considerations
- Push, background location and calls on locked phones all need a new native build and real-phone testing.
- Background location adds Play Store review requirements.
- Expiry must never cancel an order whose payment is captured but not yet reconciled.
