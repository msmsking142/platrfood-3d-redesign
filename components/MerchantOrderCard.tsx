import { useState } from "react";
import { Bike, Clock, StickyNote } from "lucide-react";
import type { OrderView } from "../helpers/orderView";
import { distanceInMeters } from "../helpers/geoDistance";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { Button } from "./Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";
import { OrderCallButton } from "./OrderCallButton";
import { RestaurantSettlement } from "./RestaurantSettlement";
import { RiderLiveMap } from "./RiderLiveMap";
import { StatusPill } from "./StatusPill";
import styles from "./MerchantOrderCard.module.css";

export function MerchantOrderCard({
  order,
  avgPrepMinutes,
  restaurantLat,
  restaurantLng,
  location,
  now,
  pending,
  onReject,
  onAction,
  compact,
  className,
}: {
  order: OrderView;
  avgPrepMinutes: number;
  restaurantLat: number | null;
  restaurantLng: number | null;
  location?: { lat: number; lng: number; at: Date | string };
  now: number;
  pending: boolean;
  onReject: (id: number) => void;
  onAction: (input: Parameters<typeof postRestaurantAction>[0]) => void;
  compact: boolean;
  className?: string;
}) {
  const [showSettlement, setShowSettlement] = useState(false);
  const placed = order.status === "placed";
  const preparing = order.status === "accepted" || order.status === "preparing";
  const ready = order.status === "ready" || order.status === "picked_up";
  const riderLat = location?.lat ?? order.riderLat;
  const riderLng = location?.lng ?? order.riderLng;
  const riderAt = location?.at ?? order.riderLocationAt;
  const elapsedMinutes = Math.max(0, (now - new Date(order.createdAt).getTime()) / 60000);
  const remainingSeconds = Math.max(0, Math.ceil((new Date(order.createdAt).getTime() + 180000 - now) / 1000));
  const eta =
    riderLat !== null && riderLng !== null && restaurantLat !== null && restaurantLng !== null
      ? Math.max(1, Math.ceil((distanceInMeters(riderLat, riderLng, restaurantLat, restaurantLng) / 1000 / 20) * 60))
      : null;
  const total = order.itemsTotal - order.restaurantDiscount;

  return (
    <article className={`${styles.card} ${placed ? styles.newOrder : ""} ${className ?? ""}`}>
      <header className={styles.heading}>
        <div>
          {compact ? <StatusPill status={order.status} /> : <strong>{placed ? "New Order" : preparing ? "Preparing" : order.status === "picked_up" ? "Picked up" : order.status === "cancelled" && order.cancelCode === "PLATFORM_DELIVERY_FAILURE" ? "Cancelled by platr™" : "Ready for Pickup"}</strong>}
          <small>
            {placed
              ? `Time placed: ${new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
              : new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </small>
        </div>
        <span className={styles.id}>#ZIP-{order.id}</span>
      </header>

      {order.status === "cancelled" && order.cancelCode === "PLATFORM_DELIVERY_FAILURE" && (
        <p className={styles.failureNote}>
          Cancelled by platr™ — no delivery partner. See Finance → Delivery failure compensation.
        </p>
      )}

      {compact ? (
        <div className={styles.compactTotal}>
          <span>{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</span>
          <strong>{ziptoConfig.rupees(total)}</strong>
        </div>
      ) : (
        <>
          <ul className={styles.items}>
            {order.items.map((item, index) => (
              <li key={index}>
                <strong>{item.quantity}x {item.name}</strong>
                <span>{ziptoConfig.rupees(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className={styles.note}><StickyNote size={16} /> {order.notes}</p>}

          {placed && (
            <div className={styles.urgency} role="timer" aria-label={remainingSeconds ? `${remainingSeconds} seconds to accept within the recommended window` : "Recommended acceptance window passed"}>
              <span className={styles.urgencyIcon}><Clock size={24} aria-hidden="true" /></span>
              {remainingSeconds > 0 ? (
                <strong>Accept in <em>{remainingSeconds}s</em></strong>
              ) : (
                <strong className={styles.overdue}>Waiting {Math.floor(elapsedMinutes)} min — accept now</strong>
              )}
            </div>
          )}

          {preparing && (
            <>
              <div className={styles.prepStatus}>
                <Clock size={18} aria-hidden="true" />
                <strong>{Math.max(0, Math.ceil(avgPrepMinutes - elapsedMinutes)) > 0
                  ? `Ready in ${Math.ceil(avgPrepMinutes - elapsedMinutes)} mins`
                  : "Ready soon — mark ready"}</strong>
              </div>
              <progress className={styles.progress} max={100} value={Math.min(100, avgPrepMinutes > 0 ? elapsedMinutes / avgPrepMinutes * 100 : 100)} aria-label="Estimated preparation progress" />
            </>
          )}

          {(preparing || ready) && (
            <>
              <p className={styles.rider}>
                <Bike size={17} aria-hidden="true" />
                {order.riderName
                  ? `Assigned Rider: ${order.riderName}${eta === null ? "" : ` (${eta} min away)`}`
                  : order.riderId !== null
                    ? "Rider assigned"
                    : "Finding a rider nearby…"}
              </p>
              {order.riderId !== null && order.status !== "picked_up" && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">Track rider</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <RiderLiveMap
                      className={styles.map}
                      riderLat={riderLat}
                      riderLng={riderLng}
                      updatedAt={riderAt}
                      riderName={order.riderName}
                      restaurantLat={restaurantLat}
                      restaurantLng={restaurantLng}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}
              {order.riderId === null && order.status !== "picked_up" && (
                <>
                  {order.deliveryAtRiskAt && (
                    <p className={styles.riskNote}>
                      Rider search expanded — delivery at risk. Keep preparing; mark READY on time.
                      If no rider is found you&apos;ll be compensated per platr™&apos;s delivery protection.
                    </p>
                  )}
                  {order.riderSearchStage === "priority" && (
                    <p className={styles.riskNote}>Priority rider search active</p>
                  )}
                </>
              )}
              {ready && <p className={styles.readyText}>{order.status === "picked_up" ? "Picked up" : order.riderName ? "Rider on the way" : "Waiting for rider"}</p>}
            </>
          )}

          {(placed || preparing) && (
            <div className={styles.actions}>
              {placed && <Button variant="secondary" disabled={pending} onClick={() => onReject(order.id)}>REJECT</Button>}
              {placed && <Button disabled={pending} onClick={() => onAction({ action: "order", orderId: order.id, to: "accepted" })}>ACCEPT</Button>}
              {order.status === "accepted" && <Button variant="secondary" disabled={pending} onClick={() => onAction({ action: "order", orderId: order.id, to: "preparing" })}>Start preparing</Button>}
              {preparing && <Button disabled={pending} onClick={() => onAction({ action: "order", orderId: order.id, to: "ready" })}>Mark ready</Button>}
            </div>
          )}

          {(placed || preparing || ready) && (
            <div className={styles.calls}>
              {order.riderId !== null && !placed && (
                <OrderCallButton orderId={order.id} target="rider" label="Call rider" variant="outline" size="sm" />
              )}
              <OrderCallButton
                orderId={order.id}
                target="customer"
                label="Call customer"
                variant="outline"
                size="sm"
                disabledReason={order.customerAllowsCalls ? undefined : "Customer hasn't allowed restaurant calls"}
              />
              <small>🔒 Numbers stay private</small>
            </div>
          )}

          <div className={styles.footer}>
            <Button variant="ghost" size="sm" onClick={() => setShowSettlement((value) => !value)} aria-expanded={showSettlement}>
              {showSettlement ? "Hide settlement" : "View settlement"}
            </Button>
            {showSettlement && <RestaurantSettlement compact order={order} />}
            <small>{order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "wallet" ? "platr™ Wallet" : "Online"} · {order.paymentStatus}</small>
          </div>
        </>
      )}
    </article>
  );
}