---
created: 2026-10-13T15:34:56.714Z
updated: 2026-10-13T15:34:56.714Z
---

## Summary
Let the founder look at the Rider dashboard in the Floot editor **without logging in**, and without removing the real login protection on `/rider`. We'll add a dev-only **page example** (`pages/rider.__example.tsx`). It renders the real `/rider` page (AppShell, RiderRoute, RiderDashboard and every section) against sample data instead of the live backend. It never ships to the published app, so real riders and security aren't affected.

## Files to Create
- `pages/rider.__example.tsx`: `defineScreens` from `@floot/examples` with fixture responses:
  - Shared backend for all screens: `auth/session_GET` returns a logged-in rider user (role `rider`, name e.g. "Rahul Negi"), plus `settings_GET` and any other endpoint that AppShell or the global providers call (check them while building).
  - `realtime: {}` so the screens don't connect to the live realtime service.
  - Screens (each with sample `rider/dashboard_GET` data typed with `OutputType`, using sample `OrderView` orders from Rudrapur):
    1. **Approved – Online, new orders**: rider approved and online, 2–3 available orders, 1 active order (accepted), filled-in stats and daily earnings chart data.
    2. **Approved – Offline**: same rider, but offline with no available orders.
    3. **Verification pending**: status `pending`, documents submitted, awaiting review.
    4. **Verification rejected**: status `rejected` with a review note.
    5. **New rider (onboarding)**: `rider: null`, which shows the RiderOnboarding form.
    6. **Loading**: `rider/dashboard_GET: pending`.
    7. **Load failed**: `httpError(500)`.
  - Rider-action endpoints (`rider/action_POST`, `rider/location_POST`, `rider/document_upload_POST`) get simple success fixtures so clicking toggles and buttons doesn't crash.
  - Sections (Orders, History, Earnings, Verification, Profile, Help) can be reached from the sidebar inside each screen, or opened directly with routes like `/rider?section=earnings`.

## Files to Modify
- None. The live `/rider` page stays login-protected.

## Approach
1. Read `helpers/orderView`, `helpers/useAuth`/`User`, `components/AppShell`, `_globalContextProviders` and `helpers/ziptoHooks` to find every endpoint the rider page calls.
2. Write typed fixtures for each one, importing `OutputType` from each endpoint's schema.
3. Create the screens listed above.
4. Tell the user how to open it: go to the `rider` page in the editor, then open its Screens/Examples view.

## Risks & Considerations
- This is a preview with **sample data**. Real orders, real realtime alerts and live location won't be live there.
- To test the real flow end to end, the founder would still need a real rider account (register at /login → Rider).
- An endpoint without a fixture shows a visible error naming it. If that happens, add the missing fixture.
