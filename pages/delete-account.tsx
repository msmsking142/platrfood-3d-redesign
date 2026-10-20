import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import styles from "./delete-account.module.css";

export default function DeleteAccountPage() {
  return (
    <main className={styles.page}>
      <Helmet>
        <title>Request account deletion — platr™</title>
        <meta name="description" content="How to request deletion of your platr™ account and associated personal data." />
      </Helmet>
      <article className={styles.card}>
        <p className={styles.brand}>platr™</p>
        <h1>Delete your platr™ account</h1>
        <p>You can request deletion of your platr™ account and associated personal data using the options below.</p>
        <h2>Customers</h2>
        <p>If you can sign in, open the app and go to <strong>Account → Settings → Delete account</strong>. Confirm with your account password and type DELETE. The request is processed in the app and you are signed out.</p>
        <h2>Restaurant partners and delivery riders</h2>
        <p>To request account closure and deletion of associated personal data, email <a href="mailto:support@platrfood.co.in?subject=Account%20deletion%20request">support@platrfood.co.in</a> from your registered email address, or use our <Link to="/support">Contact Support form</Link>. Include your account role (restaurant partner or rider) and registered email or phone number. Do not send passwords or payment PINs.</p>
        <h2>Request deletion of specific data without deleting your account</h2>
        <p>You do not need to close your platr™ account to ask us to delete specific personal data. Email <a href="mailto:support@platrfood.co.in?subject=Personal%20data%20deletion%20request">support@platrfood.co.in — Request data deletion</a> from your registered email address. Tell us which data you want deleted and provide your account's registered email or phone number so we can verify the request. Do not include your password, payment PIN, or other login secrets. We will review the request and explain if any data must be retained for legal, tax, payment, safety, or dispute-resolution reasons.</p>
        <h2>What we delete and retain</h2>
        <p>Depending on your request and applicable requirements, we may delete or anonymise personal details such as your name, contact details, saved addresses, delivery-location details linked to past orders, complaint photos and messages, rating comments, and call logs where applicable.</p>
        <p>Some transaction, order, payment, refund, tax, accounting, fraud-prevention or payout records may be retained in anonymised or legally required form. We will explain if any records must be retained.</p>
        <h2>Timing and pending transactions</h2>
        <p>Customer self-service deletion takes effect immediately when accepted. An account cannot be deleted while an order, complaint refund or wallet top-up is in progress. Spend any remaining platr™ Wallet balance before deleting your customer account, because the wallet balance is non-withdrawable and is forfeited on deletion.</p>
        <p>For help with a deletion request, contact <a href="mailto:support@platrfood.co.in">support@platrfood.co.in</a>.</p>
        <p className={styles.links}><Link to="/privacy-policy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link></p>
      </article>
    </main>
  );
}