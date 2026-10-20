import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type {
  FoodComplaints,
  Orders,
  Restaurants,
  Users,
} from "../../helpers/schema";

export const schema = z.object({
  status: z.enum(["pending", "all"]).default("all"),
});
export type InputType = z.input<typeof schema>;

export type ComplaintView = Pick<
  Selectable<FoodComplaints>,
  | "id" | "orderId" | "status" | "reason" | "description"
  | "refundStatus" | "refundMethod" | "refundError"
  | "razorpayRefundId" | "adminNote" | "createdAt" | "reviewedAt"
> & {
  imageUrls: string[];
  refundAmount: number;
  order: Pick<
    Selectable<Orders>,
    "itemsTotal" | "total" | "paymentMethod" | "deliveredAt"
  > & {
    items: Array<{ name: string; qty: number; price: number }>;
  };
  restaurant: Pick<Selectable<Restaurants>, "id" | "name">;
  customer: Pick<Selectable<Users>, "id" | "email"> & {
    name: string;
    usedRefunds: number;
    limit: number;
  };
};

export type OutputType = {
  complaints: ComplaintView[];
  settings: {
    limit: number;
    refundBps: number;
    windowHours: number;
  };
};

export const getAdminComplaints = async (
  body: InputType = {},
  init?: RequestInit,
): Promise<OutputType> => {
  const input = schema.parse(body);
  const params = new URLSearchParams({ status: input.status });
  const result = await fetch(`/_api/admin/complaints?${params}`, {
    method: "GET",
    ...init,
  });
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};