import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminComplaints,
  type ComplaintView,
} from "../endpoints/admin/complaints_GET.schema";
import {
  postAdminComplaintAction,
  schema as actionSchema,
  type InputType as ActionInput,
} from "../endpoints/admin/complaint_action_POST.schema";
import { channels } from "../helpers/realtimeChannels";
import { useRealtimeInvalidation, useRealtimeResync } from "./FlootRealtimeProvider";
import { Badge } from "./Badge";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { Textarea } from "./Textarea";
import styles from "./AdminFoodComplaints.module.css";

const queryKey = ["admin", "complaints"] as const;
type Filter = "pending" | "approved" | "rejected" | "feedback_only" | "all";
type Decision = { kind: "approve" | "reject"; complaint: ComplaintView };

const filters: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "feedback_only", label: "Feedback only" },
  { value: "all", label: "All" },
];

const reasonLabels: Record<string, string> = {
  quality: "Bad taste / quality",
  wrong_item: "Wrong item",
  missing_item: "Item missing",
  hygiene: "Hygiene issue",
  stale: "Stale / cold food",
  other: "Other",
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const date = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function refundLabel(complaint: ComplaintView): string {
  switch (complaint.refundStatus) {
    case "processed":
      return complaint.refundMethod === "wallet"
        ? "Refunded to platr™ Wallet"
        : "Refund sent to original payment method";
    case "processing":
      return "Refund processing";
    case "failed":
      return "Refund failed — retry required";
    default:
      return "No refund processed";
  }
}

export function AdminFoodComplaints({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  useRealtimeInvalidation(channels.admin(), queryKey);
  useRealtimeResync([queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => getAdminComplaints({ status: "all" }),
    refetchOnMount: "always",
  });
  const [filter, setFilter] = useState<Filter>("pending");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<{
    limit: string;
    percent: string;
    windowHours: string;
  } | null>(null);

  const action = useMutation({
    mutationFn: (input: ActionInput) => postAdminComplaintAction(input),
    onSuccess: async (result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "finance"] }),
      ]);
      if (input.action === "settings") setSettingsDraft(null);
      setDecision(null);
      setNote("");
      setDecisionError(null);
      toast.success(result.message);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the change."),
  });

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.data) return;
    const draft = settingsDraft ?? {
      limit: String(query.data.settings.limit),
      percent: String(query.data.settings.refundBps / 100),
      windowHours: String(query.data.settings.windowHours),
    };
    const percent = Number(draft.percent);
    const input = actionSchema.safeParse({
      action: "settings",
      limit: Number(draft.limit),
      refundBps: Math.round(percent * 100),
      windowHours: Number(draft.windowHours),
    });
    if (!Number.isFinite(percent) || Math.abs(percent * 100 - Math.round(percent * 100)) > 0.000001) {
      setSettingsError("Enter a percentage in increments of 0.01.");
    } else if (!input.success) {
      setSettingsError(input.error.issues[0].message);
    } else {
      setSettingsError(null);
      action.mutate(input.data);
    }
  }

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) return;
    const input = actionSchema.safeParse({
      action: decision.kind,
      complaintId: decision.complaint.id,
      note,
    });
    if (!input.success) {
      setDecisionError(input.error.issues[0].message);
      return;
    }
    setDecisionError(null);
    action.mutate(input.data);
  }

  function closeDecision() {
    if (action.isPending) return;
    setDecision(null);
    setNote("");
    setDecisionError(null);
  }

  const data = query.data;
  const pendingCount = data?.complaints.filter((complaint) => complaint.status === "pending").length ?? 0;
  const visible = data?.complaints.filter((complaint) =>
    filter === "all" || complaint.status === filter
  ) ?? [];
  const draft = data && (settingsDraft ?? {
    limit: String(data.settings.limit),
    percent: String(data.settings.refundBps / 100),
    windowHours: String(data.settings.windowHours),
  });

  return (
    <section id="food-complaints" className={`${styles.section} ${className ?? ""}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CUSTOMER CARE</p>
          <h2>Food complaints</h2>
        </div>
        <Badge variant={pendingCount ? "warning" : "outline"}>{pendingCount} pending</Badge>
      </div>

      {query.isFetching && !data ? (
        <div className={styles.loading} role="status" aria-label="Loading food complaints">
          <Skeleton className={styles.skeletonHeading} />
          <Skeleton className={styles.skeletonRow} />
          <Skeleton className={styles.skeletonCard} />
          <Skeleton className={styles.skeletonCard} />
        </div>
      ) : query.isError && !data ? (
        <div className={styles.errorPanel} role="alert">
          <p>Could not load food complaints: {query.error instanceof Error ? query.error.message : "Unknown error"}</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : data && draft ? (
        <>
          {query.isError && (
            <p className={styles.errorPanel} role="alert">
              Could not refresh complaints. Showing the last loaded results.{" "}
              <Button size="sm" onClick={() => void query.refetch()}>Retry</Button>
            </p>
          )}
          {query.isFetching && <p className={styles.refreshing} role="status">Refreshing complaints…</p>}

          <form className={styles.settings} onSubmit={submitSettings}>
            <h3>Refund rules</h3>
            <div className={styles.settingsFields}>
              <label>
                Refund limit per customer
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  required
                  value={draft.limit}
                  onChange={(event) => setSettingsDraft({ ...draft, limit: event.target.value })}
                  disabled={action.isPending}
                />
              </label>
              <label>
                Refund % of food value
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  required
                  value={draft.percent}
                  onChange={(event) => setSettingsDraft({ ...draft, percent: event.target.value })}
                  disabled={action.isPending}
                />
              </label>
              <label>
                Complaint window (hours)
                <Input
                  type="number"
                  min={1}
                  max={168}
                  step={1}
                  required
                  value={draft.windowHours}
                  onChange={(event) => setSettingsDraft({ ...draft, windowHours: event.target.value })}
                  disabled={action.isPending}
                />
              </label>
              <Button type="submit" disabled={action.isPending}>
                {action.isPending ? "Saving…" : "Save rules"}
              </Button>
            </div>
            {settingsError && <p className={styles.formError} role="alert">{settingsError}</p>}
          </form>

          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList className={styles.filters} aria-label="Filter food complaints">
              {filters.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <p className={styles.empty}>No {filter === "all" ? "" : `${filter.replace("_", " ")} `}food complaints.</p>
          ) : (
            <div className={styles.list}>
              {visible.map((complaint) => (
                <article className={styles.card} key={complaint.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3>Order #{complaint.orderId} · {complaint.restaurant.name}</h3>
                      <p>{complaint.customer.name} · {complaint.customer.email}</p>
                      <small>Refunds used {complaint.customer.usedRefunds}/{complaint.customer.limit} · {date(complaint.createdAt)}</small>
                    </div>
                    <Badge variant={complaint.status === "pending" ? "warning" : complaint.status === "approved" ? "success" : "outline"}>
                      {complaint.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className={styles.report}>
                    <strong>{reasonLabels[complaint.reason] ?? complaint.reason}</strong>
                    <p>{complaint.description}</p>
                    {complaint.imageUrls.length > 0 && (
                      <div className={styles.photos}>
                        {complaint.imageUrls.map((url, index) => (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={index}
                            aria-label={`Open complaint photo ${index + 1} in a new tab`}
                          >
                            <img src={url} alt={`Food complaint evidence ${index + 1}`} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.orderDetails}>
                    <div>
                      <strong>Order items</strong>
                      <ul>
                        {complaint.order.items.map((item, index) => (
                          <li key={`${item.name}-${index}`}>
                            <span>{item.qty} × {item.name}</span>
                            <span>{money(item.qty * item.price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.totals}>
                      <span>Food total <strong>{money(complaint.order.itemsTotal)}</strong></span>
                      <span>Order total <strong>{money(complaint.order.total)}</strong></span>
                      <span>Payment method <strong>{complaint.order.paymentMethod === "upi" ? "Razorpay" : complaint.order.paymentMethod}</strong></span>
                      <span>Refund amount <strong>{money(complaint.refundAmount)}</strong></span>
                    </div>
                  </div>

                  {complaint.status === "pending" ? (
                    <div className={styles.actions}>
                      <Button disabled={action.isPending} onClick={() => setDecision({ kind: "approve", complaint })}>
                        Approve &amp; refund {money(complaint.refundAmount)}
                      </Button>
                      <Button variant="destructive" disabled={action.isPending} onClick={() => setDecision({ kind: "reject", complaint })}>
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className={styles.outcome}>
                      {complaint.status === "approved" && (
                        <>
                          <strong>{refundLabel(complaint)}</strong>
                          {complaint.razorpayRefundId && <p>Razorpay refund ID: {complaint.razorpayRefundId}</p>}
                          {complaint.refundError && <p className={styles.formError}>Refund error: {complaint.refundError}</p>}
                          {complaint.refundStatus === "failed" && (
                            <Button
                              disabled={action.isPending}
                              onClick={() => action.mutate({ action: "retry_refund", complaintId: complaint.id })}
                            >
                              {action.isPending ? "Working…" : "Retry refund"}
                            </Button>
                          )}
                        </>
                      )}
                      {complaint.adminNote && <p>Admin note: {complaint.adminNote}</p>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      <Dialog open={decision !== null} onOpenChange={(open) => { if (!open) closeDecision(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.kind === "approve" ? "Approve food complaint" : "Reject food complaint"}</DialogTitle>
            <DialogDescription>
              {decision?.kind === "approve"
                ? `${money(decision.complaint.refundAmount)} will be refunded immediately to the customer's ${decision.complaint.order.paymentMethod === "wallet" ? "platr™ Wallet" : "original payment method"} and deducted from ${decision.complaint.restaurant.name}'s next payout. Online refunds may take time to reach the customer.`
                : "Give the customer a clear reason for rejecting this complaint."}
            </DialogDescription>
          </DialogHeader>
          <form className={styles.decisionForm} onSubmit={submitDecision}>
            <label>
              {decision?.kind === "reject" ? "Reason (required)" : "Note (optional)"}
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                required={decision?.kind === "reject"}
                disabled={action.isPending}
              />
            </label>
            {decisionError && <p className={styles.formError} role="alert">{decisionError}</p>}
            <div className={styles.actions}>
              <Button variant="ghost" onClick={closeDecision} disabled={action.isPending}>Cancel</Button>
              <Button
                type="submit"
                variant={decision?.kind === "reject" ? "destructive" : "primary"}
                disabled={action.isPending}
              >
                {action.isPending ? "Saving…" : decision?.kind === "approve" ? "Confirm approval & refund" : "Confirm rejection"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}