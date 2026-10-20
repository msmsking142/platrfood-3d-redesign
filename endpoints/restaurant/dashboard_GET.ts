import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { orderQueries } from "../../helpers/orderQueries";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { OutputType } from "./dashboard_GET.schema";
import { proSubscription } from "../../helpers/proSubscription";
import { nextPayoutFriday } from "../../helpers/nextPayoutFriday";
import { deliveryPricing } from "../../helpers/deliveryPricing";
import { restaurantRatingAverage } from "../../helpers/restaurantRating";
import { redactContactInfo } from "../../helpers/redactContactInfo";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    const restaurant = await db
      .selectFrom("restaurants")
      .select([
        "id", "name", "description", "cuisine", "town", "address", "phone", "lat", "lng",
        "plan", "proPaidUntil", "status", "isOpen", "avgPrepMinutes", "fssaiDocumentUrl", "fssaiLicenseNumber", "fssaiExpiryDate", "fssaiVerificationStatus", "fssaiVerificationCheckedAt", "fssaiVerificationNote",
        "profileImageUrl", "pendingProfileImageUrl", "profileImageReview", "profileImageRejectReason", "pan",
        "ratingSum", "ratingCount",
      ])
      .where("ownerUserId", "=", user.id)
      .executeTakeFirst();
    const protectionSettings = await db.selectFrom("appSettings")
      .select(["riderSearchReadyWindowMin", "riderSearchMaxMin"])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const protectionCopy = {
      readyWindowMin: protectionSettings.riderSearchReadyWindowMin,
      maxMin: protectionSettings.riderSearchMaxMin,
    };
    if (!restaurant) {
      return requireRole.json({
        restaurant: null, adminNote: null, menu: [], orders: [],
        compensations: [], deliveryProtection: protectionCopy,
        payoutDetails: {
          accountHolder: null, accountNumberMasked: null, ifsc: null,
          upiId: null, updatedAt: null,
        },
        payouts: [],
        nextPayout: { date: nextPayoutFriday(new Date()), pendingAmount: 0, pendingOrders: 0, pendingDeductions: 0 },
        ratingSummary: { average: null, count: 0 },
        recentRatings: [], foodComplaints: [], adjustments: [],
        proTrial: {
          eligible: false,
          ineligibleReason: "Complete your restaurant profile first",
          days: 0,
          startedAt: null,
          endsAt: null,
          cancelledAt: null,
          active: false,
        },
        proAwaitingActivation: false,
        proAwaitingPaidAt: null,
        stats: { todayOrders: 0, todaySales: 0, todayPayout: 0, monthPayout: 0 },
      } satisfies OutputType);
    }
    try {
      await deliveryProtection.sweep({ restaurantId: restaurant.id });
    } catch (error) {
      console.error(`No-rider sweep failed for restaurant ${restaurant.id}:`, error);
    }
    const [
      payoutDetails, payouts, pendingPayout, proState, trialState,
      recentRatings, foodComplaints, adjustments, pendingAdjustments, compensations,
    ] = await Promise.all([
      db.selectFrom("restaurants")
        .select([
          "payoutAccountHolder", "payoutAccountNumber", "payoutIfsc",
          "payoutUpiId", "payoutDetailsUpdatedAt",
        ])
        .where("id", "=", restaurant.id)
        .executeTakeFirstOrThrow(),
      db.selectFrom("restaurantPayouts")
        .select([
          "id", "payoutDate", "periodStart", "periodEnd", "orderCount",
          "foodTotal", "commissionTotal", "tdsAmount", "adjustmentTotal", "amount", "status",
          "utrReference", "paidAt",
        ])
        .where("restaurantId", "=", restaurant.id)
        .orderBy("payoutDate", "desc")
        .orderBy("id", "desc")
        .limit(20)
        .execute(),
      db.selectFrom("orders")
        .select((eb) => [
          eb.fn.count<number>("id").as("pendingOrders"),
          eb.fn.coalesce(eb.fn.sum<number>("restaurantPayout"), eb.lit(0)).as("pendingAmount"),
        ])
        .where("restaurantId", "=", restaurant.id)
        .where("status", "=", "delivered")
        .where("paymentMethod", "in", ["upi", "wallet"])
        .where("paymentStatus", "=", "paid")
        .where("payoutId", "is", null)
        .executeTakeFirstOrThrow(),
      proSubscription.restaurantState(restaurant.id),
      proSubscription.trialState(restaurant.id),
      db.selectFrom("orderRatings")
        .select(["orderId", "rating", "comment", "createdAt"])
        .where("restaurantId", "=", restaurant.id)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(20)
        .execute(),
      db.selectFrom("foodComplaints")
        .select([
          "id", "orderId", "status", "reason", "description",
          "refundAmount", "createdAt", "reviewedAt",
        ])
        .where("restaurantId", "=", restaurant.id)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(50)
        .execute(),
      db.selectFrom("restaurantAdjustments")
        .select(["id", "amount", "reason", "orderId", "payoutId", "createdAt"])
        .where("restaurantId", "=", restaurant.id)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(50)
        .execute(),
      db.selectFrom("restaurantAdjustments")
        .select((eb) =>
          eb.fn.coalesce(eb.fn.sum<number>("amount"), eb.lit(0)).as("total")
        )
        .where("restaurantId", "=", restaurant.id)
        .where("payoutId", "is", null)
        .executeTakeFirstOrThrow(),
      db.selectFrom("restaurantCompensations")
        .leftJoin("restaurantAdjustments",
          "restaurantAdjustments.id", "restaurantCompensations.adjustmentId")
        .leftJoin("restaurantPayouts",
          "restaurantPayouts.id", "restaurantAdjustments.payoutId")
        .select([
          "restaurantCompensations.id",
          "restaurantCompensations.orderId",
          "restaurantCompensations.amount",
          "restaurantCompensations.status",
          "restaurantCompensations.reason",
          "restaurantCompensations.disputeNote",
          "restaurantCompensations.disputedAt",
          "restaurantCompensations.adminNote",
          "restaurantCompensations.decidedAt",
          "restaurantCompensations.createdAt",
          "restaurantCompensations.adjustmentId",
          "restaurantAdjustments.payoutId",
          "restaurantPayouts.payoutDate",
          "restaurantPayouts.status as payoutStatus",
        ])
        .where("restaurantCompensations.restaurantId", "=", restaurant.id)
        .orderBy("restaurantCompensations.createdAt", "desc")
        .orderBy("restaurantCompensations.id", "desc")
        .limit(50)
        .execute(),
    ]);
    const menu = await db
      .selectFrom("menuItems")
      .select([
        "id", "name", "description", "category", "price", "isVeg", "isAvailable",
        "imageUrl", "pendingImageUrl", "imageReview", "imageRejectReason",
      ])
      .where("restaurantId", "=", restaurant.id)
      .orderBy("category")
      .orderBy("name")
      .execute();
    const orders = await orderQueries({ restaurantId: restaurant.id }, 60);
    const adminNote = await db.selectFrom("adminPartnerNotes")
      .selectAll()
      .where("recipientRole", "=", "restaurant")
      .where("recipientId", "=", restaurant.id)
      .executeTakeFirst();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
    const done = orders.filter((o) => o.status === "delivered");
    const today = done.filter((o) => o.createdAt >= startToday);
    const month = await db
      .selectFrom("orders")
      .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("restaurantPayout"), eb.lit(0)).as("s"))
      .where("restaurantId", "=", restaurant.id)
      .where("status", "=", "delivered")
      .where("createdAt", ">=", startMonth)
      .executeTakeFirst();
    const { pan, ratingSum, ratingCount, ...publicRestaurant } = restaurant;
    const hasPan = deliveryPricing.isValidPan(pan);
    return requireRole.json({
      restaurant: {
        ...publicRestaurant,
        hasPan,
        panMasked: hasPan ? `XXXXXX${pan!.trim().toUpperCase().slice(-4)}` : null,
      },
      adminNote: adminNote ? { note: adminNote.note, updatedAt: adminNote.updatedAt, readAt: adminNote.readAt, partnerReply: (adminNote as any).partnerReply ?? null, partnerRepliedAt: (adminNote as any).partnerRepliedAt ?? null } : null,
      menu,
      ratingSummary: {
        average: restaurantRatingAverage(ratingSum, ratingCount),
        count: ratingCount,
      },
      recentRatings: recentRatings.map((rating) => ({
        ...rating,
        comment: redactContactInfo(rating.comment),
      })),
      foodComplaints: foodComplaints.map((complaint) => ({
        ...complaint,
        description: redactContactInfo(complaint.description)!,
      })),
      adjustments,
      deliveryProtection: protectionCopy,
      compensations: compensations.map(({
        adjustmentId, payoutId, payoutDate, payoutStatus, ...compensation
      }) => ({
        ...compensation,
        settlement: { adjustmentId, payoutId, payoutDate, payoutStatus },
      })),
      payoutDetails: {
        accountHolder: payoutDetails.payoutAccountHolder,
        accountNumberMasked: payoutDetails.payoutAccountNumber
          ? `XXXXXX${payoutDetails.payoutAccountNumber.slice(-4)}`
          : null,
        ifsc: payoutDetails.payoutIfsc,
        upiId: payoutDetails.payoutUpiId,
        updatedAt: payoutDetails.payoutDetailsUpdatedAt,
      },
      payouts,
      nextPayout: {
        date: nextPayoutFriday(new Date()),
        pendingAmount: Number(pendingPayout.pendingAmount),
        pendingOrders: Number(pendingPayout.pendingOrders),
        pendingDeductions: Number(pendingAdjustments.total),
      },
      proTrial: {
        eligible: trialState.eligible,
        ineligibleReason: trialState.ineligibleReason,
        days: trialState.days,
        startedAt: trialState.trial?.startedAt ?? null,
        endsAt: trialState.trial?.endsAt ?? null,
        cancelledAt: trialState.trial?.cancelledAt ?? null,
        active: trialState.trial?.active ?? false,
      },
      proAwaitingActivation: proState.awaitingActivation,
      proAwaitingPaidAt: proState.awaitingPaidAt,
      orders: orders.filter((order) =>
        order.paymentMethod !== "upi" || order.paymentStatus !== "pending"
      ).map((order) => ({
        ...order,
        notes: redactContactInfo(order.notes),
        customerName: "Customer",
        recipientName: null,
        deliveryAddress: "",
        deliveryPhone: "",
        deliveryLat: null,
        deliveryLng: null,
        upiReference: null,
        riderPhone: null,
        riderLat: ["accepted", "preparing", "ready"].includes(order.status) ? order.riderLat : null,
        riderLng: ["accepted", "preparing", "ready"].includes(order.status) ? order.riderLng : null,
        riderLocationAt: ["accepted", "preparing", "ready"].includes(order.status) ? order.riderLocationAt : null,
      })),
      stats: {
        todayOrders: today.length,
        todaySales: today.reduce((s, o) => s + o.itemsTotal, 0),
        todayPayout: today.reduce((s, o) => s + o.restaurantPayout, 0),
        monthPayout: Number(month?.s ?? 0),
      },
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}