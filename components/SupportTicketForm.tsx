import type { User } from "../helpers/User";
import type { RecentSupportOrder } from "../endpoints/support/my_tickets_GET.schema";
import { schema } from "../endpoints/support/ticket_POST.schema";
import {
  accountTypeForRole,
  supportCategories,
} from "../helpers/supportCategories";
import { useCreateSupportTicket } from "../helpers/useSupportTickets";
import { Button } from "./Button";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { Skeleton } from "./Skeleton";
import { Textarea } from "./Textarea";
import styles from "./SupportTicketForm.module.css";

type Props = {
  className?: string;
  user: User | null;
  recentOrders: RecentSupportOrder[] | undefined;
  ordersLoading: boolean;
  ordersError: Error | null;
  onRetryOrders: () => void;
  onCreated: (ticketId: number) => void;
};

export function SupportTicketForm({
  className,
  user,
  recentOrders,
  ordersLoading,
  ordersError,
  onRetryOrders,
  onCreated,
}: Props) {
  const accountType = accountTypeForRole(user?.role);
  const createTicket = useCreateSupportTicket();
  const form = useForm({
    schema,
    defaultValues: {
      name: user
        ? user.displayName.trim().length >= 2
          ? user.displayName
          : "platr™ member"
        : "",
      email: user?.email ?? "",
      category: "",
      orderId: undefined,
      subject: "",
      message: "",
    },
  });

  return (
    <section className={className} aria-labelledby="support-form-title">
      <h2 id="support-form-title">Send a support request</h2>
      {user ? (
        <p className={styles.account}>
          Signed in as {user.displayName} ({user.email}) ·{" "}
          {accountType === "merchant"
            ? "Merchant"
            : accountType === "rider"
              ? "Rider"
              : "Customer"}{" "}
          account
        </p>
      ) : (
        <p className={styles.account}>
          Log in to get help with a specific order.
        </p>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            try {
              const result = await createTicket.mutateAsync(values);
              onCreated(result.ticketId);
            } catch (error) {
              console.error("Failed to create support request", error);
            }
          })}
        >
          {!user && (
            <div className={styles.nameEmail}>
              <FormItem name="name">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    value={form.values.name}
                    onChange={(event) =>
                      form.setValues((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="email">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.values.email}
                    onChange={(event) =>
                      form.setValues((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>
          )}

          <FormItem name="category">
            <FormLabel>Category</FormLabel>
            <FormControl>
              <Select
                value={form.values.category || undefined}
                onValueChange={(category) =>
                  form.setValues((previous) => ({ ...previous, category }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {supportCategories[accountType].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>

          {user && (
            <FormItem name="orderId">
              <FormLabel>Related order (optional)</FormLabel>
              {ordersLoading && !recentOrders ? (
                <Skeleton className={styles.orderSkeleton} />
              ) : (
                <FormControl>
                  <Select
                    value={String(form.values.orderId ?? "__empty")}
                    disabled={!!ordersError && !recentOrders}
                    onValueChange={(value) =>
                      form.setValues((previous) => ({
                        ...previous,
                        orderId: value === "__empty" ? undefined : Number(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Not about an order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty">Not about an order</SelectItem>
                      {recentOrders?.map((order) => (
                        <SelectItem key={order.id} value={String(order.id)}>
                          #{order.id} · {order.restaurantName} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              )}
              {ordersError && (
                <div className={styles.orderError} role="alert">
                  Could not load orders: {ordersError.message}{" "}
                  <Button type="button" variant="link" onClick={onRetryOrders}>
                    Try again
                  </Button>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}

          <FormItem name="subject">
            <FormLabel>Subject</FormLabel>
            <FormControl>
              <Input
                maxLength={120}
                value={form.values.subject}
                onChange={(event) =>
                  form.setValues((previous) => ({
                    ...previous,
                    subject: event.target.value,
                  }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="message">
            <FormLabel>Message</FormLabel>
            <FormControl>
              <Textarea
                minLength={10}
                maxLength={4000}
                placeholder="Tell us how we can help (at least 10 characters)"
                value={form.values.message}
                onChange={(event) =>
                  form.setValues((previous) => ({
                    ...previous,
                    message: event.target.value,
                  }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <Button type="submit" disabled={createTicket.isPending}>
            {createTicket.isPending ? "Sending…" : "Send request"}
          </Button>
        </form>
      </Form>
    </section>
  );
}