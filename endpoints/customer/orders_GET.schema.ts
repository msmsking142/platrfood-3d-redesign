import { z } from "zod";
import superjson from "superjson";
import type { OrderView } from "../../helpers/orderView";
import type { Selectable } from "kysely";
import type { FoodComplaints, OrderRatings } from "../../helpers/schema";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  orders: (OrderView & {
    rating: Pick<Selectable<OrderRatings>, "rating" | "comment"> | null;
    complaint: Pick<
      Selectable<FoodComplaints>,
      "id" | "status" | "reason" | "refundAmount" | "refundStatus" |
      "refundMethod" | "adminNote" | "createdAt"
    > | null;
    complaintEligible: boolean;
  })[];
  complaintSummary: {
    limit: number;
    used: number;
    remaining: number;
    windowHours: number;
  };
};

export const getCustomerOrders = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/customer/orders`, { method: "GET", ...init });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};