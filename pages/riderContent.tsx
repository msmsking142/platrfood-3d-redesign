import { AlertCircle } from "lucide-react";
import { RiderDashboard } from "../components/RiderDashboard";
import { RiderOnboarding } from "../components/RiderOnboarding";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ziptoHooks } from "../helpers/ziptoHooks";
import styles from "./riderContent.module.css";

export default function RiderContent() {
  const query = ziptoHooks.useRiderDashboard();

  if (query.isFetching && !query.data) {
    return (
      <div className={styles.loading} aria-label="Loading rider dashboard">
        <Skeleton className={styles.sidebarSkeleton} />
        <div className={styles.mainSkeletons}>
          <Skeleton className={styles.headerSkeleton} />
          <Skeleton className={styles.contentSkeleton} />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className={styles.error} role="alert">
        <AlertCircle size={28} aria-hidden="true" />
        <h1>Could not load your rider dashboard</h1>
        <p>{query.error instanceof Error ? query.error.message : "Please check your connection and try again."}</p>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </div>
    );
  }

  return query.data.rider
    ? <RiderDashboard data={query.data} />
    : <RiderOnboarding />;
}