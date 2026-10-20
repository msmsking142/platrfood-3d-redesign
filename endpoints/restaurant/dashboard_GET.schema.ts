import { z } from "zod";
import superjson from "superjson";
import type { OrderView } from "../../helpers/orderView";
import type { Selectable } from "kysely";
import type {
  FoodComplaints, MenuItems, OrderRatings, RestaurantAdjustments, RestaurantPayouts,
  RestaurantCompensations,
} from "../../helpers/schema";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  restaurant: {
    id: number;
    name: string;
    description: string | null;
    cuisine: string | null;
    town: string;
    address: string;
    phone: string;
    lat: number | null;
    lng: number | null;
    plan: "basic" | "pro";
    proPaidUntil: Date | null;
    status: "pending" | "approved" | "rejected" | "suspended";
    isOpen: boolean;
    avgPrepMinutes: number;
    fssaiDocumentUrl: string | null;
    fssaiLicenseNumber: string | null;
    fssaiExpiryDate: Date | null;
    fssaiVerificationStatus: string;
    fssaiVerificationCheckedAt: Date | null;
    fssaiVerificationNote: string | null;
    profileImageUrl: string | null;
    pendingProfileImageUrl: string | null;
    profileImageReview: "none" | "pending" | "approved" | "rejected";
    profileImageRejectReason: string | null;
    panMasked: string | null;
    hasPan: boolean;
  } | null;
  adminNote: { note: string; updatedAt: Date; readAt: Date | null; partnerReply: string | null; partnerRepliedAt: Date | null } | null;
  menu: {
    id: number;
    name: string;
    description: string | null;
    category: string;
    price: number;
    isVeg: boolean;
    isAvailable: boolean;
    imageUrl: string | null;
    pendingImageUrl: string | null;
    imageReview: Selectable<MenuItems>["imageReview"];
    imageRejectReason: string | null;
  }[];
  orders: OrderView[];
  ratingSummary: { average: number | null; count: number };
  recentRatings: Pick<Selectable<OrderRatings>, "orderId" | "rating" | "comment" | "createdAt">[];
  foodComplaints: Pick<
    Selectable<FoodComplaints>,
    "id" | "orderId" | "status" | "reason" | "description" |
    "refundAmount" | "createdAt" | "reviewedAt"
  >[];
  adjustments: Pick<
    Selectable<RestaurantAdjustments>,
    "id" | "amount" | "reason" | "orderId" | "payoutId" | "createdAt"
  >[];
  deliveryProtection: { readyWindowMin: number; maxMin: number };
  compensations: (Pick<
    Selectable<RestaurantCompensations>,
    "id" | "orderId" | "amount" | "status" | "reason" | "disputeNote" |
    "disputedAt" | "adminNote" | "decidedAt" | "createdAt"
  > & {
    settlement: {
      adjustmentId: number | null;
      payoutId: number | null;
      payoutDate: Date | null;
      payoutStatus: Selectable<RestaurantPayouts>["status"] | null;
    };
  })[];
  payoutDetails: {
    accountHolder: string | null;
    accountNumberMasked: string | null;
    ifsc: string | null;
    upiId: string | null;
    updatedAt: Date | null;
  };
  payouts: {
    id: number;
    payoutDate: Date;
    periodStart: Date;
    periodEnd: Date;
    orderCount: number;
    foodTotal: number;
    commissionTotal: number;
    tdsAmount: number;
    adjustmentTotal: number;
    amount: number;
    status: Selectable<RestaurantPayouts>["status"];
    utrReference: string | null;
    paidAt: Date | null;
  }[];
  nextPayout: {
    date: Date;
    pendingAmount: number;
    pendingOrders: number;
    pendingDeductions: number;
  };
  proTrial: {
    eligible: boolean;
    ineligibleReason: string | null;
    days: number;
    startedAt: Date | null;
    endsAt: Date | null;
    cancelledAt: Date | null;
    active: boolean;
  };
  proAwaitingActivation: boolean;
  proAwaitingPaidAt: Date | null;
  stats: { todayOrders: number; todaySales: number; todayPayout: number; monthPayout: number };
};

export const getRestaurantDashboard = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/restaurant/dashboard`, { method: "GET", ...init });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};