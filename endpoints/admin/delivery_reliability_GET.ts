import { sql } from "kysely";
import { db } from "../../helpers/db";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { requireRole } from "../../helpers/requireRole";
import {
  schema,
  type ActiveSearch,
  type Failure,
  type FailureCompensation,
  type OutputType,
  type RiderAvailability,
} from "./delivery_reliability_GET.schema";

const CANCEL_CODE = "PLATFORM_DELIVERY_FAILURE";
const ACTIVE = ["accepted", "preparing", "ready"] as const;

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      days: params.has("days") ? Number(params.get("days")) : undefined,
    });

    try {
      await deliveryProtection.sweep();
    } catch (error) {
      console.error("Delivery-reliability sweep failed:", error);
    }

    const since = new Date(Date.now() - input.days * 86_400_000);
    const freshSince = new Date(Date.now() - 15 * 60_000);

    const [
      settings,
      summary,
      compensationSummary,
      riders,
      areas,
      awaiting,
      searches,
      failureRows,
    ] = await Promise.all([
      db.selectFrom("appSettings")
        .select([
          "riderSearchRadiusM", "riderSearchExpandedRadiusM",
          "riderSearchExpandAfterMin", "riderSearchReadyWindowMin",
          "riderSearchMaxMin", "riderSearchIncentiveEnabled",
          "riderSearchIncentiveAmount", "riderSearchIncentiveCap",
          "deliveryFailureCompEnabled", "deliveryFailureCompBps",
          "deliveryFailureCompMin", "deliveryFailureCompMax",
          "deliveryFailurePrepGraceMin", "areaPauseEnabled",
          "areaPauseFailureThreshold", "areaPauseLookbackMin",
          "areaPauseDurationMin", "areaPauseWhenNoRiders",
        ])
        .where("id", "=", 1)
        .executeTakeFirstOrThrow(),
      db.selectFrom("orders")
        .select((eb) => [
          eb.fn.count<number>("id").as("acceptedOrders"),
          eb.fn.count<number>("id")
            .filterWhere("riderAssignedAt", "is not", null)
            .as("riderAssigned"),
          sql<number | null>`avg(extract(epoch from ${sql.ref("rider_assigned_at")} - ${sql.ref("restaurant_accepted_at")}))`
            .as("avgMatchingSeconds"),
          eb.fn.count<number>("id")
            .filterWhere("cancelCode", "=", CANCEL_CODE)
            .as("failures"),
          eb.fn.sum<number>("total")
            .filterWhere("cancelCode", "=", CANCEL_CODE)
            .as("refundAmount"),
          eb.fn.count<number>("id")
            .filterWhere("cancelCode", "=", CANCEL_CODE)
            .filterWhere("paymentStatus", "=", "refunded")
            .as("refundedCount"),
          eb.fn.count<number>("id")
            .filterWhere("cancelCode", "=", CANCEL_CODE)
            .filterWhere("paymentStatus", "!=", "refunded")
            .as("refundPendingCount"),
          eb.fn.sum<number>("riderSearchIncentive")
            .filterWhere("status", "=", "delivered")
            .as("incentiveCost"),
          eb.fn.count<number>("id")
            .filterWhere("deliveryAtRiskAt", "is not", null)
            .as("atRiskCount"),
        ])
        .where("restaurantAcceptedAt", ">=", since)
        .executeTakeFirstOrThrow(),
      db.selectFrom("restaurantCompensations")
        .innerJoin("orders", "orders.id", "restaurantCompensations.orderId")
        .select((eb) =>
          eb.fn.sum<number>("restaurantCompensations.amount").as("cost"),
        )
        .where("orders.restaurantAcceptedAt", ">=", since)
        .where("restaurantCompensations.status", "=", "approved")
        .executeTakeFirstOrThrow(),
      db.selectFrom("riders")
        .select(["town", "status", "isOnline", "lastLocationAt"])
        .execute(),
      db.selectFrom("serviceAreas")
        .select(["town", "ordersPausedUntil", "ordersPauseReason"])
        .execute(),
      db.selectFrom("orders")
        .select(["town", "id"])
        .where("riderId", "is", null)
        .where("status", "in", ACTIVE)
        .where("restaurantAcceptedAt", "is not", null)
        .execute(),
      db.selectFrom("orders")
        .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
        .select([
          "orders.id", "restaurants.name as restaurantName", "orders.town",
          "orders.status", "orders.restaurantAcceptedAt", "orders.readyAt",
          "orders.riderSearchStage", "orders.riderSearchRadiusM",
          "orders.riderSearchDeadlineAt", "orders.riderSearchIncentive",
          "orders.deliveryAtRiskAt",
        ])
        .where("orders.riderId", "is", null)
        .where("orders.status", "in", ACTIVE)
        .where("orders.restaurantAcceptedAt", "is not", null)
        .orderBy("orders.restaurantAcceptedAt", "asc")
        .execute(),
      db.selectFrom("orders")
        .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
        .select([
          "orders.id", "orders.restaurantId",
          "restaurants.name as restaurantName", "orders.town",
          "orders.total", "orders.itemsTotal", "orders.paymentMethod",
          "orders.paymentStatus", "orders.refundFailedAt",
          "orders.refundFailureReason", "orders.restaurantAcceptedAt",
          "orders.preparingAt", "orders.readyAt",
          "orders.noRiderCancelledAt", "orders.riderSearchDeadlineAt",
          "orders.riderSearchIncentive",
        ])
        .where("orders.cancelCode", "=", CANCEL_CODE)
        .orderBy("orders.noRiderCancelledAt", "desc")
        .orderBy("orders.id", "desc")
        .limit(100)
        .execute(),
    ]);

    const ids = failureRows.map((row) => row.id);
    const [compensations, events] = await Promise.all([
      ids.length
        ? db.selectFrom("restaurantCompensations")
            .leftJoin(
              "restaurantAdjustments",
              "restaurantAdjustments.id",
              "restaurantCompensations.adjustmentId",
            )
            .select([
              "restaurantCompensations.orderId",
              "restaurantCompensations.id",
              "restaurantCompensations.amount",
              "restaurantCompensations.status",
              "restaurantCompensations.reason",
              "restaurantCompensations.disputeNote",
              "restaurantCompensations.disputedAt",
              "restaurantCompensations.adminNote",
              "restaurantCompensations.decidedAt",
              "restaurantCompensations.adjustmentId",
              "restaurantCompensations.calculation",
              "restaurantAdjustments.payoutId as adjustmentPayoutId",
            ])
            .where("restaurantCompensations.orderId", "in", ids)
            .execute()
        : [],
      ids.length
        ? db.selectFrom("orderDeliveryEvents")
            .select(["orderId", "eventType", "createdAt", "detail"])
            .where("orderId", "in", ids)
            .orderBy("createdAt", "asc")
            .orderBy("id", "asc")
            .execute()
        : [],
    ]);

    const compensationByOrder = new Map<number, FailureCompensation>();
    for (const { orderId, ...compensation } of compensations) {
      compensationByOrder.set(orderId, compensation);
    }
    const timelineByOrder = new Map<number, Failure["timeline"]>();
    for (const event of events) {
      const list = timelineByOrder.get(event.orderId) ?? [];
      list.push({
        type: event.eventType,
        at: event.createdAt,
        detail: event.detail,
      });
      timelineByOrder.set(event.orderId, list);
    }
    const failures: Failure[] = failureRows.map((row) => ({
      ...row,
      compensation: compensationByOrder.get(row.id) ?? null,
      timeline: timelineByOrder.get(row.id) ?? [],
    }));

    const towns = new Map<string, RiderAvailability>();
    function getTown(name: string): RiderAvailability {
      const key = name.trim().toLocaleLowerCase("en-IN");
      const existing = towns.get(key);
      if (existing) return existing;
      const created: RiderAvailability = {
        town: name.trim(),
        approvedRiders: 0,
        onlineRiders: 0,
        onlineFresh: 0,
        activeOrdersAwaitingRider: 0,
        ordersPausedUntil: null,
        ordersPauseReason: null,
      };
      towns.set(key, created);
      return created;
    }
    for (const area of areas) {
      const town = getTown(area.town);
      town.ordersPausedUntil = area.ordersPausedUntil;
      town.ordersPauseReason = area.ordersPauseReason;
    }
    for (const rider of riders) {
      const town = getTown(rider.town);
      if (rider.status !== "approved") continue;
      town.approvedRiders++;
      if (rider.isOnline) {
        town.onlineRiders++;
        if (rider.lastLocationAt && rider.lastLocationAt >= freshSince) {
          town.onlineFresh++;
        }
      }
    }
    for (const order of awaiting) {
      getTown(order.town).activeOrdersAwaitingRider++;
    }

    const acceptedOrders = Number(summary.acceptedOrders);
    const failedOrders = Number(summary.failures);
    const counts = {
      disputed: 0,
      notEligible: 0,
      approved: 0,
      rejected: 0,
    };
    for (const failure of failures) {
      switch (failure.compensation?.status) {
        case "disputed": counts.disputed++; break;
        case "not_eligible": counts.notEligible++; break;
        case "approved": counts.approved++; break;
        case "rejected": counts.rejected++; break;
      }
    }

    return requireRole.json({
      settings,
      metrics: {
        acceptedOrders,
        riderAssigned: Number(summary.riderAssigned),
        avgMatchingSeconds: summary.avgMatchingSeconds === null
          ? null
          : Number(summary.avgMatchingSeconds),
        failures: failedOrders,
        failureRatePct: acceptedOrders
          ? Math.round((failedOrders / acceptedOrders) * 1000) / 10
          : 0,
        refundAmount: Number(summary.refundAmount ?? 0),
        refundedCount: Number(summary.refundedCount),
        refundPendingCount: Number(summary.refundPendingCount),
        compensationCost: Number(compensationSummary.cost ?? 0),
        incentiveCost: Number(summary.incentiveCost ?? 0),
        atRiskCount: Number(summary.atRiskCount),
      },
      riderAvailability: [...towns.values()].sort((a, b) =>
        a.town.localeCompare(b.town, "en-IN"),
      ),
      activeSearches: searches satisfies ActiveSearch[],
      failures,
      counts,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}