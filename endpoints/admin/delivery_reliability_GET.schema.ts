import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type {
  AppSettings,
  Orders,
  RestaurantCompensations,
} from "../../helpers/schema";

export const schema = z.object({
  days: z.number().int().min(1).max(90).default(7),
});

export type InputType = z.input<typeof schema>;

export type ProtectionSettings = Pick<
  Selectable<AppSettings>,
  | "riderSearchRadiusM"
  | "riderSearchExpandedRadiusM"
  | "riderSearchExpandAfterMin"
  | "riderSearchReadyWindowMin"
  | "riderSearchMaxMin"
  | "riderSearchIncentiveEnabled"
  | "riderSearchIncentiveAmount"
  | "riderSearchIncentiveCap"
  | "deliveryFailureCompEnabled"
  | "deliveryFailureCompBps"
  | "deliveryFailureCompMin"
  | "deliveryFailureCompMax"
  | "deliveryFailurePrepGraceMin"
  | "areaPauseEnabled"
  | "areaPauseFailureThreshold"
  | "areaPauseLookbackMin"
  | "areaPauseDurationMin"
  | "areaPauseWhenNoRiders"
>;

export type ReliabilityMetrics = {
  acceptedOrders: number;
  riderAssigned: number;
  avgMatchingSeconds: number | null;
  failures: number;
  failureRatePct: number;
  refundAmount: number;
  refundedCount: number;
  refundPendingCount: number;
  compensationCost: number;
  incentiveCost: number;
  atRiskCount: number;
};

export type RiderAvailability = {
  town: string;
  approvedRiders: number;
  onlineRiders: number;
  onlineFresh: number;
  activeOrdersAwaitingRider: number;
  ordersPausedUntil: Date | null;
  ordersPauseReason: string | null;
};

export type ActiveSearch = Pick<
  Selectable<Orders>,
  | "id"
  | "town"
  | "status"
  | "restaurantAcceptedAt"
  | "readyAt"
  | "riderSearchStage"
  | "riderSearchRadiusM"
  | "riderSearchDeadlineAt"
  | "riderSearchIncentive"
  | "deliveryAtRiskAt"
> & { restaurantName: string };

export type FailureCompensation = Pick<
  Selectable<RestaurantCompensations>,
  | "id"
  | "amount"
  | "status"
  | "reason"
  | "disputeNote"
  | "disputedAt"
  | "adminNote"
  | "decidedAt"
  | "adjustmentId"
  | "calculation"
> & { adjustmentPayoutId: number | null };

export type Failure = Pick<
  Selectable<Orders>,
  | "id"
  | "restaurantId"
  | "town"
  | "total"
  | "itemsTotal"
  | "paymentMethod"
  | "paymentStatus"
  | "refundFailedAt"
  | "refundFailureReason"
  | "restaurantAcceptedAt"
  | "preparingAt"
  | "readyAt"
  | "noRiderCancelledAt"
  | "riderSearchDeadlineAt"
  | "riderSearchIncentive"
> & {
  restaurantName: string;
  compensation: FailureCompensation | null;
  timeline: Array<{
    type: string;
    at: Date;
    detail: Selectable<import("../../helpers/schema").OrderDeliveryEvents>["detail"];
  }>;
};

export type OutputType = {
  settings: ProtectionSettings;
  metrics: ReliabilityMetrics;
  riderAvailability: RiderAvailability[];
  activeSearches: ActiveSearch[];
  failures: Failure[];
  counts: {
    disputed: number;
    notEligible: number;
    approved: number;
    rejected: number;
  };
};

export async function getAdminDeliveryReliability(
  body: InputType = {},
  init?: RequestInit,
): Promise<OutputType> {
  const input = schema.parse(body);
  const response = await fetch(
    `/_api/admin/delivery_reliability?${new URLSearchParams({ days: String(input.days) })}`,
    { method: "GET", ...init },
  );
  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await response.text());
}