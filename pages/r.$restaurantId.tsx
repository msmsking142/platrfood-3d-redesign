import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Clock, MapPin, ArrowLeft, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { customerCartStore } from "../helpers/customerCartStore";
import { useAuth } from "../helpers/useAuth";
import { postCustomerAddressAction } from "../endpoints/customer/address_action_POST.schema";
import type { CustomerAddress } from "../endpoints/customer/addresses_GET.schema";
import { postPlaceOrder, PriceChangedError } from "../endpoints/customer/place_order_POST.schema";
import { postCustomerQuote, type CustomerQuote } from "../endpoints/customer/quote_POST.schema";
import { useCustomerOnlineCheckout } from "../helpers/useCustomerOnlineCheckout";
import { Button } from "../components/Button";
import { CustomerCartView } from "../components/CustomerCartView";
import { RestaurantCartSheet } from "../components/RestaurantCartSheet";
import { RestaurantMenu } from "../components/RestaurantMenu";
import { RestaurantRatingStars } from "../components/RestaurantRatingStars";
import { PriceUpdatedDialog } from "../components/PriceUpdatedDialog";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { Spinner } from "../components/Spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import { CustomerQuoteBill } from "../components/CustomerQuoteBill";
import { CustomerQuoteAvailability } from "../components/CustomerQuoteAvailability";
import { CheckoutAddressPicker } from "../components/CheckoutAddressPicker";
import { WalletTopupSheet } from "../components/WalletTopupSheet";
import { ToggleGroup, ToggleGroupItem } from "../components/ToggleGroup";
import { LocationPinPicker } from "../components/LocationPinPicker";
import styles from "./r.$restaurantId.module.css";

type Cart = Record<number, number>;

