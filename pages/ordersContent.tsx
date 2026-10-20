import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../helpers/useAuth";
import { useCustomerOnlineCheckout } from "../helpers/useCustomerOnlineCheckout";
import { useCustomerOrderAlerts } from "../helpers/useCustomerOrderAlerts";
import { ziptoHooks } from "../helpers/ziptoHooks";
import { postCustomerOrderAction } from "../endpoints/customer/order_action_POST.schema";
import { StatusPill } from "../components/StatusPill";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { CustomerOrderBill } from "../components/CustomerOrderBill";
import { CustomerOrderTracker } from "../components/CustomerOrderTracker";
import { OrderFeedback } from "../components/OrderFeedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import styles from "./orders.module.css";

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default function OrdersContent() {
  const { authState } = useAuth();
  const uid = authState.type === "authenticated" ? authState.user.id : 0;
  const q = ziptoHooks.useCustomerOrders(uid);
  useCustomerOrderAlerts(q.data?.orders);
  const { startPayment, isProcessing } = useCustomerOnlineCheckout();
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  const cancel = ziptoHooks.useAction(
    (input: { action: "cancel"; orderId: number }) =>
      postCustomerOrderAction(input),
    [ziptoHooks.keys.customerOrders],
    "Order updated",
  );

  const retryPayment = useMutation({
    mutationFn: (orderId: number) =>
      postCustomerOrderAction({ action: "retry_payment", orderId }),
    onSuccess: async (result, orderId) => {
      if (!result.payment) {
        toast.error("Online payment details are missing. Please try again.");
        return;
      }
      await startPayment(orderId, result.payment);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Could not start online payment",
      ),
  });

  if (!q.data && q.isFetching) {
    return (
      <div className={styles.page}>
        <Skeleton className={styles.card} />
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <div className={styles.page}>
        <h1>My orders</h1>
        <p>{q.error instanceof Error ? q.error.message : "Could not load orders."}</p>
        <Button onClick={() => void q.refetch()}>Retry</Button>
      </div>
    );
  }

  const orders = q.data?.orders ?? [];
  const orderToCancel = orders.find(
    (order) => order.id === confirmCancelId && order.status === "placed",
  );

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>YOUR PLATR</span>
          <h1>My orders 🍱</h1>
          <p>Track your food and see previous orders.</p>
        </div>
        <Link className={styles.back} to="/account">My account, wallet &amp; addresses</Link>
        <Link className={styles.back} to="/">← Explore restaurants</Link>
      </div>

      {!orders.length ? (
        <section className={styles.empty}>
          <div>🥡</div>
          <h2>Abhi koi order nahi hai</h2>
          <p>Local favourites discover karo and place your first order.</p>
          <Link to="/">Explore restaurants →</Link>
        </section>
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <article className={styles.card} key={order.id}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.orderNo}>ORDER #{order.id}</span>
                  <h2>{order.restaurantName}</h2>
                  <p>
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p>Delivery address: {order.deliveryAddress}</p>
                </div>
                <StatusPill status={order.status} />
              </div>

              <div className={styles.items}>
                {order.items.map((item, index) => (
                  <div key={index}>
                    <span>{item.quantity} × {item.name}</span>
                    <b>{money(item.price * item.quantity)}</b>
                  </div>
                ))}
              </div>

              <CustomerOrderBill order={order} money={money} />

              {["placed", "accepted", "preparing", "ready", "picked_up"].includes(order.status) && (
                <CustomerOrderTracker order={order} />
              )}

              <div className={styles.details}>
                <span>
                  {order.paymentMethod === "cod"
                    ? "Cash on delivery"
                    : order.paymentStatus === "refunded"
                      ? "Refunded"
                      : order.paymentStatus === "paid"
                        ? order.paymentMethod === "wallet"
                          ? "Paid via platr™ Wallet"
                          : "Paid online"
                        : "Online payment pending"}
                </span>
                <strong>{money(order.total)}</strong>
              </div>
              {order.status === "delivered" && q.data && (
                <OrderFeedback order={order} complaintSummary={q.data.complaintSummary} />
              )}
              {order.cancelReason && <p className={styles.note}>{order.cancelReason}</p>}

              {order.status === "placed" && (
                <div className={styles.actions}>
                  {order.paymentMethod === "upi" &&
                    order.paymentStatus === "pending" && (
                      <Button
                        disabled={retryPayment.isPending || isProcessing || cancel.isPending}
                        onClick={() => retryPayment.mutate(order.id)}
                      >
                        {retryPayment.isPending && retryPayment.variables === order.id
                          ? "Opening payment…"
                          : "Pay now"}
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    disabled={cancel.isPending || retryPayment.isPending || isProcessing}
                    onClick={() => {
                      if (
                        order.paymentMethod === "upi" &&
                        order.paymentStatus === "paid"
                      ) {
                        setConfirmCancelId(order.id);
                        return;
                      }
                      cancel.mutate({ action: "cancel", orderId: order.id });
                    }}
                  >
                    Cancel order
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={confirmCancelId !== null && !!orderToCancel}
        onOpenChange={(open) => {
          if (!open && !cancel.isPending) setConfirmCancelId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order #{confirmCancelId}?</DialogTitle>
            <DialogDescription>
              Your payment will be refunded to the original method in 5-7 working days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => setConfirmCancelId(null)}
            >
              Keep order
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending || !orderToCancel}
              onClick={() => {
                if (!orderToCancel) return;
                cancel.mutate(
                  { action: "cancel", orderId: orderToCancel.id },
                  { onSuccess: () => setConfirmCancelId(null) },
                );
              }}
            >
              {cancel.isPending ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}