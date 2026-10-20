import { z } from "zod";
import superjson from "superjson";
import type { OrderView } from "../../helpers/orderView";
import type { Selectable } from "kysely";
import type { RiderEarnings, RiderPayouts } from "../../helpers/schema";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  onboardingFee: {
    baseAmountPaise: number;
    gstAmountPaise: number;
    amountPaise: number;
    gstPercent: number;
  };
  adminNote?: { note: string; updatedAt: Date; readAt: Date | null; partnerReply: string | null; partnerRepliedAt: Date | null } | null;
  earnings: {
    pending: number;
    eligible: number;
    inPayout: number;
    paid: number;
    adjustments: number;
    entries: Pick<Selectable<RiderEarnings>,
      "id" | "orderId" | "entryType" | "basePay" | "distancePay" |
      "incentive" | "amount" | "status" | "eligibleAt" | "note" | "createdAt"
    >[];
  };
  payouts: Pick<Selectable<RiderPayouts>,
    "id" | "payoutDate" | "periodStart" | "periodEnd" | "entryCount" |
    "amount" | "status" | "utrReference" | "note" | "paidAt" | "failureReason"
  >[];
  payoutDetails: {
    accountHolder: string | null;
    accountNumberLast4: string | null;
    ifsc: string | null;
    upiId: string | null;
    hasDetails: boolean;
  };
  payRules: {
    basePay: number;
    baseKm: number;
    perKm: number;
    incentive: number;
    cancelAfterAcceptPay: number;
    holdHours: number;
  };
  rider: {
    id: number;
    name: string;
    phone: string;
    documentsSubmittedAt: Date | null;
    onboardingFeePaidAt: Date | null;
    reviewNote: string | null;
    hasLicence: boolean;
    hasSelfie: boolean;
    licenceUrl: string | null;
    selfieUrl: string | null;
    town: string;
    vehicleType: string;
    vehicleNumber: string | null;
    alternatePhone: string | null;
    licenceExpiryDate: Date | string | null;
    status: "pending" | "approved" | "rejected" | "suspended";
    isOnline: boolean;
  } | null;
  available: OrderView[];
  mine: OrderView[];
  stats: {
    todayDeliveries: number;
    todayEarnings: number;
    weekEarnings: number;
    cashToDeposit: number;
    totalDeliveries: number;
    totalEarnings: number;
    monthEarnings: number;
    bonusEarned: number;
    daily: { date: string; deliveries: number; earnings: number; cod: number }[];
  };
};

export const getRiderDashboard = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/rider/dashboard`, { method: "GET", ...init });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};