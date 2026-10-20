import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import {
  Bike,
  ChevronDown,
  ChevronRight,
  Headset,
  Leaf,
  LogOut,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerRoute } from "../components/ProtectedRoute";
import { AccountProfileAvatar } from "../components/AccountProfileAvatar";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/Collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { Switch } from "../components/Switch";
import { WalletTopupSheet } from "../components/WalletTopupSheet";
import { postAccountDelete } from "../endpoints/account/delete_POST.schema";
import { postCustomerPreferences } from "../endpoints/customer/preferences_POST.schema";
import type { User } from "../helpers/User";
import { AUTH_QUERY_KEY, useAuth } from "../helpers/useAuth";
import { useVegMode } from "../helpers/useVegMode";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import styles from "./account.module.css";

function AccountContent() {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [topupOpen, setTopupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const { vegMode, setVegMode, isSaving } = useVegMode();

  const callsMutation = useMutation({
    mutationFn: (allowRestaurantCalls: boolean) =>
      postCustomerPreferences({ allowRestaurantCalls }),
    onSuccess: (preferences) => {
      queryClient.setQueryData<User | null>(AUTH_QUERY_KEY, (current) =>
        current ? { ...current, ...preferences } : null,
      );
      toast.success("Call preference saved");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save call preference"),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      postAccountDelete({ password: deletePassword, confirmText: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      toast.success("Your account has been deleted");
      navigate("/");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Could not delete your account";
      setDeleteError(message);
      toast.error(message);
    },
  });

  if (authState.type !== "authenticated") {
    return <Skeleton className={styles.headerSkeleton} aria-label="Loading account" />;
  }

  const user = authState.user;
  const wallet = ziptoHooks.useWallet(user.id);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>My account | platr™</title>
      </Helmet>

      <header className={styles.profile}>
        <div className={styles.identity}>
          <AccountProfileAvatar user={user} />
          <div className={styles.identityText}>
            <p className={styles.kicker}>Your platr™ account</p>
            <h1>{user.displayName}</h1>
            <p>{user.email}</p>
          </div>
        </div>
        <div className={styles.balanceArea}>
          <div>
            <span className={styles.balanceLabel}>Wallet balance</span>
            {wallet.isFetching && !wallet.data ? (
              <Skeleton className={styles.balanceSkeleton} aria-label="Loading wallet balance" />
            ) : wallet.data ? (
              <strong className={styles.balance}>{ziptoConfig.rupees(wallet.data.balance)}</strong>
            ) : (
              <span role="alert" className={styles.loadError}>
                Balance unavailable.{" "}
                <button type="button" onClick={() => void wallet.refetch()}>Retry</button>
              </span>
            )}
          </div>
          <Button
            size="lg"
            disabled={!wallet.data}
            onClick={() => setTopupOpen(true)}
          >
            Add money
          </Button>
        </div>
      </header>

      <div className={styles.sections}>
        <Collapsible defaultOpen className={styles.group}>
          <CollapsibleTrigger className={styles.groupTrigger}>
            <span><Bike size={20} aria-hidden="true" /> Food delivery</span>
            <ChevronDown size={20} aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={styles.groupBody}>
              <Link className={styles.row} to="/orders">
                <ShoppingBag size={20} aria-hidden="true" />
                <span>Your orders</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <Link className={styles.row} to="/account/addresses">
                <MapPin size={20} aria-hidden="true" />
                <span>Address book</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <div className={styles.row}>
                <Leaf size={20} aria-hidden="true" />
                <div className={styles.rowText}>
                  <label htmlFor="account-veg-mode">Veg mode</label>
                  {vegMode && <Badge variant="success">Veg only</Badge>}
                </div>
                <Switch
                  id="account-veg-mode"
                  checked={vegMode}
                  disabled={isSaving}
                  onCheckedChange={(next) => {
                    void setVegMode(next).catch(() => {
                      // useVegMode already displays the save error.
                    });
                  }}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <section className={styles.group} aria-labelledby="payments-heading">
          <h2 className={styles.groupHeading} id="payments-heading">Payments</h2>
          <div className={styles.groupBody}>
            <Link className={styles.row} to="/account/wallet">
              <Wallet size={20} aria-hidden="true" />
              <span>platr™ Wallet</span>
              {wallet.data && (
                <span className={styles.rowValue}>{ziptoConfig.rupees(wallet.data.balance)}</span>
              )}
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.row} to="/account/payments">
              <ReceiptText size={20} aria-hidden="true" />
              <span>Payment methods</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className={styles.group} aria-labelledby="settings-heading">
          <h2 className={styles.groupHeading} id="settings-heading">Settings</h2>
          <div className={styles.groupBody}>
            <div className={styles.row}>
              <Phone size={20} aria-hidden="true" />
              <div className={styles.rowText}>
                <label htmlFor="account-calls">Allow calls from restaurants</label>
                <small>Your rider can always call you in-app during an active delivery. Numbers are never shared.</small>
              </div>
              <Switch
                id="account-calls"
                checked={user.allowRestaurantCalls}
                disabled={callsMutation.isPending}
                onCheckedChange={(next) => callsMutation.mutate(next)}
              />
            </div>
            <Link className={styles.row} to="/support">
              <Headset size={20} aria-hidden="true" />
              <span>Contact platr™ Support</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.row} to="/terms">
              <ReceiptText size={20} aria-hidden="true" />
              <span>Terms of Service</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.row} to="/privacy-policy">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>Privacy Policy</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className={`${styles.rowButton} ${styles.destructiveRow}`}
              onClick={() => {
                setDeleteError("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={20} aria-hidden="true" />
              <span>Delete account</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.rowButton}
              onClick={async () => {
                try {
                  await logout();
                  navigate("/");
                } catch (error) {
                  console.error("Account logout failed:", error);
                  toast.error(error instanceof Error ? error.message : "Could not log out");
                }
              }}
            >
              <LogOut size={20} aria-hidden="true" />
              <span>Log out</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleteMutation.isPending) return;
          setDeleteOpen(open);
          if (!open) {
            setDeletePassword("");
            setDeleteConfirmation("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your platr™ account?</DialogTitle>
            <DialogDescription>
              This is permanent and immediate. We’ll remove your name, email,
              phone, saved addresses, delivery details on past orders, complaint
              photos, rating comments and call logs, and log out all devices.
              Order, payment, tax and refund records are kept in anonymised
              form as required by law.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.deleteDialogBody}>
            <p>
              Any platr™ Wallet balance
              {wallet.data && wallet.data.balance > 0 && (
                <> (<strong>{ziptoConfig.rupees(wallet.data.balance)}</strong>)</>
              )}{" "}
              is forfeited because the wallet is non-withdrawable.
            </p>
            <p>
              You can’t delete your account while an order, complaint refund or
              wallet top-up is still in progress.
            </p>
            <div className={styles.deleteField}>
              <label htmlFor="delete-account-password">Current password</label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                disabled={deleteMutation.isPending}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </div>
            <div className={styles.deleteField}>
              <label htmlFor="delete-account-confirmation">Type DELETE to confirm</label>
              <Input
                id="delete-account-confirmation"
                value={deleteConfirmation}
                disabled={deleteMutation.isPending}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </div>
            {deleteError && (
              <p className={styles.deleteError} role="alert">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteMutation.isPending ||
                !deletePassword.trim() ||
                deleteConfirmation !== "DELETE"
              }
              onClick={() => {
                setDeleteError("");
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

export default function AccountPage() {
  return <CustomerRoute><AccountContent /></CustomerRoute>;
}