import { useEffect, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";
import { CustomerOrderTimeline } from "./CustomerOrderTimeline";
import { LiveTrackingMap } from "./LiveTrackingMap";
import { OrderCallButton } from "./OrderCallButton";
import { CallSupportButton } from "./CallSupportButton";
import { RiderLiveMap } from "./RiderLiveMap";
import { Skeleton } from "./Skeleton";
import { useRealtimeConnectionStatus } from "./FlootRealtimeProvider";
import {
  formatElapsed,
  formatOrderTime,
  getLocationAge,
  getTrackingDisplay,
} from "../helpers/customerTrackingDisplay";
import type { OrderView } from "../helpers/orderView";
import { useCustomerRiderLocation } from "../helpers/useCustomerRiderLocation";
import { useIsMobile } from "../helpers/useIsMobile";
import { useOrderLiveRoute } from "../helpers/useOrderLiveRoute";
import styles from "./CustomerOrderTracker.module.css";

export type CustomerOrderTrackerProps = {
  order: OrderView;
  className?: string;
};

export function CustomerOrderTracker({
  order,
  className,
}: CustomerOrderTrackerProps) {
  const riderLocation = useCustomerRiderLocation(order);
  const connection = useRealtimeConnectionStatus();
  const isMobile = useIsMobile();
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const trackingActive = !["cancelled", "rejected", "delivered"].includes(order.status);
  const riderAssigned = order.riderId !== null;
  const routeQuery = useOrderLiveRoute(
    order.id,
    trackingActive &&
      riderAssigned &&
      ["accepted", "preparing", "ready", "picked_up"].includes(order.status),
    riderLocation?.at ?? null,
  );
  const route = trackingActive ? routeQuery.data?.route : null;
  const age = getLocationAge(riderLocation?.at ?? null, now);
  const display = getTrackingDisplay(order, route, riderLocation, now);
  const riderName = order.riderName?.trim() || "Your rider";

  const locationStatus =
    age.state === "lost"
      ? "Live location unavailable"
      : age.state === "stale"
        ? `Last update ${formatElapsed(age.seconds ?? 0)} — rider's phone may be offline. Updates resume automatically.`
        : connection !== "connected"
          ? "Reconnecting…"
          : age.state === "fresh"
            ? `Live · updated ${formatElapsed(age.seconds ?? 0)}`
            : "Waiting for rider's live location…";
  const locationTone =
    age.state === "lost" || age.state === "unavailable"
      ? styles.unavailable
      : age.state === "stale" || connection !== "connected"
        ? styles.warning
        : styles.live;

  return (
    <section
      className={`${styles.root} ${className ?? ""}`}
      aria-label={`Tracking order number ${order.id}`}
    >
      {trackingActive ? (
        <>
          <div className={styles.hero}>
            <p className={styles.eyebrow}>Your order · {order.restaurantName}</p>
            <h2 className={styles.heroTitle}>{display.headline}</h2>
            {routeQuery.isFetching && !routeQuery.data && riderAssigned ? (
              <Skeleton className={styles.subtitleSkeleton} aria-label="Loading live route" />
            ) : display.subline ? (
              <p className={styles.heroSubline}>{display.subline}</p>
            ) : null}
            {routeQuery.isError && (
              <p className={styles.routeError} role="alert">
                Live route couldn&apos;t load: {routeQuery.error.message}
              </p>
            )}
          </div>

          {riderAssigned && (
            <div className={styles.mapSection}>
              {riderLocation === null && !googleUnavailable ? (
                <div className={styles.mapWaiting} role="status">
                  Waiting for rider&apos;s live location…
                </div>
              ) : googleUnavailable ? (
                <RiderLiveMap
                  riderLat={riderLocation?.lat ?? null}
                  riderLng={riderLocation?.lng ?? null}
                  updatedAt={riderLocation?.at ?? null}
                  restaurantLat={order.restaurantLat}
                  restaurantLng={order.restaurantLng}
                  destinationLat={order.deliveryLat}
                  destinationLng={order.deliveryLng}
                  destinationLabel="Your delivery location"
                  distanceTo={order.status === "picked_up" ? "destination" : "restaurant"}
                  distanceLabel={
                    order.status === "picked_up"
                      ? "{distance} from you"
                      : "Rider is {distance} from restaurant"
                  }
                  riderName={order.riderName}
                />
              ) : (
                <LiveTrackingMap
                  riderLat={riderLocation?.lat ?? null}
                  riderLng={riderLocation?.lng ?? null}
                  riderAt={riderLocation?.at ?? null}
                  restaurantLat={order.restaurantLat}
                  restaurantLng={order.restaurantLng}
                  destinationLat={order.deliveryLat}
                  destinationLng={order.deliveryLng}
                  target={order.status === "picked_up" ? "destination" : "restaurant"}
                  encodedPolyline={route?.encodedPolyline ?? null}
                  riderName={order.riderName}
                  onUnavailable={() => setGoogleUnavailable(true)}
                />
              )}
              <div
                className={`${styles.locationStatus} ${locationTone}`}
                role="status"
                aria-live="polite"
              >
                <span className={styles.statusDot} aria-hidden="true" />
                {locationStatus}
              </div>
            </div>
          )}

          <div className={styles.partnerCard}>
            {riderAssigned ? (
              <>
                <div className={styles.partnerHeading}>
                  <span className={styles.avatar} aria-hidden="true">
                    {order.riderName?.trim()
                      ? order.riderName.trim().charAt(0).toLocaleUpperCase()
                      : <UserRound size={20} />}
                  </span>
                  <div className={styles.partnerInfo}>
                    <strong className={styles.partnerName}>{riderName}</strong>
                    <span className={styles.partnerVehicle}>
                      {order.riderVehicleType || "platr™ rider"}
                    </span>
                  </div>
                  <span className={styles.verified}>Verified platr™ partner</span>
                </div>
                <p className={styles.partnerMessage}>
                  {order.status === "picked_up"
                    ? `${riderName} is bringing your order`
                    : `${riderName} is on the way to pick up your order`}
                </p>
              </>
            ) : (
              <p className={styles.waiting} role="status">
                {order.deliveryAtRiskAt
                  ? "Delivery partner dhoondh rahe hain — thoda time lag sakta hai. Agar koi rider nahi mila, aapko 100% refund milega (food, delivery aur fees) — koi cancellation fee nahi."
                  : "Waiting for a rider to accept…"}
              </p>
            )}
            <div className={styles.calls}>
              {riderAssigned && (
                <OrderCallButton orderId={order.id} target="rider" label="Call rider" />
              )}
              <OrderCallButton
                orderId={order.id}
                target="restaurant"
                label="Call restaurant"
              />
              <CallSupportButton label="Call support" variant="outline" />
            </div>
            <p className={styles.privacy}>Rider/restaurant calls stay private. platr™ support opens your phone dialler.</p>
          </div>
        </>
      ) : (
        <div className={styles.ended} role="status">
          {order.status === "delivered"
            ? `Delivered — enjoy your meal!${formatOrderTime(order.deliveredAt) ? ` · ${formatOrderTime(order.deliveredAt)}` : ""}`
            : order.status === "cancelled" &&
                order.cancelCode === "PLATFORM_DELIVERY_FAILURE"
              ? `No delivery partner was available, so this order was cancelled. 100% refund — food, delivery and fees — ${order.paymentStatus === "refunded" ? "has been refunded" : "is on its way (wallet: instantly; UPI/card: 5–7 working days)"}. No cancellation fee.`
              : `This order was ${order.status}. Live tracking is no longer available.`}
        </div>
      )}

      {(trackingActive || order.status === "delivered") && (
        <CustomerOrderTimeline
          order={order}
          arrivingSoon={trackingActive && display.arrivingSoon}
        />
      )}

      <Collapsible
        key={isMobile ? "mobile" : "desktop"}
        defaultOpen={!isMobile}
        className={styles.summary}
      >
        <CollapsibleTrigger className={styles.summaryTrigger}>
          <span className={styles.summaryName}>{order.restaurantName}</span>
          <span className={styles.summaryMeta}>
            Order #{order.id} · {order.items.reduce((count, item) => count + item.quantity, 0)} items
          </span>
          <strong className={styles.summaryTotal}>
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(order.total)}
          </strong>
          <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={styles.summaryContent}>
            {order.items.map((item, index) => (
              <div className={styles.item} key={`${item.name}-${index}`}>
                <span>{item.quantity} × {item.name}</span>
                <span>
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(item.price * item.quantity)}
                </span>
              </div>
            ))}
            <p className={styles.deliveryPin}>Delivery to: your saved pin</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}