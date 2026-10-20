import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import styles from "./privacy-policy.module.css";

const privacyEmail = "support@platrfood.co.in";

const sections = [
  { id: "who-we-are", title: "Who we are" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "payments", title: "Payments" },
  { id: "how-we-use-information", title: "How we use information" },
  { id: "how-we-share-information", title: "How we share information" },
  { id: "cookies-and-analytics", title: "Cookies, local storage and analytics" },
  { id: "retention", title: "Retention" },
  { id: "security", title: "Security" },
  { id: "your-choices", title: "Your choices and rights" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact & grievance" },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Privacy Policy — platr™</title>
      </Helmet>

      <header className={styles.intro}>
        <p className={styles.eyebrow}>platr™ · Affordable for Everyone</p>
        <h1>Privacy Policy</h1>
        <p>
          How platr™ handles information when you order, sell or deliver with
          us in Uttarakhand.
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
          <section id="who-we-are" className={styles.section}>
            <h2>1. Who we are</h2>
            <p>
              platr™ is a food delivery service based in Udham
              Singh Nagar, Uttarakhand, India, connecting customers,
              restaurants and delivery riders. Details of the legal entity
              operating platr™ are pending confirmation and will be added here
              once finalised.
            </p>
            <p>
              This policy covers platrfood.co.in and the platr™ mobile app.
              platr™ is currently in its “launching soon” phase.
            </p>
          </section>

          <section id="information-we-collect" className={styles.section}>
            <h2>2. Information we collect</h2>

            <h3>Accounts and login security</h3>
            <p>
              We collect your name, email address, mobile number, account role
              (customer, restaurant or rider), email verification status and
              preferences such as veg mode and whether you allow restaurant calls. Your
              password is stored as a hashed value, never in plain text. We
              also handle one-time codes sent to your email for sign-up and
              login, and information about your login sessions.
            </p>

            <h3>Customers</h3>
            <p>
              We collect saved delivery addresses; a delivery pin location
              (latitude and longitude) chosen on a map; and a receiver’s name
              and phone number if you order for someone else. We keep order
              history, items, notes, prices, fees, taxes, order and payment
              status, ratings and comments, food complaints and photos you
              upload with them, and platr™ Wallet balance and transaction
              history.
            </p>

            <h3>Restaurants</h3>
            <p>
              We collect owner details, restaurant name, description, cuisine,
              address, phone number, map pin location, menu and prices.
              Restaurant profile photos and dish photos are reviewed by platr™
              before going live. We also collect FSSAI licence documents and
              expiry dates, PAN for TDS, payout account holder name, account
              number, IFSC and/or UPI ID, Pro subscription payments, and
              settlement and payout records.
            </p>

            <h3>Riders</h3>
            <p>
              We collect phone number, town, vehicle type and number, driving
              licence photo and selfie for verification, payout bank or UPI
              details, earnings records, online status and live location.
            </p>

            <h3>Location</h3>
            <p>
              With browser or device permission, we collect a rider’s device
              location while the rider is online with an active delivery. We
              share it with the restaurant before pickup and with the customer
              of that order during delivery. Customers can optionally use
              “use my current location” to place a delivery pin, with
              permission. We do not collect customer location in the
              background.
            </p>

            <h3>Communication</h3>
            <p>
              Support tickets submitted through the{" "}
              <Link to="/support">Contact Support form</Link> or by email
              include details such as name, email, topic, order and messages.
              In-app calls are internet voice calls (WebRTC) inside the platr™
              app between the customer, restaurant and assigned rider of an
              active order: customer ↔ rider, rider ↔ restaurant and customer
              ↔ restaurant. No phone number is used, dialled, displayed or
              shared. Restaurants see “Customer” instead of the customer’s
              name; riders see the customer’s first name. Calls are available
              only to participants of that order while it is active and end
              automatically when the order is delivered, cancelled or rejected.
              Restaurants can call a customer only if the customer turns on
              “Allow calls from restaurants”, which is off by default.
              Customers and their assigned rider can call each other during
              the active delivery.
            </p>
            <p>
              Microphone access is requested only when you start or answer a
              call. You can deny it in your device or browser settings, but
              calling then won’t work. Call audio travels directly between
              the two devices (peer-to-peer, encrypted by WebRTC) and does
              not pass through platr™’s servers. platr™ does not record call
              audio. We cannot prevent the other participant from recording
              with their own device, so do not share sensitive information
              on calls. Because the connection is peer-to-peer, each device
              may see the other’s network (IP) address. A Google STUN server
              helps establish the connection and sees IP addresses.
            </p>
            <p>
              We process call logs containing the order, caller and callee
              account IDs, start and end times, and status (ringing, active,
              ended, declined or missed). We also relay short-lived
              connection-setup (signalling) messages through our real-time
              service; these messages are not stored. We use call logs for
              safety, support, fraud and abuse prevention (such as limits on
              repeated call attempts), and dispute resolution. Call logs are
              deleted or anonymised with account deletion as described under
              Retention.
            </p>

            <h3>Device and technical information</h3>
            <p>
              We use information needed to run the service, such as login
              session cookies and settings saved on your device. These
              settings may include veg mode when logged out, the order alert
              sound setting and whether you watched the onboarding video.
            </p>
          </section>

          <section id="payments" className={styles.section}>
            <h2>3. Payments</h2>
            <p>
              Online payments are processed by Razorpay, including UPI,
              cards, netbanking, wallets, EMI and pay-later options. Card
              numbers, CVV, UPI PIN and bank login details are entered on
              Razorpay’s checkout. platr™ does not receive or store them.
            </p>
            <p>
              platr™ stores Razorpay order, payment and refund reference IDs,
              amounts and status. Razorpay’s{" "}
              <a href="https://razorpay.com/privacy/">privacy policy</a>{" "}
              applies to information it processes. platr™ Wallet is a
              closed-loop wallet; its balance and transactions are stored by
              platr™.
            </p>
          </section>

          <section id="how-we-use-information" className={styles.section}>
            <h2>4. How we use information</h2>
            <p>
              We use information to create and secure accounts; process and
              deliver orders; calculate prices, fees and taxes; process
              payments, refunds and wallet transactions; pay restaurants and
              riders weekly and deduct TDS; and verify restaurants’ FSSAI
              documents and riders’ licences and selfies.
            </p>
            <p>
              We also use it to review photos, provide live tracking and
              in-app calls, send transactional emails (including OTPs, order
              updates, complaint updates, Pro activation notices and support
              replies), handle support and complaints, prevent fraud and
              abuse, meet legal, tax and accounting obligations, and
              understand website usage in aggregate.
            </p>
          </section>

          <section id="how-we-share-information" className={styles.section}>
            <h2>5. How we share information</h2>
            <p>
              Restaurants receive only what they need to prepare food: the
              order number, items and quantities, cooking notes, order status,
              amounts relevant to their settlement, and the assigned rider’s
              first name and live location before pickup. Order emails to
              restaurants contain items only. Restaurants do not receive the
              customer’s name, phone number, email or delivery address.
              Before accepting an order, riders see the restaurant, delivery
              area or address, and distance. After accepting, they see the
              receiver’s name, delivery address, pin and notes needed to
              complete delivery. Riders and restaurants never receive
              customer phone numbers or email addresses through the app.
              Customers see the restaurant’s name and address and the
              assigned rider’s name and live location. Rider and restaurant
              phone numbers are not shown to customers.
            </p>
            <p>
              We use Razorpay for payments and refunds, and Floot for app
              hosting, database, file storage, email delivery, real-time
              updates and visitor analytics. OpenStreetMap map tiles load in
              your browser; OpenStreetMap receives your IP address and the
              map area viewed. A Google STUN server helps connect in-app
              calls and sees IP addresses. If you tap a “navigate” or “open
              in Maps” link, Google Maps opens under Google’s own policy.
            </p>
            <p>
              We may share information with government or tax authorities
              when required by law. We do not sell personal information.
            </p>
          </section>

          <section id="cookies-and-analytics" className={styles.section}>
            <h2>6. Cookies, local storage and analytics</h2>
            <p>
              An essential session cookie keeps you logged in. We use local
              storage for preferences saved on your device. The website’s
              hosting platform has built-in visitor analytics that may store
              a temporary session identifier on your device to count visits
              and page views. We do not use advertising cookies.
            </p>
          </section>

          <section id="retention" className={styles.section}>
            <h2>7. Retention</h2>
            <p>
              We keep information while your account is active and as needed
              to provide the service and resolve disputes. When an account is
              deleted, we immediately delete or anonymise personal details
              (name, email and phone), saved addresses, login credentials and
              sessions, delivery address, phone, receiver name, notes and pin
              on past orders, complaint photos and descriptions, rating
              comments, call logs, and support ticket contact details and
              messages.
            </p>
            <p>
              We retain order amounts, items, taxes, payment and refund
              references, wallet transaction history, payout-related
              adjustments, and star ratings without comments in anonymised
              form as required for tax, accounting and legal obligations.
              Retention periods for these records follow Indian tax and
              accounting laws; exact periods are pending confirmation with
              our chartered accountant (CA). OTP codes expire after 10
              minutes.
            </p>
          </section>

          <section id="security" className={styles.section}>
            <h2>8. Security</h2>
            <p>
              We take reasonable measures to protect information. Passwords
              are hashed, and email OTP is used for login except for
              specifically exempt accounts. Access to admin tools and
              verification documents is restricted to authorised platr™
              staff. Rider and restaurant documents are not public, and
              online payments go through Razorpay. No method of protecting
              information is 100% secure.
            </p>
          </section>

          <section id="your-choices" className={styles.section}>
            <h2>9. Your choices and rights</h2>
            <p>
              You can access and update your profile and saved addresses in
              the app, turn off call permission in Account, and control
              location permission in your device or browser settings. Riders
              need location permission to deliver orders.
            </p>
            <p>
              Customers can delete their account anytime from Account →
              Settings → Delete account by entering their password and typing
              DELETE. Deletion takes effect immediately, logs out all devices
              and does not require support approval. You cannot delete your
              account while an order, complaint refund or wallet top-up is in
              progress. Any remaining platr™ Wallet balance is forfeited on
              deletion because the wallet is non-withdrawable, so please
              spend it first. The records described under Retention remain
              in anonymised form where required by law.
            </p>
            <p>
              Restaurant partner and rider accounts are linked to payout,
              KYC and tax records. To close one of these accounts, use the{" "}
              <Link to="/support">Contact Support form</Link> or email{" "}
              <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. To
              request a copy or correction of your information, email{" "}
              <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
            </p>
          </section>

          <section id="children" className={styles.section}>
            <h2>10. Children</h2>
            <p>
              platr™ is only for people aged 18 or older. We do not knowingly
              collect data from anyone under 18 and will delete such
              accounts if discovered.
            </p>
          </section>

          <section id="changes" className={styles.section}>
            <h2>11. Changes</h2>
            <p>
              We may update this policy. We will show the updated date here
              and notify users in-app or by email about significant changes.
            </p>
          </section>

          <section id="contact" className={styles.section}>
            <h2>12. Contact &amp; grievance</h2>
            <p>
              For privacy questions or requests, email{" "}
              <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>. You
              can also use the <Link to="/support">Contact Support form</Link>.
              Please see our <Link to="/terms">Terms of Service</Link> for
              the terms governing use of platr™.
            </p>
            <div className={styles.grievanceCard}>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>Manpreet Singh</dd>
                </div>
                <div>
                  <dt>Designation</dt>
                  <dd>Grievance Officer, platr™</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>
                  </dd>
                </div>
                <div>
                  <dt>Legal entity</dt>
                  <dd>Pending confirmation</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>Udham Singh Nagar, Uttarakhand, India</dd>
                </div>
              </dl>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}