import { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, RotateCcw, ShoppingBag, Wallet } from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { CustomerRoute } from "../components/ProtectedRoute";
import { Skeleton } from "../components/Skeleton";
import { WalletTopupSheet } from "../components/WalletTopupSheet";
import { useAuth } from "../helpers/useAuth";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import type { WalletTxnView } from "../endpoints/wallet/summary_GET.schema";
import styles from "./account.wallet.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

function Transaction({ transaction }: { transaction: WalletTxnView }) {
  const credit = transaction.type === "topup" ||
    transaction.type === "order_refund" ||
    (transaction.type === "admin_adjustment" && transaction.amount >= 0);
  const title = transaction.type === "topup" ? "Added money"
    : transaction.type === "order_payment" ? `Paid for order #${transaction.orderId ?? "—"}`
    : transaction.type === "order_refund" ? `Refund for order #${transaction.orderId ?? "—"}`
    : "Adjustment by platr™";
  const Icon = transaction.type === "topup" ? ArrowDownLeft
    : transaction.type === "order_payment" ? ShoppingBag
    : transaction.type === "order_refund" ? RotateCcw : ArrowUpRight;

  return (
    <li className={styles.transaction}>
      <span className={`${styles.transactionIcon} ${credit ? styles.creditIcon : ""}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className={styles.transactionDetails}>
        {transaction.type === "order_payment" && transaction.orderId !== null ? (
          <Link to="/orders">{title}</Link>
        ) : <strong>{title}</strong>}
        {transaction.note && transaction.type === "admin_adjustment" && (
          <span className={styles.note}>{transaction.note}</span>
        )}
        <time dateTime={new Date(transaction.createdAt).toISOString()}>
          {dateFormatter.format(new Date(transaction.createdAt))}
        </time>
        {transaction.status !== "success" && (
          <Badge variant={transaction.status === "failed" ? "destructive" : "warning"}>
            {transaction.status === "failed" ? "Failed" : "Pending"}
          </Badge>
        )}
      </div>
      <strong className={`${styles.amount} ${credit ? styles.credit : ""}`}>
        {credit ? "+" : "−"}{ziptoConfig.rupees(Math.abs(transaction.amount))}
      </strong>
    </li>
  );
}

function WalletContent() {
  const { authState } = useAuth();
  const [topupOpen, setTopupOpen] = useState(false);
  if (authState.type !== "authenticated") {
    return <Skeleton className={styles.balanceSkeleton} aria-label="Loading wallet" />;
  }

  const wallet = ziptoHooks.useWallet(authState.user.id);

  return (
    <div className={styles.page}>
      <Helmet><title>platr™ Wallet | platr™</title></Helmet>
      <Link to="/account" className={styles.back}>← Account</Link>
      <h1>platr™ Wallet</h1>

      {wallet.isFetching && !wallet.data ? (
        <div className={styles.loading} aria-label="Loading wallet">
          <Skeleton className={styles.balanceSkeleton} />
          <Skeleton className={styles.lineSkeleton} />
          <Skeleton className={styles.lineSkeleton} />
        </div>
      ) : wallet.data ? (
        <>
          <section className={styles.balanceCard} aria-label="Wallet balance">
            <div className={styles.balanceIcon}><Wallet size={25} aria-hidden="true" /></div>
            <p>Available balance</p>
            <strong>{ziptoConfig.rupees(wallet.data.balance)}</strong>
            <Button variant="secondary" size="lg" onClick={() => setTopupOpen(true)}>
              Add money
            </Button>
          </section>

          <section className={styles.history} aria-labelledby="history-heading">
            <h2 id="history-heading">Transaction history</h2>
            {wallet.data.transactions.length ? (
              <ul className={styles.transactions}>
                {wallet.data.transactions.map((transaction) =>
                  <Transaction key={transaction.id} transaction={transaction} />
                )}
              </ul>
            ) : (
              <div className={styles.empty}>
                <Wallet size={30} aria-hidden="true" />
                <h3>No transactions yet</h3>
                <p>Your wallet activity will appear here.</p>
              </div>
            )}
          </section>

          <aside className={styles.info}>
            Wallet balance can be used only on platr™ and is non-withdrawable.
            Refunds for wallet orders come back to the wallet.{" "}
            <Link to="/terms#wallet">Read wallet terms</Link>
          </aside>
          <WalletTopupSheet
            open={topupOpen}
            onOpenChange={setTopupOpen}
            balance={wallet.data.balance}
          />
        </>
      ) : (
        <div role="alert" className={styles.error}>
          <p>Could not load your wallet. {wallet.error instanceof Error ? wallet.error.message : ""}</p>
          <Button onClick={() => void wallet.refetch()}>Retry</Button>
        </div>
      )}
    </div>
  );
}

export default function AccountWalletPage() {
  return <CustomerRoute><WalletContent /></CustomerRoute>;
}