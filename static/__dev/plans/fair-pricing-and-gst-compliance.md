---
created: 2026-10-14T06:06:13.631Z
updated: 2026-10-14T06:06:13.631Z
---

# Fair pricing + GST compliance plan

## Summary
Change the price settings so that: (1) customers still pay much less than on big platforms, (2) Zipto earns on every order, including Pro orders, and (3) every tax goes to the government correctly under current law (GST Section 9(5), and Income-tax TDS u/s 393(1) of the Income-tax Act 2025, which replaced 194-O from 1 Apr 2026).

### The key idea (easy version)
- **The delivery fee pays the rider, rupee for rupee.** The customer's delivery fee now equals the rider's pay (₹25 for the first 2 km + ₹6 per extra km). Zipto stops losing ₹3–7 on every delivery.
- **The commission is Zipto's income.** Basic 12% and Pro 4% stay as they are, and are still far below the "25%+" many big platforms charge.
- **Platform fee stays ₹0 at launch**, so the "No platform fee at launch" message stays true. Later, the admin can turn on a small ₹3 platform fee (big platforms charge about ₹10–15).
- **Menu price stays the same as in the restaurant.** No markup, which is the biggest saving for customers.

### New customer delivery fee (rider pay unchanged: ₹20 base for first 2 km + ₹6/km + ₹5 incentive)
| Distance | Old customer fee | New customer fee | Rider gets |
|---|---|---|---|
| up to 2 km | ₹20 | ₹25 | ₹25 |
| 2–3 km | ₹30 | ₹31 | ₹31 |
| 3–4 km | ₹30 | ₹37 | ₹37 |
| 4–5 km | ₹40 | ₹43 | ₹43 |
| 5–6 km | ₹40 | ₹49 | ₹49 |
| after 6 km | +₹8/km | +₹7/km | +₹6/km |
| maximum | ₹80 | ₹80 | — |

### What Zipto keeps per order (after rider pay and the ~2.36% Razorpay fee; GST goes to the government separately)
| Order | Customer pays (old → new) | Zipto keeps (old → new) |
|---|---|---|
| ₹400, Basic, 3.5 km | ₹455 → ₹464 | ₹30 → **₹37** |
| ₹200, Basic, 1.5 km | ₹234 → ₹240 | ₹13 → **₹18** |
| ₹400, Pro, 3.5 km | ₹455 → ₹464 | –₹2 → **₹5** |
| ₹150, Pro, 1.5 km | — → ₹188 | –₹3 → **₹2** |
Plus ₹2,499 per 30 days from each Pro restaurant.

### Taxes after this plan (who pays, who deposits)
| Tax | Rate | Paid by | Deposited by |
|---|---|---|---|
| GST on food (Sec 9(5)) | 5% | Customer | Zipto (restaurant does NOT charge it again) |
| GST on delivery fee (Sec 9(5), since 22 Sep 2025) | 18% | Customer | Zipto |
| GST on platform fee | 18% | Customer | Zipto (₹0 while fee is ₹0) |
| GST on commission | 18% | Restaurant | Zipto |
| Income-tax TDS u/s 393(1) (earlier 194-O) | 0.1% of food sales (5% if restaurant has no PAN) | Restaurant (deducted from payout) | Zipto |
| GST TCS 0.5% | Not applicable (food under 9(5)) | — | — |
| Rider pay | No GST (unregistered individuals) | — | — |

## Files to Modify
- **Database `app_settings` (data update):** delivery slabs `[2→25, 3→31, 4→37, 5→43, 6→49]`, `delivery_min_fee=25`, `delivery_per_km_beyond=7`, `delivery_max_fee=80`. Keep `platform_fee=0`, `small_order_fee=0`, commissions 12%/4%, rider pay as now.
- **Database schema (new columns):**
  - `app_settings.zipto_gstin` (text, nullable): Zipto's GSTIN, shown on bills once set.
  - `app_settings.restaurant_no_pan_withholding_bps` (int, default 500): 5% TDS when a restaurant has no PAN.
  - `restaurants.pan` (text, nullable): restaurant/owner PAN, required for 0.1% TDS.
  - `restaurant_payouts.tds_amount` (int, default 0): TDS deducted on the weekly batch.
