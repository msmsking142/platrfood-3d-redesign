import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { ziptoConfig } from "../helpers/ziptoConfig";
import styles from "./terms.module.css";

const supportEmail = ziptoConfig.supportEmail;

const sections = [
  { id: "about", title: "About platr™ & acceptance" },
  { id: "accounts", title: "Accounts" },
  { id: "customer-pricing", title: "Pricing for customers" },
  { id: "payments", title: "Payments" },
  { id: "wallet", title: "platr™ Wallet" },
  { id: "gst", title: "Taxes (GST)" },
  { id: "cancellations", title: "Cancellations & refunds" },
  { id: "merchant-plans", title: "Restaurant plans" },
  { id: "pro-plan", title: "Pro plan & activation" },
  { id: "merchant-payouts", title: "Merchant payouts" },
  { id: "riders", title: "Rider terms" },
  { id: "rider-onboarding-fee", title: "Rider onboarding fee" },
  { id: "restaurants", title: "Restaurant obligations" },
  { id: "other-terms", title: "Other legal terms" },
  { id: "grievance", title: "Grievance Officer" },
] as const;

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Terms of Service – platr™</title>
      </Helmet>

      <header className={styles.intro}>
        <p className={styles.eyebrow}>platr™ · Affordable for Everyone</p>
        <h1>Terms of Service</h1>
        <p>
          The terms for ordering, selling and delivering with platr™ in
          Uttarakhand.
        </p>
        <p className={styles.updated}>Last updated: October 2026</p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="On this page">
          <h2>On this page</h2>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <Link to={`#${section.id}`}>{section.title}</Link>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.document}>
          <section id="about" className={styles.section}>
            <h2>1. About platr™ & acceptance</h2>
            <p>
              platr™, operated by Drive Floot in Uttarakhand, India, is a
              platform connecting customers, restaurants (merchants) and
              delivery riders across Uttarakhand. By using platr™, you accept
              these Terms of Service.
            </p>
            <p>
              platr™ is currently in its “Launching soon” phase. Ordering is
              not yet available to the public.
            </p>
          </section>

          <section id="accounts" className={styles.section}>
            <h2>2. Accounts</h2>
            <p>
              Give accurate information, keep your password safe and use only
              one account per person. Login requires an email one-time code.
              platr™ may suspend accounts involved in fraud or abuse.
            </p>
            <p>
              Customer registration is currently closed (“coming soon”). It
              will open on the public launch date announced by platr™.
              Restaurant and rider onboarding is open now.
            </p>
          </section>

          <section id="customer-pricing" className={styles.section}>
            <h2>3. Pricing for customers</h2>
            <p>
              The item total uses the restaurant’s menu rates. Delivery fee
              starts at ₹25 and covers rider pay (it goes to the rider). The
              distance-based fee is shown before checkout and locked for the
              order. The platform fee is currently ₹0 at launch. It may change with
              notice and will always be shown before payment.
            </p>
            <p className={styles.summary}>
              Small-order or surge fees apply only when enabled and are shown
              as separate lines. Taxes are shown separately where applicable.
              There are no hidden fees. If the price changes before payment,
              you must confirm the new total before paying.
            </p>
          </section>

          <section id="payments" className={styles.section}>
            <h2>4. Payments</h2>
            <p>
              Customers pay online using UPI, cards or netbanking via
              Razorpay, or with platr™ Wallet. Cash on delivery is not
              available. platr™ never stores your card details or UPI PIN.
              platr™ collects Razorpay payments in its merchant account on
              behalf of restaurants.
            </p>
          </section>

          <section id="wallet" className={styles.section}>
            <h2>5. platr™ Wallet</h2>
            <p>
              platr™ Wallet is a closed-loop balance usable only to pay for
              orders on platr™. It cannot be withdrawn to a bank, transferred
              to another user or converted to cash. The balance does not earn
              interest.
            </p>
            <p>
              You can top up ₹100–₹5,000 per transaction via Razorpay, up to
              a maximum wallet balance of ₹10,000. The wallet must cover the
              full order total; split payments are not yet available.
            </p>
            <p>
              Refunds for cancelled or rejected wallet-paid orders are
              credited back to the wallet. Online-paid orders are refunded
              to the original payment method. platr™ may correct erroneous
              wallet credits after giving notice. For wallet disputes, use the{" "}
              <Link to="/support">Contact Support form</Link>.
            </p>
          </section>

          <section id="gst" className={styles.section}>
            <h2>6. Taxes (GST)</h2>
            <p>
              Food ordered through platr™ attracts 5% GST without input tax
              credit (ITC). platr™ collects this tax from the customer and
              pays it to the government as the e-commerce operator under
              Section 9(5) of the CGST Act. Restaurants do not charge GST
              separately on platr™ orders.
            </p>
            <p>
              Delivery and platform fees attract 18% GST. Commission charged
              to restaurants attracts 18% GST, shown separately on the
              settlement. GST-registered restaurants may claim applicable
              ITC on that commission GST. GST TCS under Section 52 is not
              deducted on restaurant services taxed under Section 9(5).
            </p>
            <p>
              Income-tax TDS under Section 393(1) of the Income-tax Act, 2025
              (earlier Section 194-O, from 1 April 2026) is 0.1% of food
              sales, deducted on the weekly payout. If a restaurant has not
              given a valid PAN, the rate is 5%. Deducted TDS is creditable
              in the partner’s income-tax return. All applicable taxes are
              shown as separate lines.
            </p>
          </section>

          <section id="cancellations" className={styles.section}>
            <h2>7. Cancellations & refunds</h2>
            <p>
              A customer may cancel an order only before the restaurant
              accepts it. If the restaurant rejects an order or platr™
              cancels it, a paid order is refunded in full. Wallet-paid
              orders are credited back to the wallet; orders paid online
              through Razorpay are refunded to the original payment method.
              Refunds to the original payment method usually take 5–7
              working days, depending on bank and Razorpay timelines.
            </p>
            <p>
              Once an order is delivered, it cannot be cancelled or
              refunded, except where food is wrong, missing or unsafe.
              Report such an issue within 24 hours through the{" "}
              <Link to="/support">Contact Support form</Link> with
              your order number and a photo. platr™ will review the report
              and decide the outcome.
                        </p>
          </section>

          <section id="merchant-plans" className={styles.section}>
            <h2>8. Restaurant (merchant) plans</h2>
            <p>
              Under the platr™ Fair Plan, Basic costs ₹0 per month with
