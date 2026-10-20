import { useEffect, useMemo, useState } from "react";
import { Filter, ReceiptText, Search, X } from "lucide-react";
import type { OutputType } from "../endpoints/restaurant/dashboard_GET.schema";
import { postRestaurantAction } from "../endpoints/restaurant/action_POST.schema";
import { useMerchantRiderLocations } from "../helpers/useMerchantRiderLocations";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";
import { Input } from "./Input";
import { MerchantEmpty } from "./MerchantUi";
import { MerchantOrderCard } from "./MerchantOrderCard";
import { MerchantPinEditor } from "./MerchantPinEditor";
import { Textarea } from "./Textarea";
import styles from "./MerchantOrders.module.css";

type OrderFilter = "incoming" | "preparing" | "ready" | "completed" | "cancelled" | "all";

export const MerchantOrders = ({ data, className }: { data: OutputType; className?: string }) => {
  const [filter, setFilter] = useState<OrderFilter>(() => data.orders.some((order) => order.status === "placed") ? "incoming" : "preparing");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [pinHintDismissed, setPinHintDismissed] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const locations = useMerchantRiderLocations(data);
  const act = ziptoHooks.useAction(
    postRestaurantAction,
    [ziptoHooks.keys.restaurantDashboard],
    (input) => input.action === "order" ? `Order #ZIP-${input.orderId} ${input.to === "ready" ? "marked ready" : input.to}` : undefined,
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const counts = useMemo(() => ({
    incoming: data.orders.filter((order) => order.status === "placed").length,
    preparing: data.orders.filter((order) => order.status === "accepted" || order.status === "preparing").length,
    ready: data.orders.filter((order) => order.status === "ready" || order.status === "picked_up").length,
  }), [data.orders]);

  const list = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#?(?:zip-)?/, "");
    return data.orders.filter((order) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "incoming" && order.status === "placed") ||
        (filter === "preparing" && (order.status === "accepted" || order.status === "preparing")) ||
        (filter === "ready" && (order.status === "ready" || order.status === "picked_up")) ||
        (filter === "completed" && order.status === "delivered") ||
        (filter === "cancelled" && (order.status === "cancelled" || order.status === "rejected"));
      return matchesFilter && (!query ||
        String(order.id).includes(query) ||
        order.items.some((item) => item.name.toLowerCase().includes(query)));
    });
  }, [data.orders, filter, search]);

  const extraFilter = filter === "completed" || filter === "cancelled" || filter === "all";

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <header className={styles.header}>
        <h1>Active Orders</h1>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="icon-md" aria-label={searchOpen ? "Close search" : "Search orders"} onClick={() => { setSearchOpen((value) => !value); setSearch(""); }}>
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-md" aria-label="Filter orders"><Filter size={20} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setFilter("completed")}>Completed</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFilter("cancelled")}>Cancelled</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setFilter("all")}>All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {searchOpen && <Input type="search" aria-label="Search by order ID or item name" placeholder="Search order ID or item name" value={search} onChange={(event) => setSearch(event.target.value)} />}
      <div className={styles.tabs} aria-label="Order lists">
        {([
          ["incoming", "Incoming", counts.incoming],
          ["preparing", "Preparing", counts.preparing],
          ["ready", "Ready for Pickup", counts.ready],
        ] as const).map(([id, label, count]) => (
          <button key={id} type="button" aria-pressed={filter === id} className={`${styles.tab} ${filter === id ? styles.active : ""}`} onClick={() => setFilter(id)}>
            {label} ({count})
          </button>
        ))}
        {extraFilter && (
          <button type="button" className={`${styles.tab} ${styles.active}`} onClick={() => setFilter("incoming")} aria-label={`Clear ${filter} filter`}>
            {filter === "all" ? "All" : filter === "completed" ? "Completed" : "Cancelled"} <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {data.restaurant?.lat == null && !pinHintDismissed && (
        <div className={styles.pinHint}>
          <span>Set your outlet pin so riders can navigate to you and you can see rider distance &amp; ETA.</span>
          <Button variant="link" size="sm" onClick={() => setPinDialogOpen(true)}>Set pin now</Button>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss outlet pin hint" onClick={() => setPinHintDismissed(true)}><X size={16} /></Button>
        </div>
      )}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set your outlet pin</DialogTitle></DialogHeader>
          <MerchantPinEditor lat={data.restaurant?.lat ?? null} lng={data.restaurant?.lng ?? null} onSaved={() => setPinDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {list.length === 0 ? (
        <MerchantEmpty icon={<ReceiptText size={32} />} title="Nothing here" text={search.trim() ? "No orders match your search." : filter === "incoming" ? "New orders will appear here instantly." : "No orders in this list yet."} />
      ) : (
        <div className={styles.list}>
          {list.map((order) => (
            <MerchantOrderCard
              key={order.id}
              order={order}
              avgPrepMinutes={data.restaurant?.avgPrepMinutes ?? 30}
              restaurantLat={data.restaurant?.lat ?? null}
              restaurantLng={data.restaurant?.lng ?? null}
              location={locations[order.id]}
              now={now}
              pending={act.isPending}
              compact={extraFilter}
              onReject={(id) => { setRejecting(id); setReason(""); }}
              onAction={(input) => act.mutate(input)}
            />
          ))}
        </div>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(open) => { if (!open && !act.isPending) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject order #ZIP-{rejecting}?</DialogTitle></DialogHeader>
          <p className={styles.dialogHint}>The customer will see this reason.</p>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Item out of stock, kitchen closing" maxLength={200} />
          <DialogFooter>
            <Button variant="ghost" disabled={act.isPending} onClick={() => setRejecting(null)}>Keep order</Button>
            <Button variant="destructive" disabled={act.isPending} onClick={() => {
              if (rejecting === null) return;
              act.mutate(
                { action: "order", orderId: rejecting, to: "rejected", reason: reason.trim() || undefined },
                { onSuccess: () => setRejecting(null) },
              );
            }}>{act.isPending ? "Rejecting…" : "Reject order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};