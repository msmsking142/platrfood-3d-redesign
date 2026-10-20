import { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Clock,
  CreditCard,
  Landmark,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CustomerRoute } from "../components/ProtectedRoute";
import { Skeleton } from "../components/Skeleton";
import { WalletTopupSheet } from "../components/WalletTopupSheet";
import type { PaymentMethodGroup } from "../endpoints/payments/methods_GET.schema";
import { useAuth } from "../helpers/useAuth";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import styles from "./account.payments.module.css";

const methodIcons: Record<PaymentMethodGroup["id"], typeof Wallet> = {
  upi: Smartphone,
  card: CreditCard,
  netbanking: Landmark,
  wallet: Wallet,
  emi: CalendarClock,
  cardless_emi: CalendarClock,
  paylater: Clock,
};

function PaymentsContent() {
  const { authState } = useAuth();
  const [topupOpen, setTopupOpen] = useState(false);
  if (authState.type !== "authenticated") {
    return <Skeleton className={styles.cardSkeleton} aria-label="Loading payments" />;
  }

  const wallet = ziptoHooks.useWallet(authState.user.id);
  const methods = ziptoHooks.usePaymentMethods();

  return (
    <div className={styles.page}>
      <Helmet><title>Payment methods | platr™</title></Helmet>
      <Link to="/account" className={styles.back}>← Account</Link>
      <h1>Payment methods</h1>

      <section className={styles.walletCard} aria-labelledby="wallet-heading">
        <span className={styles.walletIcon}><Wallet size={24} aria-hidden="true" /></span>
        <div className={styles.walletCopy}>
          <h2 id="wallet-heading">platr™ Wallet</h2>
          {wallet.isFetching && !wallet.data ? (
            <Skeleton className={styles.balanceSkeleton} aria-label="Loading wallet balance" />
          ) : wallet.data ? (
            <strong>{ziptoConfig.rupees(wallet.data.balance)}</strong>
          ) : (
            <div role="alert">
              <span>Balance unavailable</span>{" "}
              <button className={styles.retryLink} onClick={() => void wallet.refetch()}>Retry</button>
            </div>
          )}
          <Link to="/account/wallet" className={styles.walletLink}>View wallet →</Link>
        </div>
        <Button disabled={!wallet.data} onClick={() => setTopupOpen(true)}>Add money</Button>
      </section>

      <section className={styles.methods} aria-labelledby="methods-heading">
        <div className={styles.sectionHeading}>
          <h2 id="methods-heading">Pay online</h2>
          {methods.data?.source === "default" && <span>Showing common methods</span>}
        </div>
        {methods.isFetching && !methods.data ? (
          <div className={styles.loading} aria-label="Loading payment methods">
            <Skeleton className={styles.cardSkeleton} />
            <Skeleton className={styles.cardSkeleton} />
            <Skeleton className={styles.cardSkeleton} />
          </div>
        ) : methods.data ? (
          methods.data.groups.length ? (
            <div className={styles.methodList}>
              {methods.data.groups.map((group) => {
                const Icon = methodIcons[group.id];
                const remainingBanks = group.id === "netbanking"
                  ? Math.max(0, (group.count ?? 0) - group.items.length) : 0;
                return (
                  <article key={group.id} className={styles.method}>
                    <span className={styles.methodIcon}><Icon size={23} aria-hidden="true" /></span>
                    <div className={styles.methodBody}>
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                      <div className={styles.badges}>
                        {group.items.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
                        {remainingBanks > 0 && (
                          <Badge variant="outline">and {remainingBanks} more banks</Badge>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className={styles.empty}>No online payment methods are currently listed. Please check again later.</p>
        ) : (
          <div role="alert" className={styles.error}>
            <p>Could not load payment methods. {methods.error instanceof Error ? methods.error.message : ""}</p>
            <Button onClick={() => void methods.refetch()}>Retry</Button>
          </div>
        )}
      </section>

      <aside className={styles.security}>
        <ShieldCheck size={22} aria-hidden="true" />
        <span>All payments are processed securely by Razorpay. platr™ never stores your card details.</span>
      </aside>
      {wallet.data && (
        <WalletTopupSheet
          open={topupOpen}
          onOpenChange={setTopupOpen}
          balance={wallet.data.balance}
        />
      )}
    </div>
  );
}

export default function AccountPaymentsPage() {
  return <CustomerRoute><PaymentsContent /></CustomerRoute>;
}