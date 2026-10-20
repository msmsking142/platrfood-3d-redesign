import { useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Clock3, MapPin, ReceiptText } from "lucide-react";
import type { OutputType } from "../endpoints/rider/dashboard_GET.schema";
import { postRiderAction } from "../endpoints/rider/action_POST.schema";
import { riderOrderRoute, riderOrderTimeAgo } from "../helpers/riderOrderUtils";
import { mapNavigation } from "../helpers/mapNavigation";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { CallSupportButton } from "./CallSupportButton";
import { OrderCallButton } from "./OrderCallButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { MerchantCard, MerchantEmpty, MerchantSectionHeader } from "./MerchantUi";
import { StatusPill } from "./StatusPill";
import { RiderLiveMap } from "./RiderLiveMap";
import styles from "./RiderOrders.module.css";

const steps = ["accepted", "preparing", "ready", "picked_up", "delivered"] as const;
const stepLabels = ["Accepted", "Preparing", "Ready", "Picked up", "Delivered"];

export const RiderOrders = ({
  data,
  onGoOnline,
  onlinePending,
  className,
}: {
  data: OutputType;
  onGoOnline: () => void;
  onlinePending: boolean;
  className?: string;
}) => {
  const rider = data.rider;
  if (!rider) throw new Error("RiderOrders requires a registered rider");

  const [confirmCodId, setConfirmCodId] = useState<number | null>(null);
  const action = ziptoHooks.useAction(
    postRiderAction,
    [ziptoHooks.keys.riderDashboard],
    "Delivery updated",
  );
  const active = data.mine.filter((order) =>
    ["accepted", "preparing", "ready", "picked_up"].includes(order.status),
  );
  const codOrder = active.find((order) => order.id === confirmCodId);

  const complete = async (orderId: number) => {
    try {
      await action.mutateAsync({ action: "delivered", orderId });
      setConfirmCodId(null);
    } catch (error) {
      console.error("Could not complete rider delivery:", error);
    }
  };

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <MerchantSectionHeader
        eyebrow="Orders"
        title="Available orders"
        subtitle="Nearby orders go to the first rider who accepts. You can carry up to 2 active deliveries."
      />

      {rider.status !== "approved" ? (
        <MerchantEmpty
          icon={<ReceiptText size={32} />}
          title="Verification needed"
          text="Finish verification before you can accept orders."
          action={<Button asChild><Link to="/rider?section=verification">View verification</Link></Button>}
        />
      ) : !rider.isOnline ? (
        <MerchantEmpty
          icon={<Bike size={32} />}
          title="You're offline"
          text="Go online to see orders available in your town."
          action={<Button size="lg" disabled={onlinePending} onClick={onGoOnline}>Go online</Button>}
        />
      ) : data.available.length === 0 ? (
        <MerchantEmpty
          icon={<ReceiptText size={32} />}
          title="No new orders right now"
          text={`You're online in ${rider.town}. New orders will appear here.`}
        />
      ) : (
        <div className={styles.availableList}>
          {data.available.map((order) => (
            <MerchantCard key={order.id} className={styles.orderCard}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.kicker}>Order #{order.id}</span>
                  <h2>{order.restaurantName}</h2>
                  <span className={styles.time}><Clock3 size={15} aria-hidden="true" /> {riderOrderTimeAgo(order.createdAt)}</span>
                </div>
                <div className={styles.payout}>
                  <span>You earn</span>
                  <strong>{ziptoConfig.rupees(order.riderPayout)}</strong>
                </div>
              </div>
              <p className={styles.payBreakdown}>
                Base {ziptoConfig.rupees(order.riderBasePay)} + Distance {ziptoConfig.rupees(order.riderDistancePay)} + Incentive {ziptoConfig.rupees(order.riderBonus)}
                {order.distanceM !== null && (
                  <span> · ~{(order.distanceM / 1000).toFixed(1)} km{order.distanceSource === "estimated" ? " est." : ""}</span>
                )}
              </p>
              <div className={styles.route}>
                <p><b>Pickup</b><span>{order.restaurantAddress}</span></p>
                <p><b>Drop</b><span>{order.deliveryAddress}</span></p>
              </div>
              <p className={styles.items}>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</p>
              <p className={styles.payment}>
                {order.paymentMethod === "cod"
                  ? `COD · Collect ${ziptoConfig.rupees(order.total)} cash`
                  : "Online payment"}
              </p>
              <div className={styles.actions}>
                <Button variant="secondary" asChild>
                  <a href={riderOrderRoute(order)} target="_blank" rel="noreferrer">
                    <MapPin size={17} aria-hidden="true" /> Open route
                  </a>
                </Button>
                <Button
                  size="lg"
                  disabled={action.isPending || active.length >= 2}
                  onClick={() => action.mutate({ action: "accept", orderId: order.id })}
                >
                  Accept order
                </Button>
              </div>
            </MerchantCard>
          ))}
        </div>
      )}

      <div className={styles.sectionHeading}>
        <h2>My active deliveries</h2>
        <span>{active.length} / 2 active</span>
      </div>

      {active.length === 0 ? (
        <MerchantEmpty
          icon={<Bike size={32} />}
          title="No active deliveries"
          text="Orders you accept will show here until completed."
        />
      ) : (
        <div className={styles.activeList}>
          {active.map((order) => {
            const currentStep = steps.indexOf(order.status as (typeof steps)[number]);
            return (
              <MerchantCard key={order.id} className={styles.activeCard}>
                <div className={styles.cardHead}>
                  <div>
                    <span className={styles.kicker}>Order #{order.id}</span>
                    <h3>{order.restaurantName}</h3>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <p className={styles.payBreakdown}>
                  <strong>You earn {ziptoConfig.rupees(order.riderPayout)}</strong>
                  <span> · Base {ziptoConfig.rupees(order.riderBasePay)} + Distance {ziptoConfig.rupees(order.riderDistancePay)} + Incentive {ziptoConfig.rupees(order.riderBonus)}</span>
                </p>
                <ol className={styles.stepper} aria-label={`Delivery progress: ${ziptoConfig.orderStatusLabel[order.status] ?? order.status}`}>
                  {stepLabels.map((label, index) => (
                    <li key={label} className={index <= currentStep ? styles.stepDone : ""}>
                      <span className={styles.stepDot} aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ol>
                <div className={styles.deliveryDetails}>
                  {order.recipientName ? (
                    <>
                      <p><b>Deliver to:</b> {order.recipientName}</p>
                      <p><b>Ordered by</b> {order.customerName}</p>
                    </>
                  ) : (
                    <p><b>Customer</b> {order.customerName}</p>
                  )}
                  <p><b>Pickup</b> {order.restaurantAddress}</p>
                  <p><b>Drop</b> {order.deliveryAddress}</p>
                  {order.notes && <p><b>Note</b> {order.notes}</p>}
                  {order.paymentMethod === "cod" && (
                    <p><b>Collect cash</b> {ziptoConfig.rupees(order.total)}</p>
                  )}
                </div>
                <RiderLiveMap
                  riderLat={order.riderLat}
                  riderLng={order.riderLng}
                  updatedAt={order.riderLocationAt}
                  restaurantLat={order.restaurantLat}
                  restaurantLng={order.restaurantLng}
                  destinationLat={order.deliveryLat}
                  destinationLng={order.deliveryLng}
                  destinationLabel="Customer"
                  distanceTo={order.status === "picked_up" ? "destination" : "restaurant"}
                  riderName={order.riderName}
                />
                <div className={styles.actions}>
                  <CallSupportButton label="Call platr™ support" variant="outline" />
                </div>
                <p className={styles.locationNote}>Keep location ON while delivering so the customer and restaurant can track you.</p>
                <div className={styles.actions}>
                  <Button variant="secondary" asChild>
                    <a
                      href={order.status === "picked_up"
                        ? mapNavigation.directionsUrl({
                            lat: order.deliveryLat,
                            lng: order.deliveryLng,
                            address: order.deliveryAddress,
                            town: order.town,
                          })
                        : mapNavigation.directionsUrl({
                            lat: order.restaurantLat,
                            lng: order.restaurantLng,
                            address: order.restaurantAddress,
                            town: order.town,
                          })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={17} aria-hidden="true" />
                      {order.status === "picked_up" ? "Navigate to customer" : "Navigate to restaurant"}
                    </a>
                  </Button>
                  <OrderCallButton
                    orderId={order.id}
                    target="customer"
                    label="Call customer"
                  />
                  <OrderCallButton
                    orderId={order.id}
                    target="restaurant"
                    label="Call restaurant"
                  />
                  <small>🔒 Numbers stay private</small>
                  {order.status === "ready" && (
                    <Button
                      size="lg"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ action: "picked_up", orderId: order.id })}
                    >
                      Mark picked up
                    </Button>
                  )}
                  {order.status === "picked_up" && (
                    <Button
                      size="lg"
                      disabled={action.isPending}
                      onClick={() =>
                        order.paymentMethod === "cod"
                          ? setConfirmCodId(order.id)
                          : void complete(order.id)
                      }
                    >
                      Mark delivered
                    </Button>
                  )}
                </div>
              </MerchantCard>
            );
          })}
        </div>
      )}

      <Dialog open={confirmCodId !== null} onOpenChange={(open) => !open && setConfirmCodId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm cash collection</DialogTitle>
            <DialogDescription>
              Collected {codOrder ? ziptoConfig.rupees(codOrder.total) : "the order total"} cash from the customer?
              Only mark this COD order delivered once you have the cash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCodId(null)}>Not yet</Button>
            <Button disabled={action.isPending || !codOrder} onClick={() => codOrder && void complete(codOrder.id)}>
              {action.isPending ? "Updating…" : "Cash collected · Deliver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};