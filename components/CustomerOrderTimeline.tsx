import {
  Bike,
  ChefHat,
  Check,
  House,
  MapPin,
  Navigation,
  PackageCheck,
  ReceiptText,
  Store,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OrderView } from "../helpers/orderView";
import { formatOrderTime } from "../helpers/customerTrackingDisplay";
import styles from "./CustomerOrderTimeline.module.css";

export type CustomerOrderTimelineProps = {
  order: OrderView;
  arrivingSoon: boolean;
  className?: string;
};

type StepState = "done" | "current" | "upcoming";

type TimelineStep = {
  label: string;
  icon: ReactNode;
  state: StepState;
  at?: Date | null;
};

export function CustomerOrderTimeline({
  order,
  arrivingSoon,
  className,
}: CustomerOrderTimelineProps) {
  const status = order.status;
  const pickedUp = status === "picked_up" || status === "delivered";
  const delivered = status === "delivered";
  const searching =
    order.riderId !== null ||
    status === "ready" ||
    order.riderSearchStage !== null ||
    order.deliveryAtRiskAt !== null;

  const steps: TimelineStep[] = [
    {
      label: "Order confirmed",
      icon: <ReceiptText size={16} />,
      state: status === "placed" ? "current" : "done",
      at: order.createdAt,
    },
    {
      label: "Restaurant accepted",
      icon: <Store size={16} />,
      state: status === "placed" ? "upcoming" : status === "accepted" ? "current" : "done",
      at: order.restaurantAcceptedAt,
    },
    {
      label: "Preparing food",
      icon: <ChefHat size={16} />,
      state:
        status === "placed" || status === "accepted"
          ? "upcoming"
          : status === "preparing" || (status === "ready" && !searching)
            ? "current"
            : "done",
      at: order.preparingAt,
    },
    ...(searching
      ? [{
          label: order.riderId === null ? "Finding a delivery partner" : "Delivery partner assigned",
          icon: <Bike size={16} />,
          state: (pickedUp ? "done" : "current") as StepState,
          at: order.riderAssignedAt,
        }]
      : []),
    {
      label: "Picked up",
      icon: <PackageCheck size={16} />,
      state: pickedUp ? "done" : "upcoming",
    },
    {
      label: "On the way",
      icon: <Navigation size={16} />,
      state: delivered || arrivingSoon ? "done" : pickedUp ? "current" : "upcoming",
    },
    ...(arrivingSoon
      ? [{
          label: "Arriving soon",
          icon: <MapPin size={16} />,
          state: "current" as StepState,
        }]
      : []),
    {
      label: "Delivered",
      icon: <House size={16} />,
      state: delivered ? "done" : "upcoming",
      at: order.deliveredAt,
    },
  ];

  return (
    <section className={`${styles.timeline} ${className ?? ""}`} aria-label="Order progress">
      <h3 className={styles.heading}>Order progress</h3>
      <ol className={styles.steps}>
        {steps.map((step) => {
          const time = step.state === "done" ? formatOrderTime(step.at ?? null) : null;
          return (
            <li
              key={step.label}
              className={`${styles.step} ${styles[step.state]}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span className={styles.icon} aria-hidden="true">
                {step.state === "done" ? <Check size={16} strokeWidth={2.5} /> : step.icon}
              </span>
              <span className={styles.label}>{step.label}</span>
              {time && <span className={styles.time}>{time}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}