export default function RestaurantPage() {
  const id = Number(useParams().restaurantId);
  const { data, isFetching, error } = ziptoHooks.useRestaurant(id);
  const settingsQuery = ziptoHooks.useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const { authState } = useAuth();
  const customerId = authState.type === "authenticated" &&
    (authState.user.role === "user" || authState.user.role === "admin")
    ? authState.user.id
    : null;
  const walletQuery = ziptoHooks.useWallet(customerId);
  const addressesQuery = ziptoHooks.useAddresses(customerId !== null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startPayment } = useCustomerOnlineCheckout();
  const [cart, setCart] = useState<Cart>(() => customerCartStore.read(id));
  useEffect(() => {
    customerCartStore.write(id, cart);
  }, [cart, id]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addr, setAddr] = useState<{
    deliveryAddress: string;
    deliveryPhone: string;
    notes: string;
    paymentMethod: "upi" | "wallet";
  }>({ deliveryAddress: "", deliveryPhone: "", notes: "", paymentMethod: "upi" });
  const [orderFor, setOrderFor] = useState<"self" | "other">("self");
  const [receiver, setReceiver] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [addressTouched, setAddressTouched] = useState(false);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [priceUpdated, setPriceUpdated] = useState<{ message: string; quote: CustomerQuote } | null>(null);

  const menu = data?.menu ?? [];

  const lines = menu.filter((m) => cart[m.id]).map((m) => ({ ...m, qty: cart[m.id] }));
  const walletBalance = walletQuery.data?.balance;
  const savedAddresses = addressesQuery.data?.addresses ?? [];
  const count = lines.reduce((s, l) => s + l.qty, 0);
  useEffect(() => {
    if (count > 0 && searchParams.get("cart") === "1") setCartOpen(true);
  }, [count, searchParams]);
  const setCartSheetOpen = (open: boolean) => {
    setCartOpen(open);
    if (!open && searchParams.has("cart")) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete("cart");
        return next;
      }, { replace: true });
    }
  };
  const quoteItems = lines.map((l) => ({ menuItemId: l.id, quantity: l.qty }));
  const quoteKey = ["customer", "quote", id, quoteItems, coords?.lat ?? null, coords?.lng ?? null, addr.paymentMethod] as const;
  const quoteQuery = useQuery({
    queryKey: quoteKey,
    queryFn: () => postCustomerQuote({
      restaurantId: id,
      items: quoteItems,
      deliveryLat: coords?.lat,
      deliveryLng: coords?.lng,
      paymentMethod: addr.paymentMethod,
    }),
    enabled: quoteItems.length > 0 && Number.isInteger(id) && id > 0,
    placeholderData: (previous) => previous,
  });
  const quote = quoteQuery.data;
  const quoteLoading = quoteQuery.isFetching || (count > 0 && !quote && !quoteQuery.isError);
  const canCheckout = !!quote && !quoteLoading && !quoteQuery.isError &&
    !quote.outOfRange && quote.serviceAvailable &&
    (addr.paymentMethod !== "wallet" ||
      (walletBalance !== undefined && !walletQuery.isFetching && walletBalance >= quote.total));
  const walletShortfall = Math.max(0, (quote?.total ?? 0) - (walletBalance ?? 0));
  const quoteTotal = quote && !quoteLoading && !quoteQuery.isError
    ? ziptoConfig.rupees(quote.total)
    : "…";

  useEffect(() => {
    if (!checkoutOpen || orderFor !== "self" || addressTouched || !addressesQuery.data ||
        addr.deliveryAddress.trim() || addr.deliveryPhone.trim()) return;
    const defaultAddress = addressesQuery.data.addresses.find((address) => address.isDefault);
    if (!defaultAddress) return;
    setSelectedAddressId(defaultAddress.id);
    setAddr((current) => ({
      ...current,
      deliveryAddress: [
        defaultAddress.address,
        defaultAddress.landmark,
        defaultAddress.town,
      ].filter(Boolean).join(", "),
      deliveryPhone: defaultAddress.phone,
    }));
    setCoords(defaultAddress.lat !== null && defaultAddress.lng !== null
      ? { lat: defaultAddress.lat, lng: defaultAddress.lng }
      : null);
  }, [checkoutOpen, orderFor, addressTouched, addressesQuery.data, addr.deliveryAddress, addr.deliveryPhone]);

  useEffect(() => {
    if (!checkoutOpen || paymentTouched || !quote || quoteLoading ||
        walletBalance === undefined || walletQuery.isFetching) return;
    const method = walletBalance >= quote.total ? "wallet" : "upi";
    setAddr((current) => current.paymentMethod === method
      ? current
      : { ...current, paymentMethod: method });
  }, [checkoutOpen, paymentTouched, quote, quoteLoading, walletBalance, walletQuery.isFetching]);

  const selectAddress = (address: CustomerAddress | null) => {
    setAddressTouched(true);
    setSelectedAddressId(address?.id ?? null);
    setAddr((current) => ({
      ...current,
      deliveryAddress: address
        ? [address.address, address.landmark, address.town].filter(Boolean).join(", ")
        : "",
      deliveryPhone: address?.phone ?? "",
    }));
    setCoords(address?.lat != null && address.lng != null
      ? { lat: address.lat, lng: address.lng }
      : null);
    if (!address) setSaveNewAddress(savedAddresses.length < 10);
  };

  const changeOrderFor = (next: string) => {
    if (next !== "self" && next !== "other") return;
    setOrderFor(next);
    if (next === "other") {
      setCoords(null);
    } else {
      const defaultAddress = savedAddresses.find((address) => address.isDefault);
      selectAddress(defaultAddress ?? null);
      setAddressTouched(false);
    }
  };

  const change = (itemId: number, d: number) =>
    setCart((c) => {
      const n = Math.max(0, Math.min(20, (c[itemId] || 0) + d));
      const next = { ...c, [itemId]: n };
      if (!n) delete next[itemId];
      return next;
    });

  const useLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (error) => {
        console.error("Could not get delivery location:", error);
        toast.error(error.code === 1
          ? "Location permission was denied. Allow location access to get an exact delivery fee."
          : "Could not get your location. Please try again.");
        setLocating(false);
      },
    );
  };

  const openCheckout = () => {
    if (!canCheckout) return;
    if (authState.type !== "authenticated") {
      toast("Please log in to place your order");
      navigate("/login");
      return;
    }
    if (authState.user.role !== "user" && authState.user.role !== "admin") {
      toast.error("Please use a customer account to order food");
      return;
    }
    setPaymentTouched(false);
    setAddressTouched(false);
    setCheckoutOpen(true);
  };

  const placeOrder = async (expectedTotal: number) => {
    if (placing) return;
    if (!coords) return toast.error("Please set your delivery location on the map");
    if (orderFor === "other" && receiver.name.trim().length < 2) {
      return toast.error("Enter the receiver's name");
    }
    const deliveryPhone = orderFor === "other" ? receiver.phone : addr.deliveryPhone;
    const deliveryAddress = orderFor === "other" ? receiver.address : addr.deliveryAddress;
    if (orderFor === "self" && !/^[6-9]\d{9}$/.test(deliveryPhone)) return toast.error("Enter a valid 10-digit mobile number");
    if (orderFor === "other" && !/^[6-9]\d{9}$/.test(deliveryPhone)) return toast.error("Enter a valid 10-digit mobile number");
    if (deliveryAddress.trim().length < 8) return toast.error("Please enter full delivery address");
    setPlacing(true);
    try {
      const res = await postPlaceOrder({
        restaurantId: id,
        items: quoteItems,
        deliveryAddress,
        deliveryPhone,
        orderFor,
        recipientName: orderFor === "other" ? receiver.name : undefined,
        notes: addr.notes || undefined,
        paymentMethod: addr.paymentMethod,
        deliveryLat: coords.lat,
        deliveryLng: coords.lng,
        expectedTotal,
      });
      setCart({});
      setPriceUpdated(null);
      if (addr.paymentMethod === "wallet") setCheckoutOpen(false);
      if (orderFor === "self" && saveNewAddress && selectedAddressId === null && savedAddresses.length < 10) {
        const address = addr.deliveryAddress.trim();
        const phone = addr.deliveryPhone;
        const location = coords;
        const label = savedAddresses.some((saved) => saved.label === "Home") ? "Other" : "Home";
        void postCustomerAddressAction({
          action: "create",
          label,
          address,
          town: r.town,
          phone,
          ...(location ? { lat: location.lat, lng: location.lng } : {}),
        }).then(() => queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.addresses }))
          .catch((error: unknown) => console.error("Could not save checkout address:", error));
      }
      if (addr.paymentMethod === "upi") {
        if (!res.payment) {
          toast.error("Online payment details are missing. You can retry from My orders.");
          navigate("/orders");
          return;
        }
        await startPayment(res.orderId, res.payment, {
          onBeforeCheckoutOpen: () => setCheckoutOpen(false),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.customerOrders });
        void queryClient.invalidateQueries({ queryKey: ziptoHooks.keys.wallet });
        toast.success(`Order #${res.orderId} placed – paid from platr™ Wallet`);
        navigate("/orders");
      }
    } catch (e) {
      if (e instanceof PriceChangedError) {
        queryClient.setQueryData(quoteKey, e.quote);
        setPriceUpdated({ message: e.message, quote: e.quote });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not place order");
      }
    } finally {
      setPlacing(false);
    }
  };

  const proceedFromCart = () => {
    setCartSheetOpen(false);
    openCheckout();
  };
  const defaultAddress = savedAddresses.find((address) => address.isDefault);
  const cartViewProps = {
    lines,
    onChange: change,
    deliverTo: defaultAddress
      ? {
          title: defaultAddress.label,
          address: [defaultAddress.address, defaultAddress.landmark, defaultAddress.town]
            .filter(Boolean).join(", "),
        }
      : null,
    onAddressClick: proceedFromCart,
    quote,
    isFetching: quoteLoading,
    error: quoteQuery.error,
    availability: !quoteLoading && !quoteQuery.isError
      ? <CustomerQuoteAvailability quote={quote} locating={locating} onUseLocation={useLocation} />
      : null,
    platformFee: settingsQuery.data?.platformFee ?? 0,
    payLabel: `PROCEED TO PAY (${quoteTotal})`,
    onProceed: proceedFromCart,
    proceedDisabled: !data?.restaurant.isOpen || !canCheckout,
  };

  if (error) return <div className={styles.state}>{error instanceof Error ? error.message : "Restaurant not found."} <Link to="/">Back to home</Link></div>;
  if (!data && isFetching) return <Skeleton className={styles.heroSkel} />;
  if (!data) return null;
  const r = data.restaurant;

  return (
    <div className={styles.page}>
      <Helmet><title>{`${r.name} – platr™`}</title></Helmet>
      <Link to="/" className={styles.back}><ArrowLeft size={16} /> All restaurants</Link>
      <section className={styles.hero}>
        <img className={styles.heroImage} src={ziptoHooks.coverFor(r.id, r.imageUrl)} alt="" />
        <div className={styles.shade} />
        <div className={styles.heroText}>
          {!r.isOpen && <span className={styles.closed}>Closed right now</span>}
          {r.profileImageUrl && <img className={styles.profilePhoto} src={r.profileImageUrl} alt={`${r.name} display photo`} />}
          <h1>{r.name}</h1>
          <RestaurantRatingStars
            className={styles.ratingStars}
            ratingAverage={r.ratingAverage}
            ratingCount={r.ratingCount}
          />
          <p>{r.cuisine || r.description}</p>
          <div className={styles.meta}>
            <span><MapPin size={14} /> {r.address}, {r.town}</span>
            <span><Clock size={14} /> {r.avgPrepMinutes + 15}–{r.avgPrepMinutes + 30} min</span>
          </div>
        </div>
      </section>

      <details className={styles.findUs}>
        <summary className={styles.findUsHeader}>
          <span>
            <b className={styles.findUsTitle}>Find us</b>
            <span className={styles.findUsAddress}>{r.address}, {r.town}, Uttarakhand</span>
          </span>
          <span className={styles.mapPrompt}>View map</span>
        </summary>
        <div className={styles.mapDetails}>
          <a className={styles.mapsLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address + ", " + r.town + ", Uttarakhand")}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
          <iframe className={styles.mapFrame} title={`Map to ${r.name}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(r.address + ", " + r.town + ", Uttarakhand")}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </details>

      <div className={styles.layout}>
        <RestaurantMenu
          menu={menu}
          cart={cart}
          isOpen={r.isOpen}
          onChange={change}
        />
        <CustomerCartView {...cartViewProps} variant="panel" className={styles.cart} />
      </div>

      <RestaurantCartSheet
        {...cartViewProps}
        count={count}
        total={quoteTotal}
        open={cartOpen}
        onOpenChange={setCartSheetOpen}
      />

      <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!placing) setCheckoutOpen(open); }}>
        <DialogContent className={styles.dialog}>
          <DialogHeader>
            <DialogTitle>Delivery details</DialogTitle>
          </DialogHeader>
          <div className={styles.field}>
            <span>Ordering for</span>
            <ToggleGroup type="single" value={orderFor} onValueChange={changeOrderFor} aria-label="Ordering for">
              <ToggleGroupItem value="self">Myself</ToggleGroupItem>
              <ToggleGroupItem value="other">Someone else</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {orderFor === "self" ? (
            <>
              <CheckoutAddressPicker
                addresses={savedAddresses}
                selectedId={selectedAddressId}
                onSelect={selectAddress}
                saveNewAddress={saveNewAddress}
                onSaveNewAddressChange={setSaveNewAddress}
                isFetching={addressesQuery.isFetching}
                error={addressesQuery.error}
              />
              <label className={styles.field}>
                <span>Mobile number</span>
                <Input inputMode="numeric" maxLength={10} value={addr.deliveryPhone} onChange={(e) => setAddr({ ...addr, deliveryPhone: e.target.value.replace(/\D/g, "") })} placeholder="98XXXXXXXX" />
              </label>
              <label className={styles.field}>
                <span>Full address (house no., street, landmark)</span>
                <Textarea rows={3} value={addr.deliveryAddress} onChange={(e) => setAddr({ ...addr, deliveryAddress: e.target.value })} placeholder={`House 12, near ..., ${r.town}`} />
              </label>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>Receiver&apos;s name</span>
                <Input maxLength={60} value={receiver.name} onChange={(e) => setReceiver((current) => ({ ...current, name: e.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Receiver&apos;s mobile number</span>
                <Input inputMode="numeric" maxLength={10} value={receiver.phone} onChange={(e) => setReceiver((current) => ({ ...current, phone: e.target.value.replace(/\D/g, "") }))} placeholder="98XXXXXXXX" />
              </label>
              <label className={styles.field}>
                <span>Receiver&apos; full address (house no., street, landmark)</span>
                <Textarea rows={3} value={receiver.address} onChange={(e) => setReceiver((current) => ({ ...current, address: e.target.value }))} placeholder={`House 12, near ..., ${r.town}`} />
              </label>
            </>
          )}
          <LocationPinPicker
            key={orderFor}
            lat={coords?.lat ?? null}
            lng={coords?.lng ?? null}
            onChange={setCoords}
            autoLocate={orderFor === "self" && coords === null}
            label={orderFor === "self" ? "Pin exact delivery location" : "Pin the receiver's location"}
            helpText={orderFor === "other" ? "Tap the map or drag the pin to the receiver's house." : undefined}
          />
          <p className={styles.muted}>Rider uses this pin to reach you. Turn on location for best accuracy.</p>
          {!coords && <p className={styles.pinHint} role="status">Set the delivery pin to continue</p>}
          <label className={styles.field}>
            <span>Note for restaurant (optional)</span>
            <Input value={addr.notes} onChange={(e) => setAddr({ ...addr, notes: e.target.value })} placeholder="Less spicy, no onion..." />
          </label>
          <div className={styles.payTitle}>Payment</div>
          <div className={styles.payOptions}>
            <div className={styles.walletOption}>
              <button
                type="button"
                className={`${styles.payChoice} ${addr.paymentMethod === "wallet" ? styles.paySelected : ""}`}
                aria-pressed={addr.paymentMethod === "wallet"}
                disabled={walletBalance === undefined || walletQuery.isFetching || walletShortfall > 0}
                onClick={() => {
                  setPaymentTouched(true);
                  setAddr((current) => ({ ...current, paymentMethod: "wallet" }));
                }}
              >
                <Wallet size={20} /> <b>platr™ Wallet</b>
                <small>{walletBalance === undefined ? "Loading balance…" : `Balance ${ziptoConfig.rupees(walletBalance)}`}</small>
              </button>
              {walletBalance !== undefined && walletShortfall > 0 && (
                <Button type="button" variant="outline" disabled={walletQuery.isFetching} onClick={() => setTopupOpen(true)}>
                  Add {ziptoConfig.rupees(walletShortfall)}
                </Button>
              )}
              {walletQuery.error && <small className={styles.walletError} role="alert">{walletQuery.error.message}</small>}
            </div>
            <button
              type="button"
              className={`${styles.payChoice} ${addr.paymentMethod === "upi" ? styles.paySelected : ""}`}
              aria-pressed={addr.paymentMethod === "upi"}
              onClick={() => {
                setPaymentTouched(true);
                setAddr((current) => ({ ...current, paymentMethod: "upi" }));
              }}
            >
              <Smartphone size={20} /> <b>Pay online</b>
              <small>UPI · Cards · Netbanking · Wallets · EMI · Pay Later</small>
            </button>
          </div>
          <p className={styles.muted}>
            Online payments are secured by Razorpay. Cancelled orders are refunded to the original payment method (wallet orders back to your platr™ Wallet). <Link to="/terms">Terms</Link>
          </p>
          {count > 0 && (
            <>
              <CustomerQuoteBill quote={quote} isFetching={quoteLoading} error={quoteQuery.error} totalLabel="Total payable" />
              {!quoteLoading && !quoteQuery.isError && (
                <CustomerQuoteAvailability quote={quote} locating={locating} onUseLocation={useLocation} />
              )}
            </>
          )}
          <Button size="lg" onClick={() => {
            if (quote && canCheckout && coords) void placeOrder(quote.total);
          }} disabled={placing || !canCheckout || !coords}>
            {placing ? <Spinner size="sm" /> : null} Place order · {quoteTotal}
          </Button>
        </DialogContent>
      </Dialog>

      {walletBalance !== undefined && (
        <WalletTopupSheet
          open={topupOpen}
          onOpenChange={setTopupOpen}
          onBeforeCheckoutOpen={() => setCheckoutOpen(false)}
          balance={walletBalance}
          initialAmount={Math.max(100, Math.ceil(walletShortfall / 10) * 10)}
        />
      )}

      <PriceUpdatedDialog
        data={priceUpdated}
        placing={placing}
        confirmDisabled={!coords || (addr.paymentMethod === "wallet" && (walletBalance === undefined || (priceUpdated !== null && walletBalance < priceUpdated.quote.total)))}
        onCancel={() => setPriceUpdated(null)}
        onConfirm={() => { if (priceUpdated) void placeOrder(priceUpdated.quote.total); }}
      />
    </div>);
}