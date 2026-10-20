---
created: 2026-10-14T06:51:39.791Z
updated: 2026-10-14T06:51:39.791Z
---

## Summary
Make the Pro subscription **₹2,499 + 18% GST (₹2,949 total)** instead of a flat ₹2,499 with GST hidden inside it. Commission stays the same: Basic 12%, Pro 4%. Platform fee stays ₹0 at launch, and a numbered tax invoice is deferred until the CA confirms the format.

**Why:** at the moment Zipto has to pay ₹381 of GST out of every ₹2,499 Pro payment, so it keeps only ₹2,118. After this change, Zipto keeps the full ₹2,499. The restaurant pays the ₹450 GST, which it can claim back as input tax credit if it is GST-registered.

**What stays the same:**
- The price engine and the customer bill.
- The delivery fee, which matches rider pay.
- The tax rates in the settings, including the delivery GST setting, so it can be changed to 5% if the CA confirms that rate.

## Files to Modify
- **endpoints/restaurant/pro_order_POST:** charge amount = proMonthlyFee + round(proMonthlyFee × commissionGstBps / 10000), currently 2,499 + 450 = ₹2,949. Store the base and the GST separately on the payment row.
- **endpoints/restaurant/pro_verify_POST, helpers/razorpayProPayment, helpers/proSubscription, helpers/processRazorpayWebhookEvent (Pro branch):** verify against the stored total (base + GST) rather than recalculating ₹2,499. Payments already made at ₹2,499 stay valid, including the held pre-launch payments.
- **endpoints/settings_GET (+ schema):** add `proMonthlyGst` and `proMonthlyTotal` so the UI never computes tax on its own.
- **components/MerchantSubscription, MerchantOnboarding, MerchantOverview, MerchantHelp, MerchantAcademyScreens, pages/partner / partnerContent:** show "₹2,499 + GST / 30 days" and, at checkout, "₹2,499 + ₹450 GST (18%) = ₹2,949". Add the note "GST input credit available if you are GST-registered". Read the hard-coded ₹2,499 values from settings wherever possible.
- **Break-even copy (if shown):** Pro is cheaper than Basic above about ₹31,000 of sales a month (₹2,499 ÷ 8%, with GST excluded because it can be claimed back).
- **endpoints/admin/overview_GET:** report Pro income as the base amount (excluding GST).
- **endpoints/admin/finance_GET + components/AdminFinanceDashboard:** add a "Pro subscription GST 18%" column to the monthly tax summary, taken from subscription payments.
- **components/AdminPricingSettings / admin Pro fee field:** label it "Pro fee ₹ (before GST)".
- **pages/terms (merchant-plans section):** "Pro: ₹2,499 + applicable GST (18%) per 30 days + 4% commission".
- **static/__dev/system-prompt.md and notes/payments-payouts-pro-activation.md:** record that Pro is ₹2,499 + GST.

## Database
- `subscription_payments`: add `base_amount int` and `gst_amount int default 0`. Backfill existing rows with base_amount = amount and gst_amount = 0 (old GST-inclusive payments).

## Files to Create
- None.

## Approach
1. Migrate the database (2 columns, then backfill).
2. Update the backend charge and verification so that the total is base + GST.
3. Add the settings output, then update every place that shows the fee.
4. Update the admin reports and the Terms page.
5. Check the result: a new Pro order is created at 294,900 paise, verification passes, and the existing paid rows still activate.

## Risks & Considerations
- Restaurants that already saw "₹2,499" now pay ₹2,949. Show "+ GST" clearly before payment. Restaurants that already paid are not charged again.
- The GST rate uses the existing 18% commission GST setting, which is editable.
- Deferred until the CA replies: numbered GST tax invoices, the delivery GST rate (18% or 5%), and the ₹3 platform fee (can be switched on from admin, no code change).