15% commission per order. Pro costs ₹2,499 plus applicable
              GST (currently 18%, i.e. ₹2,949 in total) per 30 days with
              8% commission per order, plus GST on commission. The amounts
              shown in the app at payment time apply.
            </p>
            <p>
              Commission is calculated on the food subtotal only. Delivery
              and platform fees are never deducted from the merchant’s food
              subtotal.
            </p>
            <p>
              No other charges: platr™ does not charge restaurants any payment
              gateway/payment mechanism fee, any charge for orders requiring
              support, or any penalty for rejected orders.
            </p>
          </section>

          <section id="pro-plan" className={styles.section}>
            <h2>9. Pro plan — pre-launch payments & activation</h2>
            <p>
              <strong>New restaurant introductory offer:</strong> Eligible new
              restaurants that have never had Pro may start a one-time 30-day
              Pro trial after approval with a ₹0 subscription fee. During the
              trial, 8% commission plus GST on commission applies. No payment
              details are taken and there is no auto-charge. After the trial,
              the account moves to Basic (15% commission) unless the restaurant
              explicitly chooses to pay ₹2,499 + GST to continue Pro. The trial
              can be cancelled anytime. One trial is available per restaurant.
              platr™ may end the offer for new sign-ups with notice.
            </p>
            <div className={styles.highlight}>
              <h3>Paying before launch? Your 30 days start at launch.</h3>
              <p>
                Because platr™ is not yet fully operational, a Pro payment
                made before public launch is <strong>not activated immediately</strong>.
                It is held as <strong>“Paid – awaiting activation”</strong>.
                platr™ will open customer registrations, review
                registrations and announce the public launch date. The
                30-day Pro period starts on that launch day—not the payment
                date—so the merchant receives the full 30 days of live
                business. We will email the merchant when Pro is activated.
              </p>
              <p>
                Until activation, the Basic plan applies. No orders are
                expected before launch. A pre-launch Pro payment can be
                refunded on request through the{" "}
                <Link to="/support">Contact Support form</Link>{" "}
                before activation.
              </p>
            </div>
            <p>
              After 30 days, Pro expires automatically and must be paid for
              again to continue. There is no auto-debit. If it is not
