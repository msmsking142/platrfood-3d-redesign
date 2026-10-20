# Maps and isolated launch testing

## Google Maps

- `GOOGLE_MAPS_API_KEY` is connected **server-side only**. `helpers/googleMaps` provides Routes `computeRoutes`, Places autocomplete with a Uttarakhand bounding box and session tokens, place details, and reverse Geocoding.
- Road distances are cached for 30 days in `route_distance_cache`, keyed by restaurant and origin/destination coordinates rounded to ×10⁴.
- **Both** `customer/quote_POST` and `place_order_POST` use `helpers/resolveDeliveryDistance`. Keep their distance and pricing decisions identical; otherwise placement can return `PRICE_CHANGED` (409). Road distance reports `DistanceSource: "gps"` for older native clients. If routing fails, use straight-line distance × `roadFactor` and report `"estimated"`.
- `components/AddressSearch` is used inside `LocationPinPicker` and `AddressFields`; it hides itself when the service returns 503.
- Map tiles remain on free OpenStreetMap tiles.

## Isolated launch testing

**Preview and production share a database, and Razorpay keys are live.** Use only identifiable temporary records; do not make live Razorpay payments for a test.

- Create temporary users with `zipto-test-*@mail.ziptofood.online` addresses, `otp_exempt=true`, and town `ZiptoTest`. The inbound-email handler ignores senders at `@mail.ziptofood.online`, avoiding bounces and support tickets.
- Launch mode blocks `place_order` for non-admin users. Use an `admin`-role test customer when testing order placement in launch mode.
- Pay with the wallet, funded through an `admin_adjustment` credit.
- Clean up **only records belonging to the test** and their dependent records, in this order: `email_notifications`, `ledger_entries`, `rider_earnings`, `wallet_transactions` → `orders` → `riders`/`restaurants` → `users` → `login_attempts`. Verify ownership before deletion; the database is shared.
- `runCodeInBrowser` logins replace the user's preview session cookie. Tell the user to log in again afterward.
- Admin → Finance provides read-only Razorpay reconciliation through `admin/payment_reconcile_GET`.

## Customer live tracking (2026-10)

- Customer tracker: `components/CustomerOrderTracker`, `components/CustomerOrderTimeline`, and `helpers/customerTrackingDisplay`. Its map is `components/LiveTrackingMap`, using Google Maps JavaScript with the public-config browser key `GOOGLE_MAPS_BROWSER_KEY`. With no map ID, use JSON `styles`. Loading lives in `helpers/googleTrackingMaps`; geometry lives in `helpers/trackingMapGeometry`. On load or authorization failure, fall back to Leaflet `RiderLiveMap`. Rider and merchant screens continue using `RiderLiveMap` (OSM).
- Route and ETA: `endpoints/customer/order_route_POST` permits only the order owner or an admin; return 404 otherwise. It calls `helpers/liveOrderRoute`, which uses Google Routes `computeRoutes` with `DRIVE` and `TRAFFIC_UNAWARE` (Essentials SKU). Store one row per order in `order_route_cache`: reuse a result under 90 seconds old, or under 10 minutes old if the rider moved less than 250 m; after a failure, do not retry for 5 minutes. If rider GPS is more than 120 seconds old, skip Google and return stale status. Frontend `helpers/useOrderLiveRoute` refetches only on a new GPS ping and when at least 60 seconds have elapsed since the last fetch; do not poll.
- `GOOGLE_MAPS_API_KEY` is a server key and must **not** have website/referrer restrictions: server calls have no referer and otherwise receive 403, `"Requests from referer <empty> are blocked"` (observed 2026-10-16). This also breaks pricing road distance, causing fallback to estimated distance. Keep the separate browser key restricted by referrer to the Maps JavaScript API.
- Backend logs for requests triggered by `runCodeInBrowser` do not appear in debug info. To diagnose provider errors, temporarily persist a sanitized error, then revert that diagnostic change.