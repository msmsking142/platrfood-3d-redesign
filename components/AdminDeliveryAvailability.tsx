import { useState, type FormEvent } from "react";
import type { RiderAvailability } from "../endpoints/admin/delivery_reliability_GET.schema";
import type { SubmitProtectionAction } from "../helpers/useAdminDeliveryReliability";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./Dialog";
import styles from "./AdminDeliveryAvailability.module.css";

export function AdminDeliveryAvailability({
  towns, submit, isSaving, className,
}: {
  towns: RiderAvailability[];
  submit: SubmitProtectionAction;
  isSaving: boolean;
  className?: string;
}) {
  const [town, setTown] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("30");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function pause(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!town) return;
    try {
      await submit({
        action: "pause_area",
        town,
        minutes: Number(minutes),
        reason,
      });
      setTown(null);
      setReason("");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not pause orders");
    }
  }

  async function resume(name: string) {
    try {
      setError(null);
      await submit({ action: "resume_area", town: name });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resume orders");
    }
  }

  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <div className={styles.heading}>
        <div>
          <h3>Rider availability</h3>
          <p>Fresh location means an online approved rider updated within 15 minutes.</p>
        </div>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {towns.length ? (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr>
              <th scope="col">Town</th>
              <th scope="col">Approved / online / fresh</th>
              <th scope="col">Awaiting rider</th>
              <th scope="col">Orders</th>
              <th scope="col">Action</th>
            </tr></thead>
            <tbody>
              {towns.map((item) => {
                const paused = item.ordersPausedUntil !== null
                  && new Date(item.ordersPausedUntil).getTime() > Date.now();
                return (
                  <tr key={item.town}>
                    <th scope="row">{item.town}</th>
                    <td className={styles.numbers}>{item.approvedRiders} / {item.onlineRiders} / {item.onlineFresh}</td>
                    <td className={styles.numbers}>{item.activeOrdersAwaitingRider}</td>
                    <td>
                      {paused ? (
                        <span className={styles.paused}>
                          Paused until {new Intl.DateTimeFormat("en-IN", {
                            timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
                          }).format(item.ordersPausedUntil!)} IST
                          {item.ordersPauseReason && <small>{item.ordersPauseReason}</small>}
                        </span>
                      ) : "Open"}
                    </td>
                    <td>
                      {paused ? (
                        <Button size="sm" disabled={isSaving} onClick={() => void resume(item.town)}>
                          Resume orders
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled={isSaving} onClick={() => {
                          setError(null);
                          setTown(item.town);
                        }}>
                          Pause
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className={styles.empty}>No rider or service-area towns found.</p>}

      <Dialog open={town !== null} onOpenChange={(open) => {
        if (!open && !isSaving) { setTown(null); setError(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause orders in {town}</DialogTitle>
            <DialogDescription>
              New orders in this town will be paused until the selected time expires or you resume them.
            </DialogDescription>
          </DialogHeader>
          <form className={styles.form} onSubmit={(event) => void pause(event)}>
            <label>Duration (minutes)
              <Input type="number" min={5} max={1440} step={1} required
                value={minutes} onChange={(event) => setMinutes(event.target.value)}
                disabled={isSaving} />
            </label>
            <label>Reason
              <Textarea minLength={3} maxLength={200} required value={reason}
                onChange={(event) => setReason(event.target.value)} disabled={isSaving} />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.actions}>
              <Button variant="ghost" disabled={isSaving} onClick={() => setTown(null)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Pausing…" : "Pause orders"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}