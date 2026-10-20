import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { ArrowLeft, Headset } from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { SupportTicketForm } from "../components/SupportTicketForm";
import type { SupportTicketView } from "../endpoints/support/my_tickets_GET.schema";
import { useAuth } from "../helpers/useAuth";
import {
  supportQueryKeys,
  useMySupportTickets,
} from "../helpers/useSupportTickets";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./support.module.css";

function SupportHistory({
  tickets,
  isFetching,
  error,
  onRetry,
}: {
  tickets: SupportTicketView[] | undefined;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <section className={styles.card} aria-labelledby="support-history-title">
      <h2 id="support-history-title">Your support requests</h2>
      {isFetching && !tickets ? (
        <div className={styles.skeletons}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : error && !tickets ? (
        <div>
          <p role="alert">Could not load your requests: {error.message}</p>
          <Button variant="outline" onClick={onRetry}>Try again</Button>
        </div>
      ) : !tickets?.length ? (
        <p className={styles.muted}>You haven’t sent a support request yet.</p>
      ) : (
        <>
          {isFetching && <p className={styles.muted}>Refreshing requests…</p>}
          {error && <p role="alert">Could not refresh requests: {error.message}</p>}
          <div className={styles.ticketList}>
            {tickets.map((ticket) => (
              <details className={styles.ticket} key={ticket.id}>
                <summary className={styles.ticketSummary}>
                  <span className={styles.ticketTitle}>
                    <strong>#{ticket.id} · {ticket.subject}</strong>
                    <span className={styles.muted}>
                      Last updated {new Date(ticket.lastMessageAt).toLocaleString()}
                    </span>
                  </span>
                  <Badge
                    variant={
                      ticket.status === "answered"
                        ? "success"
                        : ticket.status === "closed"
                          ? "secondary"
                          : "warning"
                    }
                  >
                    {ticket.status}
                  </Badge>
                </summary>
                <div className={styles.messages}>
                  {ticket.messages.length ? ticket.messages.map((message) => (
                    <div className={styles.message} key={message.id}>
                      <div className={styles.messageMeta}>
                        {message.direction === "outbound" ? "platr™ Support" : "You"}
                        {" · "}
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                      <p className={styles.messageBody}>{message.bodyText}</p>
                    </div>
                  )) : <p className={styles.muted}>No messages yet.</p>}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function SupportPage() {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const [createdTicketId, setCreatedTicketId] = useState<number | null>(null);
  const user = authState.type === "authenticated" ? authState.user : null;
  const ticketsQuery = useMySupportTickets(authState.type === "authenticated");

  useEffect(() => {
    if (authState.type === "unauthenticated") {
      queryClient.removeQueries({ queryKey: supportQueryKeys.myTickets });
      setCreatedTicketId(null);
    }
  }, [authState.type, queryClient]);

  return (
    <>
      <Helmet>
        <title>Contact platr™ Support</title>
      </Helmet>
      <main className={styles.page}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={17} /> Back to platr™
        </Link>
        <header className={styles.header}>
          <Headset size={28} aria-hidden="true" />
          <h1>Contact platr™ Support</h1>
          <p>
            Customers, restaurant partners and riders – choose your topic and
            we'll reply by email.
          </p>
        </header>

        {authState.type === "loading" ? (
          <section className={styles.card} aria-label="Loading support form">
            <div className={styles.skeletons}>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          </section>
        ) : (
          <>
            {createdTicketId === null ? (
              <SupportTicketForm
                key={user?.id ?? "guest"}
                className={styles.card}
                user={user}
                recentOrders={ticketsQuery.data?.recentOrders}
                ordersLoading={ticketsQuery.isFetching}
                ordersError={ticketsQuery.error}
                onRetryOrders={() => { void ticketsQuery.refetch(); }}
                onCreated={setCreatedTicketId}
              />
            ) : (
              <section className={styles.card} role="status">
                <h2>Request #{createdTicketId} received</h2>
                <p>
                  We've emailed you a confirmation – reply to that email to add
                  details.
                </p>
                <Button onClick={() => setCreatedTicketId(null)}>
                  Send another request
                </Button>
              </section>
            )}

            {user && (
              <SupportHistory
                tickets={ticketsQuery.data?.tickets}
                isFetching={ticketsQuery.isFetching}
                error={ticketsQuery.error}
                onRetry={() => { void ticketsQuery.refetch(); }}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}