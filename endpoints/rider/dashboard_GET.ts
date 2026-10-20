import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { orderQueries } from "../../helpers/orderQueries";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { riderSearchDecision } from "../../helpers/riderSearchDecision";
import { riderKycUrls } from "../../helpers/riderKycUrls";
import { riderDeliveryStats } from "../../helpers/riderDeliveryStats";
import { riderFinanceDashboard } from "../../helpers/riderFinanceDashboard";
import { riderOnboardingFee } from "../../helpers/riderOnboardingFee";
import { OutputType } from "./dashboard_GET.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["rider"]);
    const { baseAmountPaise, gstAmountPaise, amountPaise, gstPercent } =
      await riderOnboardingFee.computeFee();
    const onboardingFee = { baseAmountPaise, gstAmountPaise, amountPaise, gstPercent };
    const rider = await db
      .selectFrom("riders")
      .innerJoin("users", "users.id", "riders.userId")
      .select([
        "riders.id", "riders.phone", "riders.town", "riders.vehicleType",
        "riders.vehicleNumber", "riders.alternatePhone", "riders.licenceExpiryDate", "riders.status", "riders.isOnline",
        "riders.lastLat", "riders.lastLng",
        "riders.documentsSubmittedAt", "riders.reviewNote",
        "riders.onboardingFeePaidAt",
        "riders.licenceFile", "riders.selfieFile",
        "riders.payoutAccountHolder", "riders.payoutAccountNumber",
        "riders.payoutIfsc", "riders.payoutUpiId",
        "users.displayName as name",
      ])
      .where("riders.userId", "=", user.id)
      .executeTakeFirst();

    if (!rider) {
      const finance = await riderFinanceDashboard(null);
      return requireRole.json({
        ...finance,
        onboardingFee,
        adminNote: null,
        rider: null,
        available: [],
        mine: [],
        stats: {
          todayDeliveries: 0, todayEarnings: 0, weekEarnings: 0,
          cashToDeposit: 0, totalDeliveries: 0, totalEarnings: 0,
          monthEarnings: 0, bonusEarned: 0, daily: [],
        },
      } satisfies OutputType);
    }

    if (rider.status === "approved" && rider.isOnline) {
      try {
        await deliveryProtection.sweep({ town: rider.town });
      } catch (error) {
        console.error(`No-rider sweep failed for town ${rider.town}:`, error);
      }
    }

    const [available, mine, stats, urls, finance] = await Promise.all([
      rider.status === "approved" && rider.isOnline
        ? orderQueries({ availableInTown: rider.town }, 30)
        : Promise.resolve([]),
      orderQueries({ riderId: rider.id }, 200),
      riderDeliveryStats(rider.id),
      riderKycUrls(rider.licenceFile, rider.selfieFile),
      riderFinanceDashboard(rider),
    ]);
    const adminNote = await db.selectFrom("adminPartnerNotes")
      .selectAll()
      .where("recipientRole", "=", "rider")
      .where("recipientId", "=", rider.id)
      .executeTakeFirst();
    const {
      licenceFile, selfieFile, payoutAccountHolder, payoutAccountNumber,
      payoutIfsc, payoutUpiId, lastLat, lastLng, ...profile
    } = rider;
    return requireRole.json({
      ...finance,
      onboardingFee,
      adminNote: adminNote ? { note: adminNote.note, updatedAt: adminNote.updatedAt, readAt: adminNote.readAt, partnerReply: (adminNote as any).partnerReply ?? null, partnerRepliedAt: (adminNote as any).partnerRepliedAt ?? null } : null,
      rider: {
        ...profile,
        hasLicence: licenceFile !== null,
        hasSelfie: selfieFile !== null,
        ...urls,
      },
      available: available.filter((order) =>
        riderSearchDecision.withinRadius(
          lastLat, lastLng, order.restaurantLat, order.restaurantLng,
          order.riderSearchRadiusM,
        )
      ).map((order) => ({
        ...order,
        deliveryPhone: "",
        restaurantPhone: "",
        recipientName: null,
        customerName: "Customer",
        notes: null,
      })),
      mine: mine.map((order) => ({
        ...order,
        deliveryPhone: "",
        restaurantPhone: "",
      })),
      stats,
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}