import { useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./Select";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { AdminDeliveryAvailability } from "./AdminDeliveryAvailability";
import { AdminDeliveryFailures } from "./AdminDeliveryFailures";
import { AdminDeliverySettings } from "./AdminDeliverySettings";
import { useAdminDeliveryReliability } from "../helpers/useAdminDeliveryReliability";
import type { ReliabilityMetrics } from "../endpoints/admin/delivery_reliability_GET.schema";
import styles from "./AdminDeliveryReliability.module.css";

const integer = new Intl.NumberFormat("en-IN");
const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function metricItems(metrics: ReliabilityMetrics) {
  const matchingSeconds = metrics.avgMatchingSeconds === null
    ? null
    : Math.max(0, Math.round(metrics.avgMatchingSeconds));
  return [
    { label: "Accepted orders", value: integer.format(metrics.acceptedOrders), detail: `${metrics.atRiskCount} marked at risk` },
    {
      label: "Rider matched",
      value: metrics.acceptedOrders
        ? `${(metrics.riderAssigned / metrics.acceptedOrders * 100).toFixed(1)}%`
        : "—",
      detail: `${integer.format(metrics.riderAssigned)} orders`,
    },
    {
      label: "Avg matching time",
      value: matchingSeconds === null
        ? "—"
        : `${Math.floor(matchingSeconds / 60)}:${String(matchingSeconds % 60).padStart(2, "0")}`,
      detail: "Minutes : seconds",
    },
    {
      label: "No-rider cancellations",
      value: integer.format(metrics.failures),
      detail: `${metrics.failureRatePct.toFixed(1)}% of accepted orders`,
    },
    {
      label: "Refunded to customers",
      value: money.format(metrics.refundAmount),
      detail: `${metrics.refundedCount} refunded · ${metrics.refundPendingCount} pending`,
    },
    {
      label: "Restaurant compensation cost",
      value: money.format(metrics.compensationCost),
      detail: "Approved compensation",
    },
    {
      label: "Rider search incentives paid",
      value: money.format(metrics.incentiveCost),
      detail: "On delivered orders",
    },
  ];
}

export function AdminDeliveryReliability({ className }: { className?: string }) {
  const [days, setDays] = useState(7);
  const { query, submit, isSaving } = useAdminDeliveryReliability(days);
  const data = query.data;

  return (
    <section className={`${styles.workspace} ${className ?? ""}`} id="delivery-reliability">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>DELIVERY FAILURE PROTECTION</p>
          <h2>Delivery reliability</h2>
          <p>Rider matching, no-rider refunds and restaurant protection in one place.</p>
        </div>
        <div className={styles.period}>
          <label htmlFor="reliability-days">Reporting period</label>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger id="reliability-days" aria-label="Reporting period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 7, 30, 90].map((value) => (
                <SelectItem key={value} value={String(value)}>Last {value} {value === 1 ? "day" : "days"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {!data && query.isFetching ? (
        <div className={styles.loading} role="status" aria-label="Loading delivery reliability">
          <Skeleton className={styles.skeletonTitle} />
          <div className={styles.metrics}>
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className={styles.skeletonMetric} />
            ))}
          </div>
          <Skeleton className={styles.skeletonSection} />
          <Skeleton className={styles.skeletonSection} />
        </div>
      ) : !data && query.isError ? (
        <div className={styles.error} role="alert">
          <p>Could not load delivery reliability: {query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : data ? (
        <>
          {query.isError && (
            <div className={styles.error} role="alert">
              <p>Could not refresh delivery reliability. Showing previously loaded data.</p>
              <Button size="sm" onClick={() => void query.refetch()}>Retry</Button>
            </div>
          )}
          {query.isFetching && <p className={styles.refreshing} role="status">Refreshing delivery data…</p>}

          <div className={styles.metrics} aria-label="Delivery reliability metrics">
            {metricItems(data.metrics).map((item, index) => (
              <article key={item.label} className={`${styles.metric} ${index === 3 || index === 4 ? styles.metricAttention : ""}`}>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
                {index === 4 && data.metrics.refundPendingCount > 0 && (
                  <Badge variant="warning">{data.metrics.refundPendingCount} need attention</Badge>
                )}
              </article>
            ))}
          </div>

          <AdminDeliveryAvailability
            towns={data.riderAvailability}
            submit={submit}
            isSaving={isSaving}
          />

          <div className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>Live rider searches</h3>
                <p>Accepted orders waiting for a delivery partner.</p>
              </div>
              <Badge variant={data.activeSearches.length ? "warning" : "outline"}>
                {data.activeSearches.length} active
              </Badge>
            </div>
            {data.activeSearches.length ? (
              <div className={styles.searches}>
                {data.activeSearches.map((order) => (
                  <article key={order.id} className={styles.search}>
                    <div>
                      <strong>Order #{order.id} · {order.restaurantName}</strong>
                      <p>{order.town} · {order.status.replace("_", " ")}
                        {order.readyAt ? " · READY" : ""}
                      </p>
                    </div>
                    <div className={styles.searchFacts}>
                      <Badge variant={order.deliveryAtRiskAt ? "destructive" : "outline"}>
                        {order.riderSearchStage ?? "Starting"}
                      </Badge>
                      <span>{order.riderSearchRadiusM === null ? "Radius pending" : `${(order.riderSearchRadiusM / 1000).toLocaleString("en-IN")} km radius`}</span>
                      <span>Incentive {money.format(order.riderSearchIncentive)}</span>
                      <span>
                        {order.riderSearchDeadlineAt
                          ? `Deadline ${new Intl.DateTimeFormat("en-IN", {
                              timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit",
                            }).format(order.riderSearchDeadlineAt)} IST`
                          : "Deadline pending"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>No active rider searches.</p>}
          </div>

          <AdminDeliveryFailures
            failures={data.failures}
            counts={data.counts}
            settings={data.settings}
            submit={submit}
            isSaving={isSaving}
          />
          <AdminDeliverySettings
            key={JSON.stringify(data.settings)}
            settings={data.settings}
            submit={submit}
            isSaving={isSaving}
          />
        </>
      ) : null}
    </section>
  );
}