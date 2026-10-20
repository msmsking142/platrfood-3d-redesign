# platr™ – Price Engine & Tax Treatment (for CA review)

> **Status: NOT launch-ready — remaining blockers: CA validation of all [CA-PENDING] items (including the planned free Pro introductory period), GSTIN entry, the order #12 refund check, completion of the Pro introductory offer with disclosed terms and restaurant consent, and one live end-to-end test per plan. No tax rate here is legally confirmed.**

**Business:** Online food delivery e-commerce operator (ECO) in Uttarakhand, operating as platr™ ([www.platrfood.co.in](https://www.platrfood.co.in)).  
**Legal entity / GSTIN:** Pending; GSTIN has not yet been entered in settings.  
**Payments:** Online only, via Razorpay or the closed-loop platr Wallet. No cash on delivery.

All tax calculations below illustrate current app settings; **[CA-PENDING]** marks rates, treatments and tax-dependent calculations requiring CA validation.

## 1. Approved commercial terms

| Term | Current setting |
|---|---|
| Basic restaurant plan | ₹0/month; 15% commission on food after restaurant-funded discounts. |
| Pro restaurant plan | ₹2,499 + GST **[CA-PENDING: 18%]** = ₹2,949 per 30 days, with no auto-debit; 8% commission on food after restaurant-funded discounts. |
| Customer platform fee | ₹0, shown on the bill. |
| Restaurant charges | No gateway fee, joining fee or penalties. |

**Pro introductory offer (not yet live):** Eligible new restaurants will receive their first 30 days of Pro with a ₹0 subscription and 8% commission. Renewal costs ₹2,499 + GST per 30 days only with disclosed terms and restaurant consent; there is no auto-charge. The CA must confirm the GST treatment of the free period **[CA-PENDING]**.

## 2. Delivery fee and rider pay

**One rider-pay formula:** ₹20 base covering the first 2 km + ₹6 for each started kilometre after 2 km (rounded up) + ₹5 per-order incentive. The peak incentive is currently ₹0. At 2 km, rider pay is **₹25 = ₹20 + ₹0 + ₹5**. A “₹37 at 2 km” reading incorrectly applies ₹6/km to the first 2 km; the app does **not** do that.

Following the founder’s 2026 decision, the customer delivery fee equals rider pay at every distance:

| Distance | Customer delivery fee | Rider pay |
|---|---:|---:|
| 0–2.000 km | ₹25 | ₹25 |
| 2.001–3 km | ₹31 | ₹31 |
| 3.001–4 km | ₹37 | ₹37 |
| 4.001–5 km | ₹43 | ₹43 |
| 5.001–6 km | ₹49 | ₹49 |
| 6.001–7 km | ₹55 | ₹55 |
| 7.001–8 km | ₹61 | ₹61 |
| 8.001–9 km | ₹67 | ₹67 |
| 9.001–10 km | ₹73 | ₹73 |

A distance one metre over a boundary enters the next slab for both fees. The maximum delivery radius is 10 km and the customer delivery-fee cap is ₹80. Pricing uses Google road distance when available; otherwise straight-line distance × 1.3; if location is missing, it uses a 3 km estimate.

**Founder decision applied in 2026:** Beyond 6 km, the customer fee rises ₹6 per started kilometre, matching rider pay. There is no delivery spread from the distance rate.

## 3. Worked calculations and reconciliation

These examples use current settings. Amounts are rounded **per line, per order, to whole rupees, with halves rounded up**. Each GST calculation and its rounding remain **[CA-PENDING]**. The full customer total is shown and locked before payment; a price change requires customer reconfirmation.

| Example | Food | Food GST **[CA-PENDING]** | Delivery fee | Delivery GST **[CA-PENDING]** | Platform fee | Customer total | Rider pay |
|---|---:|---|---:|---|---:|---:|---|
| **A — ₹400 at 3.5 km** | ₹400 | 5% of ₹400 = ₹20.00 → **₹20 [CA-PENDING]** | ₹37 (≤4 km) | 18% of ₹37 = ₹6.66 → **₹7 [CA-PENDING]** | ₹0 | **₹464** (400 + 20 + 37 + 7) | **₹37** (20 + 12 + 5) |
| **B — ₹150 at 2 km** | ₹150 | 5% of ₹150 = ₹7.50 → **₹8 [CA-PENDING]** | ₹25 | 18% of ₹25 = ₹4.50 → **₹5 [CA-PENDING]** | ₹0 | **₹188** (150 + 8 + 25 + 5) | **₹25** (20 + 0 + 5) |
| **C — ₹300 at 8 km** | ₹300 | 5% of ₹300 = ₹15.00 → **₹15 [CA-PENDING]** | ₹61 (49 + 2 × 6) | 18% of ₹61 = ₹10.98 → **₹11 [CA-PENDING]** | ₹0 | **₹387** (300 + 15 + 61 + 11) | **₹61** (20 + 36 + 5) |

The previously quoted ₹389 for example C used the old ₹7/km rate beyond 6 km.

**Example B rounding issue [CA-PENDING]:** Exact food and delivery GST under the illustrated rates totals ₹12.00, but separate whole-rupee rounding collects ₹13 (+₹1). Any tax collected must be remitted in full; the CA must confirm whether paise-level GST is required instead.

Restaurant net is food sales less commission and rounded GST on commission **[CA-PENDING]**, before weekly TDS **[CA-PENDING]** and any other payout adjustments:

| Example | Basic: commission | Basic: GST on commission **[CA-PENDING]** | Basic: net | Pro: commission | Pro: GST on commission **[CA-PENDING]** | Pro: net |
|---|---:|---|---:|---:|---|---:|
| A | ₹60 | ₹10.80 → ₹11 **[CA-PENDING]** | **₹329** | ₹32 | ₹5.76 → ₹6 **[CA-PENDING]** | **₹362** |
| B | ₹22.50 → ₹23 | ₹4.14 → ₹4 **[CA-PENDING]** | **₹123** | ₹12 | ₹2.16 → ₹2 **[CA-PENDING]** | **₹136** |
| C | ₹45 | ₹8.10 → ₹8 **[CA-PENDING]** | **₹247** | ₹24 | ₹4.32 → ₹4 **[CA-PENDING]** | **₹272** |

Gateway costs below are estimates: approximately 2.36% of the customer total, comprising a 2% gateway fee plus 18% GST on that fee **[CA-PENDING]**, borne by platr. Contribution excludes other operating costs, tax-credit effects and Pro subscription revenue.

| Example | Estimated gateway cost | Basic contribution | Pro contribution |
|---|---:|---:|---:|
| A | ₹11 | **₹49** | **₹21** |
| B | ₹4 | **₹19** | **₹8** |
| C | ₹9 | **₹36** | **₹15** |

**Contribution = commission + delivery fee − rider pay − gateway cost.** Example C has no delivery spread. Food GST, delivery GST and commission GST **[CA-PENDING]** are excluded from revenue.

**Tested reconciliation identity, using current tax settings [CA-PENDING]:** Customer total = restaurant net + commission + GST on commission **[CA-PENDING]** + food GST **[CA-PENDING]** + delivery fee + delivery GST **[CA-PENDING]**. The ₹0 platform-fee line is always shown; there is no hidden platform fee. Automated tests and a check of all stored orders found **0 orders with a non-zero platform fee**; all stored totals, payouts and rider pay recompute exactly.

## 4. Tax treatment and accounting separation

**Every item in this section requires CA validation [CA-PENDING].**

| Item | Current treatment or question |
|---|---|
| Food GST **[CA-PENDING]** | 5%, collected and paid by platr as ECO under section 9(5) of the CGST Act; no TCS **[CA-PENDING]**. Confirm both positions. |
| Delivery-fee GST **[CA-PENDING]** | 18% **[CA-PENDING]**. Confirm whether delivery through an ECO falls under section 9(5), the effect of the 2025 GST Council change on local delivery, and the correct rate. |
| Commission and Pro subscription GST **[CA-PENDING]** | 18% **[CA-PENDING]** on each; confirm treatment and applicable SAC codes, including GST treatment of the planned ₹0 first 30 days of Pro. |
| Rider onboarding-fee GST **[CA-PENDING]** | 18% **[CA-PENDING]**; confirm treatment and rate. |
| Restaurant income-tax TDS **[CA-PENDING]** | Under section 393(1) of the Income-tax Act, 2025 (earlier section 194-O): 0.1% of gross food sales per weekly payout batch, or 5% without a valid PAN **[CA-PENDING]**. Current batch-level rounding is to the nearest rupee: ₹850 × 0.1% = ₹0.85 → ₹1; a batch containing only a ₹400 order gives ₹0.40 → ₹0 **[CA-PENDING]**. Confirm the base, including whether it includes GST **[CA-PENDING]**, rounding, TAN, Form 26Q and Form 16A. |
| Rider TDS **[CA-PENDING]** | Confirm section 194C obligations and social-security treatment. |
| Adjustments and documentation **[CA-PENDING]** | Confirm GST treatment of restaurant delivery-failure compensation and rider cancellation pay; credit notes for refunds and cancellations; input tax credit on Razorpay fees; and invoice numbering for customer bills and restaurant commission invoices. |
| Wallet **[CA-PENDING]** | Confirm treatment of top-ups and unused balances as advances or vouchers, and treatment on redemption. |
| Tax invoices **[CA-PENDING]** | GSTIN is not yet entered in settings. It must be added before bills can be compliant tax invoices; confirm invoice format. |

**Ledger separation under current settings [CA-PENDING]:** Each order records food GST + delivery GST + commission GST in a separate `tax_collected` entry **[CA-PENDING]**, apart from `platform_commission` and `delivery_revenue`. Restaurant TDS **[CA-PENDING]** is a separate payout adjustment. Pro subscriptions store `base_amount` and `gst_amount` separately **[CA-PENDING]**.

## 5. Rider onboarding fee

The one-time fee is **₹199 base + 18% GST [CA-PENDING] = ₹35.82 → ₹234.82**. In paise, the calculation is **19,900 + 3,582 = 23,482 paise** **[CA-PENDING: GST amount and treatment]**.

Payment occurs after rider registration and before training, document upload and verification. The fee is shown at registration and again as a base/GST **[CA-PENDING]**/total breakdown at payment. The rider must tick an acknowledgement checkbox stating that the fee is non-refundable and referring to the Terms before the pay button is enabled. The Terms include a “Rider onboarding fee” section.

The fee is non-refundable once paid, including if the rider is not approved. Duplicate payments for the same rider are blocked from being applied twice and flagged for support review/refund. **Configuration coupling:** Onboarding-fee GST currently reuses the commission GST setting **[CA-PENDING]**; changing that setting changes both rates.

## 6. Money flow and reconciliation results

**Live-data check, 2026:** For Basic and Pro orders, payment capture creates a `customer_payment` ledger entry and records the actual Razorpay fee from the webhook. On delivery, the ledger records `restaurant_payable` (net), `rider_payable`, `platform_commission`, `delivery_revenue` and `tax_collected` **[CA-PENDING: tax treatment]**. The Friday restaurant payout batch applies TDS **[CA-PENDING]**, approved food-complaint deductions (50% of food value) and eligible delivery-failure compensation. Admin approval precedes the manual UTR and paid status. Customers may make at most three approved food-refund complaints.

Rider earnings are held for 24 hours and paid weekly after admin approval. Riders are treated as independent contractors; restaurant commission and gateway fees never reduce rider pay.

| Event | Current money flow |
|---|---|
| Cancellation before rider acceptance | Full customer refund; rider ₹0. |
| Cancellation after acceptance, before pickup | Customer refund; rider ₹10, paid by platr. |
| Cancellation after pickup | Customer refund; full rider pay. |
| Delivery failure when food was ready on time but no rider was found | 100% customer refund; restaurant compensation of 40% of food value, minimum ₹30 and maximum ₹300, without commission. |

A full refund is the order total returned to the original payment method; wallet-paid orders return to the wallet. Razorpay does not return its gateway fee on refund, so platr bears that cost.

The wallet is closed-loop, non-withdrawable and non-transferable. Top-ups range from ₹100 to ₹5,000; maximum balance is ₹10,000. An order must be paid entirely from the wallet, without split payment. Stored wallet balances reconcile: **₹200 summed balances = ₹200 summed successful wallet transactions; 0 mismatched users**. The database check covered **3 test orders**, all of which recompute exactly.

**Findings requiring action:**

- **F1 — Order #12:** The ₹155 online order was cancelled by admin cleanup but remains marked paid with no refund recorded. Check the Razorpay dashboard; if it was not refunded, refund it.
- **F2 — Resolved:** Old Pro payment orders #1 and #2, created at ₹2,499 without GST **[CA-PENDING]** and never paid, were marked `failed`.
- **F3 — Order #25:** ₹48 restaurant compensation is pending and will be added to the next Friday payout.
- **F4 — Resolved:** The founder approved ₹6/km beyond 6 km; customer delivery fees now match rider pay.
- **F5 — GSTIN:** Enter it in settings; confirm tax-invoice requirements **[CA-PENDING]**.

No restaurant or rider payouts have run yet. A complete payout cycle with real money remains untested end-to-end; run one controlled live test order per plan before launch.

## 7. Automated tests

`helpers/deliveryPricing.spec.tsx` includes a **“production pricing audit”** covering the worked examples, GST half-up rounding **[CA-PENDING]**, absence of a hidden platform fee, distance boundaries from 0–10 km, the settlement identity using current tax settings **[CA-PENDING]**, cancellation pay and payout TDS rounding **[CA-PENDING]**. All tests pass. Passing tests verify implementation against current settings, not legal tax correctness.

## 8. Launch-readiness checklist

- [x] Founder-approved ₹6/km rate beyond 6 km is applied.
- [ ] CA signs off on every **[CA-PENDING]** item, including tax rates, treatments, rounding and invoices.
- [ ] GSTIN is entered in settings.
- [ ] Order #12 refund status is resolved.
- [x] Stale Pro payment orders #1 and #2 are marked `failed`.
- [ ] Complete the new Pro introductory offer with disclosed renewal terms and restaurant consent; obtain CA sign-off on free-period GST **[CA-PENDING]**.
- [ ] One controlled live end-to-end test per plan is completed, including refund and payout.

See **ca-gst-tds-checklist.md** for the detailed CA questions. Change admin-editable tax settings only after CA sign-off.