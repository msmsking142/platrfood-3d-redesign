import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { channels } from "../helpers/realtimeChannels";
import {
  supportQueryKeys,
  useAdminSupportAction,
  useAdminSupportTickets,
} from "../helpers/useSupportTickets";
import {
  formatSupportActivity,
  matchesSupportSearch,
  relativeSupportActivity,
} from "../helpers/supportCrmFormatting";
import { formatSupportTicketNumber } from "../helpers/supportCategories";
import type { SupportTicketView } from "../endpoints/support/my_tickets_GET.schema";
import { useRealtimeInvalidation, useRealtimeResync } from "./FlootRealtimeProvider";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Skeleton } from "./Skeleton";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { Textarea } from "./Textarea";
import styles from "./AdminSupportInbox.module.css";

type StatusFilter = "open" | "answered" | "closed" | "all";
type AccountFilter = SupportTicketView["accountType"] | "all";

const filters: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Resolved" },
  { value: "all", label: "All" },
];

const accountLabels: Record<SupportTicketView["accountType"], string> = {
  customer: "Customer",
  merchant: "Merchant",
  rider: "Rider",
  guest: "Guest",
};

export function AdminSupportInbox({ className }: { className?: string }) {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [account, setAccount] = useState<AccountFilter>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  useRealtimeInvalidation(channels.admin(), supportQueryKeys.admin);
  useRealtimeResync([supportQueryKeys.admin]);

  const query = useAdminSupportTickets(status);
  const action = useAdminSupportAction();
  const data = query.data;
  const ticketParam = searchParams.get("ticket");
  const selected = data?.tickets.find((ticket) => String(ticket.id) === ticketParam);

  function selectTicket(id: number | null) {
    setDraft("");
    setDraftError("");
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id === null) next.delete("ticket");
      else next.set("ticket", String(id));
      return next;
    });
  }

  function sendReply(event: FormEvent<HTMLFormElement> | undefined, close: boolean) {
    event?.preventDefault();
    if (!selected) return;
    const message = draft.trim();
    if (!message) {
      setDraftError("Enter a reply before sending.");
      return;
    }
    setDraftError("");
    action.mutate(
      { action: "reply", ticketId: selected.id, message, close },
      { onSuccess: () => setDraft("") },
    );
  }

  const visible = data?.tickets.filter((ticket) =>
    (account === "all" || ticket.accountType === account) &&
    matchesSupportSearch(ticket, search),
  ) ?? [];

  return (
    <section id="support" className={`${styles.section} ${className ?? ""}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CUSTOMER CARE</p>
          <h2>Support CRM</h2>
        </div>
        {data && <Badge variant={data.counts.open ? "warning" : "outline"}>{data.counts.open} open</Badge>}
      </div>

      {query.isFetching && (!data || query.isPlaceholderData) ? (
        <div className={styles.loading} role="status" aria-label="Loading support tickets">
          <Skeleton className={styles.skeletonHeading} />
          <Skeleton className={styles.skeletonCard} />
          <Skeleton className={styles.skeletonCard} />
        </div>
      ) : query.isError && !data ? (
        <div className={styles.errorPanel} role="alert">
          <p>Could not load support tickets: {query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : data ? (
        <>
          {query.isError && (
            <div className={styles.errorPanel} role="alert">
              <p>Could not refresh support tickets: {query.error.message}</p>
              <Button size="sm" onClick={() => void query.refetch()}>Retry</Button>
            </div>
          )}
          {query.isFetching && <p className={styles.refreshing} role="status">Refreshing support tickets…</p>}
          <div className={styles.workspace}>
            <div className={`${styles.listPane} ${selected ? styles.mobileHidden : ""}`}>
              <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                <TabsList className={styles.filters} aria-label="Filter support tickets">
                  {filters.map((filter) => (
                    <TabsTrigger key={filter.value} value={filter.value}>
                      {filter.label} <span className={styles.filterCount}>
                        {filter.value === "all"
                          ? data.counts.open + data.counts.answered + data.counts.closed
                          : data.counts[filter.value]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className={styles.controls}>
                <Input
                  type="search"
                  aria-label="Search tickets"
                  placeholder="Search tickets"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select value={account} onValueChange={(value) => setAccount(value as AccountFilter)}>
                  <SelectTrigger aria-label="Filter by account type">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {Object.entries(accountLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.list}>
                {visible.length === 0 ? (
                  <p className={styles.empty}>No matching tickets.</p>
                ) : visible.map((ticket) => {
                  const last = ticket.messages.at(-1);
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`${styles.ticketRow} ${selected?.id === ticket.id ? styles.selected : ""}`}
                      aria-current={selected?.id === ticket.id ? "true" : undefined}
                      onClick={() => selectTicket(ticket.id)}
                    >
                      <span className={styles.rowTop}>
                        <strong>Ticket #{formatSupportTicketNumber(ticket.id)} · {ticket.subject}</strong>
                        <span>{relativeSupportActivity(ticket.lastMessageAt)}</span>
                      </span>
                      <span>{ticket.name}</span>
                      <span className={styles.rowBadges}>
                        <Badge variant="secondary">{accountLabels[ticket.accountType]}</Badge>
                        <Badge variant={ticket.status === "open" ? "warning" : "outline"}>
                          {ticket.status === "closed" ? "Resolved" : ticket.status}
                        </Badge>
                        {last?.direction === "inbound" && <Badge variant="warning">Needs reply</Badge>}
                      </span>
                      <span className={styles.snippet}>{last?.bodyText ?? "No messages"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`${styles.detailPane} ${!selected ? styles.mobileHidden : ""}`}>
              {selected ? (
                <>
                  <Button className={styles.backButton} variant="ghost" onClick={() => selectTicket(null)}>
                    ← Back to tickets
                  </Button>
                  <div className={styles.detailHeader}>
                    <div>
                      <p className={styles.ticketId}>Ticket #{formatSupportTicketNumber(selected.id)}</p>
                      <h3>{selected.subject}</h3>
                    </div>
                    <Badge variant={selected.status === "open" ? "warning" : "outline"}>
                      {selected.status === "closed" ? "Resolved" : selected.status}
                    </Badge>
                  </div>
                  <div className={styles.infoCard}>
                    <span><strong>Name</strong>{selected.name}</span>
                    <span><strong>Email</strong>{selected.registeredEmail ?? selected.email}</span>
                    <span><strong>Account</strong>{accountLabels[selected.accountType]}</span>
                    <span><strong>Category</strong>{selected.category}</span>
                    <span><strong>Order</strong>{selected.orderId === null ? "None" : `#${selected.orderId}`}</span>
                    <span><strong>Source</strong>{selected.source.toLowerCase() === "email" ? "Email" : "Form"}</span>
                    <span><strong>Created</strong>{formatSupportActivity(selected.createdAt)}</span>
                  </div>
                  <div className={styles.conversation} aria-label={`Conversation for ticket ${selected.id}`}>
                    {selected.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`${styles.message} ${
                          message.direction === "outbound" ? styles.outbound : styles.inbound
                        }`}
                      >
                        <div className={styles.messageHeader}>
                          <strong>{message.direction === "outbound" ? "platr™ Support" : message.senderEmail}</strong>
                          <time dateTime={new Date(message.createdAt).toISOString()}>
                            {formatSupportActivity(message.createdAt)}
                          </time>
                        </div>
                        <p className={styles.messageText}>{message.bodyText}</p>
                        {message.attachmentCount > 0 && (
                          <p className={styles.attachmentNote}>
                            {message.attachmentCount} attachment(s) – see email
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                  <form className={styles.replyForm} onSubmit={(event) => sendReply(event, false)}>
                    <p className={styles.senderLine}>
                      From: platr™ Support &lt;support@platrfood.co.in&gt; · To: {selected.registeredEmail ?? selected.email}
                    </p>
                    <label htmlFor="support-reply">Reply to customer</label>
                    <Textarea
                      id="support-reply"
                      value={draft}
                      onChange={(event) => { setDraft(event.target.value); setDraftError(""); }}
                      maxLength={8000}
                      disabled={action.isPending}
                      aria-invalid={Boolean(draftError)}
                      aria-describedby={draftError ? "support-reply-error" : undefined}
                    />
                    {draftError && <p id="support-reply-error" className={styles.formError} role="alert">{draftError}</p>}
                    <div className={styles.actions}>
                      <Button type="submit" disabled={action.isPending}>
                        {action.isPending ? "Sending…" : "Send reply"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={action.isPending}
                        onClick={() => sendReply(undefined, true)}
                      >
                        Send &amp; mark resolved
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={action.isPending}
                        onClick={() => action.mutate({
                          action: "status",
                          ticketId: selected.id,
                          status: selected.status === "closed" ? "open" : "closed",
                        })}
                      >
                        {selected.status === "closed" ? "Reopen" : "Mark resolved"}
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                <div className={styles.detailEmpty}>Select a ticket to read and answer the conversation.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}