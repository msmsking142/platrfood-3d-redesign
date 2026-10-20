import { z } from "zod";
import superjson from "superjson";
import type { OrderView } from "../../helpers/orderView";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
type Approval = "pending" | "approved" | "rejected" | "suspended";
export type OutputType = {
  stats: {
    ordersToday: number;
    gmvToday: number;
    ziptoToday: number;
    ziptoMonth: number;
    proRestaurants: number;
    proMonthlyIncome: number;
    pendingApprovals: number;
    ridersOnline: number;
  };
  restaurants: {
    id: number; name: string; town: string; phone: string; plan: "basic" | "pro";
    status: Approval; isOpen: boolean; ownerName: string; ownerEmail: string; createdAt: Date;
    fssaiDocumentUrl: string | null; fssaiLicenseNumber: string | null; fssaiExpiryDate: Date | string | null;
    fssaiVerificationStatus: string; fssaiVerificationCheckedAt: Date | null; fssaiVerificationNote: string | null;
    adminNote: string | null;
    adminReply: string | null; adminReplyAt: Date | null;
    profileImageUrl: string | null; pendingProfileImageUrl: string | null;
    profileImageReview: "none" | "pending" | "approved" | "rejected";
  }[];
  pendingDishPhotos: {
    id: number;
    name: string;
    restaurantId: number;
    restaurantName: string;
    town: string;
    imageUrl: string | null;
    pendingImageUrl: string | null;
  }[];
  riders: {
    id: number; name: string; email: string; phone: string; town: string; vehicleType: string;
    vehicleNumber: string | null; status: Approval; isOnline: boolean; createdAt: Date;
    documentsSubmittedAt: Date | null; reviewNote: string | null;
    adminNote: string | null;
    adminReply: string | null; adminReplyAt: Date | null;
    onboardingFeePaidAt: Date | null;
    licenceUrl: string | null; selfieUrl: string | null;
    alternatePhone: string | null; licenceExpiryDate: Date | string | null;
    payoutAccountHolder: string | null; payoutAccountNumber: string | null; payoutIfsc: string | null;
    identityVerificationStatus: string; licenceVerificationStatus: string; licenceVerificationCheckedAt: Date | null;
  }[];
  customers: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    createdAt: Date | null;
    walletBalance: number;
    orderCount: number;
    lastOrderAt: Date | null;
    recentOrders: OrderView[];
  }[];
  orders: OrderView[];
  caAnswers: { questionNo: number; answer: string; updatedAt: Date }[];
  registrations: { customers: number; restaurants: number; riders: number };
  pendingProActivations: {
    paymentId: number;
    restaurantId: number;
    restaurantName: string;
    ownerName: string;
    ownerEmail: string;
    amount: number;
    paidAt: Date;
  }[];
  proBillingStartedAt: Date | null;
  payouts: {
    id: number;
    restaurantId: number;
    restaurantName: string;
    payoutAccountHolder: string | null;
    payoutAccountNumber: string | null;
    payoutIfsc: string | null;
    payoutUpiId: string | null;
    payoutDate: Date;
    periodStart: Date;
    periodEnd: Date;
    orderCount: number;
    foodTotal: number;
    commissionTotal: number;
    amount: number;
    status: "on_hold" | "paid" | "pending" | "processing" | "approved" | "failed";
    utrReference: string | null;
    note: string | null;
    paidAt: Date | null;
  }[];
  unsettledOnline: { orderCount: number; amount: number };

  settings: {
    deliveryFee: number; platformFee: number; riderBonus: number;
    basicCommissionPercent: number; proCommissionPercent: number; proMonthlyFee: number;
    upiId: string | null; upiPayeeName: string; launchMode: boolean;
  };
};

export const getAdminOverview = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/overview`, { method: "GET", ...init });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};