renewed, the account moves to Basic at 15% commission.
              Pro payments made after launch activate immediately; renewing
              before expiry adds 30 days after the current end date.
              Pro fees are non-refundable once the Pro period has started.
            </p>
          </section>

          <section id="merchant-payouts" className={styles.section}>
            <h2>10. Merchant payouts</h2>
            <p>
              Settlements run weekly, every Friday. All orders are paid
              online. Each payout covers delivered orders that have not been
              cancelled or refunded, up to Thursday at 11:59 PM IST. The
              payout for an order is its food subtotal minus any restaurant
              discount, applicable plan commission and commission GST.
              Applicable TDS is deducted from the weekly payout.
            </p>
            <p>
              Merchants must add a valid bank account (account number and
              IFSC) or UPI ID in the Finance section. Payouts are held
              until valid details are added. Transfers are made by bank
              transfer or UPI, with a UTR reference shown in the app. Bank
              holidays may delay a transfer by 1–2 working days. Payouts go
              through admin approval and are paid by manual bank or UPI
              transfer until automated transfers are enabled.
            </p>
            <p>
              platr™ may hold payouts for disputed, fraudulent or
              charged-back orders, and may deduct amounts for refunds caused
              by a restaurant, such as wrong or missing items. Merchants
              are responsible for their own GST and tax filings and FSSAI
              compliance.
            </p>
          </section>

          <section id="riders" className={styles.section}>
            <h2>11. Rider terms</h2>
            <p>
              Rider pay consists of base pay, distance pay and applicable
              incentives. It is paid weekly after review and is not reduced
              by restaurant commission or payment gateway charges. If an
              order is cancelled after pickup, the rider receives full pay.
              If it is cancelled after acceptance but before pickup, the
              configured cancellation compensation applies. A refund after
              delivery does not reduce rider pay.
            </p>
            <p>
              Riders must hold a valid licence, follow traffic laws and
              complete required KYC verification. Riders are independent
              partners, not platr™ employees.
            </p>
            <section id="rider-onboarding-fee">
              <h3>Rider onboarding fee</h3>
              <p>
                Riders pay a one-time onboarding fee of ₹199 + 18% GST
                (₹234.82 total) via Razorpay before submitting documents
                for verification. The GST breakdown is shown and must be
                accepted before payment. The fee is non-refundable once paid,
                including if the application is not approved.
              </p>
              <p>
                Accidental duplicate payments for the same rider are reviewed
                by platr™ support and refunded to the original payment method.
                A GST invoice/receipt is provided for the payment. The GST
                treatment is subject to confirmation by platr™’s tax advisor.
              </p>
            </section>
          </section>

          <section id="restaurants" className={styles.section}>
            <h2>12. Restaurant obligations</h2>
            <p>
              Restaurants must maintain a valid FSSAI licence, meet food
              quality and hygiene requirements, keep menu prices accurate
              and the same as in-store prices, and label vegetarian and
              non-vegetarian items accurately.
            </p>
          </section>

          <section id="other-terms" className={styles.section}>
            <h2>13. Other legal terms</h2>
            <h3>Prohibited use</h3>
            <p>
              Do not use platr™ for fraud, unlawful activity, harassment,
              misleading listings or interference with the platform.
            </p>
            <h3>Intellectual property</h3>
            <p>
              platr™’s name, branding and platform materials belong to
              platr™ or their respective rights holders. Using the platform
              does not give you ownership of them.
            </p>
            <h3>Limitation of liability</h3>
            <p>
              platr™ is an intermediary platform connecting customers,
              restaurants and riders. Restaurants are responsible for the
              food they prepare, including its quality, safety and accuracy.
              To the extent permitted by applicable law, platr™ is not
              responsible for losses caused by matters outside its control.
              This does not limit rights that cannot be excluded under law.
            </p>
            <h3>Changes and governing law</h3>
            <p>
              platr™ may update these terms and will notify users in-app or
              by email. Indian law governs these terms. Courts at Udham
              Singh Nagar, Uttarakhand, India have jurisdiction.
            </p>
          </section>

          <section id="grievance" className={styles.section}>
            <h2>14. Grievance Officer</h2>
            <div className={styles.grievanceCard}>
              <p>
                As per the Information Technology Act, 2000 and the
                Consumer Protection (E-Commerce) Rules, 2020:
              </p>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>Manpreet Singh</dd>
                </div>
                <div>
                  <dt>Designation</dt>
                  <dd>Grievance Officer & Founder, platr™</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                  </dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>Udham Singh Nagar, Uttarakhand, India</dd>
                </div>
                <div>
                  <dt>Response</dt>
                  <dd>Acknowledge within 48 hours; resolve within 30 days</dd>
                </div>
                <div>
                  <dt>Hours</dt>
                  <dd>Mon–Sat, 10 AM – 6 PM IST</dd>
                </div>
              </dl>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}