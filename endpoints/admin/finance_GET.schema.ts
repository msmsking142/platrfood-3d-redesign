import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type {
  AppSettings,
  Orders,
  PaymentReconciliations,
  RiderPayouts,
  Riders,
  ServiceAreas,
} from "../../helpers/schema";

export const schema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type InputType = z.input<typeof schema>;

type FlaggedOrder = Pick<
  Selectable<Orders>,
  | "id"
  | "createdAt"
  | "status"
  | "town"
  | "itemsTotal"
  | "deliveryFee"
  | "total"
  | "distanceM"
  | "riderPayout"
  | "ziptoDeliverySubsidy"
  | "contribution"
  | "economicsFlag"
  | "economicsReviewedAt"
> & {
  restaurantName: string;
  minimumDeliveryFeeToCover: number | null;
};

type RiderPayoutView = Pick<
  Selectable<RiderPayouts>,
  | "id"
  | "riderId"
  | "payoutDate"
  | "periodStart"
  | "periodEnd"
  | "entryCount"
  | "amount"
  | "status"
  | "utrReference"
  | "note"
  | "failureReason"
  | "approvedAt"
  | "paidAt"
> & Pick<
  Selectable<Riders>,
  "phone" | "payoutUpiId" | "payoutAccountHolder" | "payoutIfsc"
> & {
  riderName: string;
  payoutAccountNumberLast4: string | null;
};

type PricingView = Pick<
  Selectable<AppSettings>,
  | "platformFee"
  | "deliverySlabs"
  | "deliveryPerKmBeyond"
  | "deliveryMinFee"
  | "deliveryMaxFee"
  | "roadFactorPct"
  | "peakFee"
  | "peakStartHour"
  | "peakEndHour"
  | "surgeEnabled"
  | "surgeFee"
  | "surgeReason"
  | "smallOrderFee"
  | "smallOrderThreshold"
  | "riderBasePay"
  | "riderPerKm"
  | "riderPeakIncentive"
  | "riderCancelAfterAcceptPay"
  | "riderEarningHoldHours"
  | "deliveryOpsCost"
  | "promoDeliveryDiscount"
  | "promoMinOrder"
  | "payoutWeekday"
  | "basicCommissionPercent"
  | "proCommissionPercent"
  | "proMonthlyFee"
  | "updatedAt"
  | "ziptoGstin"
> & {
  maxDeliveryKm: number;
  defaultDistanceKm: number;
  deliveryGstPercent: number;
  foodGstPercent: number;
  commissionGstPercent: number;
  restaurantWithholdingPercent: number;
  restaurantNoPanWithholdingPercent: number;
  riderBaseKm: number;
  riderIncentive: number;
  gatewayFeePercent: number;
};

export type OutputType = {
  range: { from: Date; to: Date };
  refundFailures: {
    orders: (Pick<
      Selectable<Orders>,
      | "total"
      | "status"
      | "razorpayPaymentId"
      | "failedRazorpayRefundId"
      | "refundFailureReason"
      | "refundFailedAt"
    > & { orderId: Selectable<Orders>["id"] })[];
    payments: Pick<
      Selectable<PaymentReconciliations>,
      | "id"
      | "kind"
      | "recordId"
      | "amountPaise"
      | "razorpayPaymentId"
      | "razorpayRefundId"
      | "error"
      | "refundFailedAt"
      | "action"
    >[];
  };
  wallet: {
    totalLiability: number;
    walletUsers: number;
    topupsInRange: number;
    spentInRange: number;
    refundsInRange: number;
  };
  summary: {
    customerCollected: number;
    refunds: number;
    restaurantPayableBalance: number;
    riderPayableBalance: number;
    commissionRevenue: number;
    platformFeeRevenue: number;
    deliveryRevenue: number;
    taxCollected: number;
    riderEarnings: number;
    riderIncentives: number;
    riderAdjustments: number;
    gatewayFeesActual: number;
    gatewayFeesEstimated: number;
    ziptoDeliverySubsidy: number;
    deliveredOrders: number;
    contributionTotal: number;
    avgContributionPerOrder: number;
    flaggedOrders: number;
  };
  flaggedOrders: FlaggedOrder[];
  taxSummary: {
    month: string;
    orderCount: number;
    foodSales: number;
    foodGst: number;
    deliveryPlatformGst: number;
    commissionGst: number;
    proSubscriptionGst: number;
    proSubscriptionBase: number;
    proSubscriptionCount: number;
  }[];
  gstReserve: {
    foodGst: number;
    deliveryPlatformGst: number;
    commissionGst: number;
    proSubscriptionGst: number;
    riderOnboardingGst: number;
    totalGst: number;
    proSubscriptionBase: number;
    riderOnboardingBase: number;
    paidFoodOrders: number;
    paidProSubscriptions: number;
    paidRiderOnboardingFees: number;
  };
  riderOnboardingTaxSummary: {
    month: string;
    paymentCount: number;
    baseAmount: number;
    gstAmount: number;
  }[];
  tdsByRestaurant: {
    month: string;
    restaurantId: number;
    restaurantName: string;
    panMasked: string | null;
    hasPan: boolean;
    foodTotal: number;
    tdsAmount: number;
  }[];
  riderPayouts: RiderPayoutView[];
  riderBalances: {
    riderId: number;
    name: string;
    town: string;
    pending: number;
    eligible: number;
    inPayout: number;
    paidTotal: number;
  }[];
  serviceAreas: (Selectable<ServiceAreas> & { maxDeliveryKm: number | null })[];
  pricing: PricingView;
};

export const getAdminFinance = async (
  input: InputType,
  init?: RequestInit,
): Promise<OutputType> => {
  const validated = schema.parse(input);
  const result = await fetch(
    `/_api/admin/finance?${new URLSearchParams({ days: String(validated.days) })}`,
    { ...init, method: "GET" },
  );
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await result.text());
};