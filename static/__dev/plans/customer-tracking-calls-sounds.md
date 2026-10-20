---
created: 2026-10-14T09:43:14.019Z
updated: 2026-10-14T09:43:14.019Z
---

## Summary
Audit of the customer side (home page, restaurant page, My orders):

| Area | Current state | Gap |
|---|---|---|
| Restaurants on home page | Town picker, popular dishes, restaurant cards with open/closed state, skeletons. Hidden from the public while launch mode is on (expected). | "Popular dishes" grid uses hard-coded inline colours (breaks dark mode, no hover, broken image if dish has no photo). |
| Google Maps | Restaurant page has a Google Maps embed + "Open in Google Maps". My orders has a "View delivery route" text link. | No in-app map for the customer's live order. |
| Tracking | Status pill only; list refreshes via realtime **plus a 15-second polling interval**. | No live rider position, no step-by-step progress, no rider name/ETA. Rider location stops being shared after pickup and is only sent to the restaurant — so the customer can't see the rider during the actual delivery. |
| Sounds | None for customers (sounds exist only for merchant/rider). | No sound/vibration when order is accepted, picked up, or delivered. |
| Call rider | Calls exist only restaurant → rider/customer. | Customer has no "Call rider" button; `call/start` rejects customers. |

This plan fixes all gaps, keeping phone numbers private (in-app calls only) and using the existing free OpenStreetMap/Leaflet map already used on the merchant side.

## Files to Modify
- **helpers/orderView** + **helpers/orderQueries**: add `deliveryLat`, `deliveryLng`, `restaurantLat`, `restaurantLng`, `riderVehicleType` to the order view. For customer queries, blank `riderPhone` and `restaurantPhone` (privacy, same rule as merchants).
- **helpers/realtimeChannels**: add `orderLive(orderId)` → `"orderlive:<id>"` for rider pings to the customer.
- **endpoints/_realtime/token_POST**: grant customers `orderLive(id)` for their own active orders (status accepted → picked_up); admin gets `orderlive:*`.
- **endpoints/rider/location_POST**: also include `picked_up` orders; publish `rider_location` to `orderLive(order.id)` for every active order (restaurant channel unchanged, still pre-pickup only).
- **components/RiderDashboard**: keep location sharing on while the rider has an accepted/preparing/ready/**picked_up** order (currently stops at pickup).
- **endpoints/call/start_POST**: allow role `user` (customer) to call the assigned rider of their own active order (`accepted`…`picked_up`, rider assigned). Also allow rider → customer (only if customer `allowRestaurantCalls`… reuse flag renamed in copy as "allow calls"). Caller name = customer display name / rider name. Rest of the flow (calls table, callInbox) unchanged.
- **helpers/ziptoHooks** `useCustomerOrders`: remove the 15-second `refetchInterval` (realtime invalidation + resync already cover it).
- **pages/ordersContent**: for active orders render the new tracking card (below); keep bill, pay now, cancel. Replace `window.confirm` with a Dialog.
- **pages/_index** + **_index.module.css**: move popular-dish inline styles into CSS module classes using theme variables; show a placeholder cover when a dish has no image; hover lift like restaurant cards.
- **components/RiderOrders** (rider side): add "Call customer" button on picked-up orders when customer allows calls (uses existing `useCall`).

## Files to Create
- **components/CustomerOrderTracker**: card for one active order:
  - Step progress: Placed → Accepted → Preparing → Ready → On the way → Delivered (current step highlighted, Hinglish labels).
  - Rider block once assigned: name, vehicle, "Call rider" button (in-app, `useCall().startCall(orderId, "rider")`), disabled while a call is active.
  - Live map (Leaflet/OSM): restaurant pin, home pin (delivery lat/lng if known), rider pin updated live; "updated Xs ago", distance + rough ETA to restaurant before pickup / to customer after pickup. Falls back to "Waiting for rider location…" and keeps the "Open route in Google Maps" link.
- **helpers/useCustomerRiderLocation**: subscribes to `orderLive(orderId)`, seeds from `riderLat/Lng/LocationAt` in the order, returns latest position.
- **helpers/useCustomerOrderAlerts**: watches status changes of the customer's orders and plays a short chime + vibration + toast on accepted, picked up ("Rider on the way 🛵"), delivered, rejected/cancelled. Uses `ziptoSound` (add `playStatusChime()` there). Skips first load so it only fires on real changes.
- Generalise **components/RiderLiveMap** (rather than a new map) to accept an optional destination pin and a "distance to" target, so merchant and customer share one map component.

## Approach
1. Backend data: extend order view/queries, add channel + token grants, extend rider location publish, open `call/start` to customers (rider target) and riders (customer target) with ownership checks.
2. Rider app: keep sharing location until delivered; add "Call customer".
3. Customer UI: tracker component, live location hook, alerts hook, wire into My orders; remove polling.
4. Home page dish grid clean-up.
5. Verify with runCodeInBrowser: customer call/start auth checks (own order only, rider assigned), token grants, location publish; then ask the user to test a full order on two devices (customer + rider).

## Risks & Considerations
- Calls use Google STUN only (no TURN): on some mobile networks calls may fail to connect. A TURN provider can be added later.
- The other person must have Zipto open to receive a call (no push for calls yet).
- Browsers block sound until the user taps the page once; the chime uses the existing unlock-on-tap helper. Vibration doesn't work on iPhone Safari.
- Customer delivery pin is only exact if the customer used "Use my location" at checkout; otherwise the map shows rider + restaurant only.
- Hiding `riderPhone` from customers is a change — all contact goes through in-app calls.
- Launch mode: customers can't order publicly yet, so test with an admin/test customer in preview.
