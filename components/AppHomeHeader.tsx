import {
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type Ref,
} from "react";
import {
  Check,
  ChevronDown,
  LocateFixed,
  MapPin,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { isNativeApp } from "../helpers/isNativeApp";
import type { DeliveryLocation } from "../helpers/useDeliveryLocation";
import { useAuth } from "../helpers/useAuth";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./Sheet";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import styles from "./AppHomeHeader.module.css";

export type AppHomeHeaderProps = {
  className?: string;
  customerApp?: boolean;
  location: DeliveryLocation;
  setLocation: (location: DeliveryLocation) => void;
  useCurrentLocation: () => Promise<void>;
  locating: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchRef: Ref<HTMLInputElement>;
};

function subscribeToViewportChange(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function AppHomeHeader({
  className,
  customerApp = false,
  location,
  setLocation,
  useCurrentLocation,
  locating,
  searchValue,
  onSearchChange,
  searchRef,
}: AppHomeHeaderProps) {
  const nativeApp = useSyncExternalStore(
    subscribeToViewportChange,
    isNativeApp,
    () => false,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const canUseAddresses = user?.role === "user" || user?.role === "admin";
  const wallet = ziptoHooks.useWallet(user?.role === "user" ? user.id : null);
  const addresses = ziptoHooks.useAddresses(canUseAddresses && sheetOpen);

  if (!nativeApp) return null;

  const profilePath = user ? "/account" : "/login";
  const walletPath = user?.role === "user" ? "/account/wallet" : "/login";
  const initial = user?.displayName.trim().charAt(0).toLocaleUpperCase("en-IN");

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    onSearchChange(event.target.value);
  }

  function selectCurrentLocation() {
    void useCurrentLocation()
      .then(() => setSheetOpen(false))
      .catch(() => {
        // The location hook has already logged and displayed the error.
      });
  }

  return (
    <header className={`${styles.header} ${customerApp ? styles.customerHeader : ""} ${className ?? ""}`}>
      <div className={styles.headerInner}>
        <div className={styles.topRow}>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={styles.locationButton}
                aria-label={`Delivery location: ${location.label}. ${location.line}. Change location`}
              >
                <MapPin className={styles.locationIcon} aria-hidden="true" />
                <span className={styles.locationCopy}>
                  <span className={styles.locationTitleRow}>
                    <strong className={styles.locationTitle}>
                      {location.label}
                    </strong>
                    <ChevronDown className={styles.chevron} aria-hidden="true" />
                  </span>
                  <span className={styles.locationLine}>{location.line}</span>
                </span>
              </button>
            </SheetTrigger>

            <SheetContent side="bottom" className={styles.sheetContent}>
              <SheetHeader className={styles.sheetHeader}>
                <SheetTitle>Choose delivery location</SheetTitle>
              </SheetHeader>

              <div className={styles.sheetBody}>
                <button
                  type="button"
                  className={styles.currentRow}
                  disabled={locating}
                  onClick={selectCurrentLocation}
                >
                  <span className={styles.rowIcon}>
                    {locating
                      ? <Spinner size="sm" />
                      : <LocateFixed aria-hidden="true" />}
                  </span>
                  <span className={styles.rowCopy}>
                    <strong>Use current location</strong>
                    <span>
                      {locating ? "Finding your location…" : "Find me on the map"}
                    </span>
                  </span>
                  {location.kind === "current" && !locating && (
                    <Check className={styles.selectedIcon} aria-hidden="true" />
                  )}
                </button>

                <div className={styles.addressSection}>
                  <h3 className={styles.sectionTitle}>Saved addresses</h3>

                  {authState.type === "loading" ? (
                    <div className={styles.skeletonList} aria-label="Loading account">
                      <Skeleton className={styles.addressSkeleton} />
                      <Skeleton className={styles.addressSkeleton} />
                    </div>
                  ) : canUseAddresses ? (
                    <>
                      {addresses.isFetching && !addresses.data ? (
                        <div
                          className={styles.skeletonList}
                          aria-label="Loading saved addresses"
                        >
                          <Skeleton className={styles.addressSkeleton} />
                          <Skeleton className={styles.addressSkeleton} />
                        </div>
                      ) : addresses.isError && !addresses.data ? (
                        <p className={styles.errorMessage} role="alert">
                          {addresses.error instanceof Error
                            ? addresses.error.message
                            : "Could not load saved addresses."}
                        </p>
                      ) : addresses.data?.addresses.length ? (
                        <div className={styles.addressList}>
                          {addresses.data.addresses.map((address) => {
                            const line = [address.address, address.landmark]
                              .filter(Boolean)
                              .join(", ");
                            const selected = location.kind === "address" &&
                              location.addressId === address.id;

                            return (
                              <button
                                type="button"
                                key={address.id}
                                className={`${styles.addressRow} ${
                                  selected ? styles.addressRowSelected : ""
                                }`}
                                onClick={() => {
                                  setLocation({
                                    kind: "address",
                                    label: address.label,
                                    line,
                                    town: address.town,
                                    addressId: address.id,
                                    ...(address.lat !== null
                                      ? { lat: address.lat }
                                      : {}),
                                    ...(address.lng !== null
                                      ? { lng: address.lng }
                                      : {}),
                                  });
                                  setSheetOpen(false);
                                }}
                              >
                                <span className={styles.rowIcon}>
                                  <MapPin aria-hidden="true" />
                                </span>
                                <span className={styles.rowCopy}>
                                  <strong>{address.label}</strong>
                                  <span>{line}</span>
                                </span>
                                {selected && (
                                  <Check
                                    className={styles.selectedIcon}
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.emptyMessage}>
                          No saved addresses yet.
                        </p>
                      )}
                      <Link
                        to="/account/addresses"
                        className={styles.manageLink}
                        onClick={() => setSheetOpen(false)}
                      >
                        Add or manage addresses
                      </Link>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      className={styles.manageLink}
                      onClick={() => setSheetOpen(false)}
                    >
                      Login to use saved addresses
                    </Link>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className={styles.accountActions}>
            {authState.type === "loading" ? (
              <>
                <Skeleton className={styles.walletSkeleton} />
                <Skeleton className={styles.profileSkeleton} />
              </>
            ) : (
              <>
                <Link
                  to={walletPath}
                  className={styles.walletButton}
                  aria-label={
                    wallet.data && user?.role === "user"
                      ? `platr™ Wallet balance ${ziptoConfig.rupees(wallet.data.balance)}`
                      : "platr™ Wallet"
                  }
                >
                  <Wallet className={styles.walletIcon} aria-hidden="true" />
                  {user?.role === "user" && wallet.isFetching && !wallet.data ? (
                    <Skeleton className={styles.balanceSkeleton} />
                  ) : (
                    <span className={styles.walletText}>
                      {user?.role !== "user"
                        ? "Wallet"
                        : wallet.data
                          ? ziptoConfig.rupees(wallet.data.balance)
                          : wallet.isError
                            ? "Unavailable"
                            : "Wallet"}
                    </span>
                  )}
                </Link>
                <Link
                  to={profilePath}
                  className={styles.profileButton}
                  aria-label={user ? "Your account" : "Log in"}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className={styles.avatarImage}
                    />
                  ) : initial ? (
                    <span className={styles.avatarInitial}>{initial}</span>
                  ) : (
                    <UserRound className={styles.profileIcon} aria-hidden="true" />
                  )}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className={styles.searchBar}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={'Search "biryani", "pizza"...'}
            aria-label="Search restaurants and dishes"
          />
        </div>
      </div>
    </header>
  );
}