- **helpers/deliveryPricing:** stop rounding TDS per order (which makes it ₹0 on orders under ₹500). Per-order `withholding` becomes 0 in the quote. TDS is calculated on the weekly payout instead. Update tests.
- **helpers/createWeeklyPayouts (+ payoutWorkflow/financialLedger as needed):** for each restaurant batch, TDS = round(total food sales × 0.1%), or × 5% if no PAN. Save it in `tds_amount`, subtract it from the payout amount, and write a ledger entry (note "Income-tax TDS u/s 393(1)").
- **helpers/pricingSettings, endpoints/settings_GET, endpoints/admin/action_POST, helpers/adminPricingActionSchemas:** load and save `ziptoGstin` and `restaurantNoPanWithholdingBps`.
- **components/AdminPricingSettings:** rename the label "TDS u/s 194-O %" to "Income-tax TDS u/s 393(1) % (earlier 194-O)". Add a "No-PAN TDS %" field and a "Zipto GSTIN" field. Update the guidance box text. Show a small "Zipto keeps per order" preview using the engine's existing economics.
- **components/RestaurantSettlement, components/MerchantFinance:** rename "TCS/TDS withholding" to "Income-tax TDS (0.1%)" and show TDS per weekly payout instead of per order.
- **components/MerchantPayoutAccount (+ restaurant/action_POST, restaurant/dashboard_GET):** add a PAN field (format check ABCDE1234F, masked in display). Explain: "Without PAN, 5% TDS applies by law."
- **components/CustomerQuoteBill, components/CustomerOrderBill:** show "GSTIN: …" for Zipto when set. Keep the existing GST lines.
- **components/AdminFinanceDashboard (+ admin/finance_GET):** add a **Monthly tax summary**: food GST 5%, delivery/platform GST 18%, commission GST 18%, TDS deducted per restaurant (with PAN). This is for the CA to file GST returns and TDS returns.
- **pages/terms:** replace 194-O with Section 393(1), Income-tax Act 2025 (earlier 194-O). Add the 5% no-PAN rule. Delivery fee "starts at ₹25 and covers rider pay".
- **pages/_index, components/MerchantOnboarding, rider help copy:** delivery "from ₹…" already comes from settings. Add the line "Delivery fee goes to the rider" where it fits. No competitor names.
- **static/__dev/system-prompt.md + notes/pricing-ledger-payouts.md:** delivery starts at ₹25 and mirrors rider pay. TDS u/s 393(1) on weekly batch, 5% without PAN. GSTIN setting.

## Files to Create
- None. Only schema columns are added.

## Approach
1. Run one schema migration (4 columns), then update the `app_settings` values.
2. Update the pricing engine and tests (TDS moves to payout level).
3. Update weekly payout creation and the ledger for batch TDS.
4. Settings plumbing: settings_GET, admin action, admin pricing UI.
5. Restaurant PAN capture and display.
6. Bills show GSTIN. Restaurant settlement labels.
7. Monthly tax summary in admin finance.
8. Terms, copy, system prompt, notes.
9. Verify: quote for 1.5 / 3.5 / 8 km gives fees 25 / 37 / 63. Zipto contribution is positive for Basic and Pro. A payout batch deducts TDS correctly with and without PAN.

## Risks & Considerations
- **Customer pays ₹1–9 more on delivery** than now, but the menu price has no markup and the platform fee is ₹0, so the total stays well below typical big-platform totals. The app never claims "cheapest" and never names competitors.
- Old orders keep their saved price snapshot. Only new quotes change.
- Existing restaurants have no PAN yet. Payouts will use 5% TDS until they add one, so show a clear banner asking for PAN before the first payout.
- The Razorpay fee is an estimate (2.36%). UPI can be cheaper, so the real margin can be higher. GST on the Razorpay fee is claimable as input credit by Zipto.
- GST is rounded to whole rupees per order. Have the CA confirm whether invoices must show paise.
- **CA confirmation is still required** for: GSTIN registration as an e-commerce operator, Section 9(5) filings, and TDS return filing.
- Everything stays editable from Admin → Pricing settings. A ₹3 platform fee or a small-order fee can be switched on later without code changes.
