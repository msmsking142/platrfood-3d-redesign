import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { orderQueries } from "../../helpers/orderQueries";
import { OutputType } from "./overview_GET.schema";
import { riderKycUrls } from "../../helpers/riderKycUrls";
import { proSubscription } from "../../helpers/proSubscription";

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const settings = await db.selectFrom("appSettings").selectAll().where("id", "=", 1).executeTakeFirstOrThrow();
    const restaurants = await db
      .selectFrom("restaurants")
      .innerJoin("users", "users.id", "restaurants.ownerUserId")
      .select([
        "restaurants.id", "restaurants.name", "restaurants.town", "restaurants.phone",
        "restaurants.plan", "restaurants.proPaidUntil", "restaurants.status", "restaurants.isOpen", "restaurants.createdAt",
        "restaurants.fssaiDocumentUrl", "restaurants.fssaiLicenseNumber", "restaurants.fssaiExpiryDate", "restaurants.fssaiVerificationStatus", "restaurants.fssaiVerificationCheckedAt", "restaurants.fssaiVerificationNote",
        "restaurants.profileImageUrl", "restaurants.pendingProfileImageUrl", "restaurants.profileImageReview",
        "users.displayName as ownerName", "users.email as ownerEmail",
      ])
      .orderBy("restaurants.createdAt", "desc")
      .execute();
    const riders = await db
      .selectFrom("riders")
      .innerJoin("users", "users.id", "riders.userId")
      .select([
        "riders.id", "users.displayName as name", "users.email", "riders.phone", "riders.town",
        "riders.vehicleType", "riders.vehicleNumber", "riders.status", "riders.isOnline", "riders.createdAt",
        "riders.documentsSubmittedAt", "riders.reviewNote", "riders.onboardingFeePaidAt", "riders.licenceFile", "riders.selfieFile",
        "riders.alternatePhone", "riders.licenceExpiryDate", "riders.payoutAccountHolder", "riders.payoutAccountNumber", "riders.payoutIfsc",
        "riders.identityVerificationStatus", "riders.licenceVerificationStatus", "riders.licenceVerificationCheckedAt",
      ])
      .orderBy("riders.createdAt", "desc")
      .execute();
    const ridersWithUrls = await Promise.all(riders.map(async (rider) => {
      const { licenceFile, selfieFile, ...details } = rider;
      return {
        ...details,
        ...await riderKycUrls(licenceFile, selfieFile),
      };
    }));
    const partnerNotes = await db.selectFrom("adminPartnerNotes")
      .selectAll()
      .execute();
    const noteByPartner = new Map(partnerNotes.map((item) => [`${item.recipientRole}:${item.recipientId}`, item]));
    const restaurantsWithNotes = restaurants.map((restaurant) => ({
      ...restaurant,
      adminNote: noteByPartner.get(`restaurant:${restaurant.id}`)?.note ?? null,
      adminReply: (noteByPartner.get(`restaurant:${restaurant.id}`) as any)?.partnerReply ?? null,
      adminReplyAt: (noteByPartner.get(`restaurant:${restaurant.id}`) as any)?.partnerRepliedAt ?? null,
    }));
    const ridersWithNotes = ridersWithUrls.map((rider) => ({
      ...rider,
      adminNote: noteByPartner.get(`rider:${rider.id}`)?.note ?? null,
      adminReply: (noteByPartner.get(`rider:${rider.id}`) as any)?.partnerReply ?? null,
      adminReplyAt: (noteByPartner.get(`rider:${rider.id}`) as any)?.partnerRepliedAt ?? null,
    }));
    const pendingDishPhotos = await db
      .selectFrom("menuItems")
      .innerJoin("restaurants", "restaurants.id", "menuItems.restaurantId")
      .select([
        "menuItems.id", "menuItems.name", "menuItems.restaurantId",
        "restaurants.name as restaurantName", "restaurants.town",
        "menuItems.imageUrl", "menuItems.pendingImageUrl",
      ])
      .where("menuItems.imageReview", "=", "pending")
      .where("menuItems.pendingImageUrl", "is not", null)
      .orderBy("menuItems.id", "asc")
      .execute();
    const orders = await orderQueries({ all: true }, 100);
    const caAnswers = await db.selectFrom("caAnswers")
      .select(["questionNo", "answer", "updatedAt"])
      .orderBy("questionNo")
      .execute();
    const [registrationCounts, pendingProActivations, payouts, unsettled, customers] =
      await Promise.all([
        db.selectFrom("users")
          .select((eb) => [
            "role",
            eb.fn.count<number>("id").as("count"),
          ])
          .where("role", "in", ["user", "restaurant", "rider"])
          .groupBy("role")
          .execute(),
        proSubscription.pendingActivations(),
        db.selectFrom("restaurantPayouts")
          .innerJoin("restaurants", "restaurants.id", "restaurantPayouts.restaurantId")
          .select([
            "restaurantPayouts.id",
            "restaurantPayouts.restaurantId",
            "restaurants.name as restaurantName",
            "restaurants.payoutAccountHolder",
            "restaurants.payoutAccountNumber",
            "restaurants.payoutIfsc",
            "restaurants.payoutUpiId",
            "restaurantPayouts.payoutDate",
            "restaurantPayouts.periodStart",
            "restaurantPayouts.periodEnd",
            "restaurantPayouts.orderCount",
            "restaurantPayouts.foodTotal",
            "restaurantPayouts.commissionTotal",
            "restaurantPayouts.amount",
            "restaurantPayouts.status",
            "restaurantPayouts.utrReference",
            "restaurantPayouts.note",
            "restaurantPayouts.paidAt",
          ])
          .orderBy("restaurantPayouts.payoutDate", "desc")
          .orderBy("restaurantPayouts.id", "desc")
          .limit(100)
          .execute(),
        db.selectFrom("orders")
          .select((eb) => [
            eb.fn.count<number>("id").as("orderCount"),
            eb.fn.coalesce(eb.fn.sum<number>("restaurantPayout"), eb.lit(0)).as("amount"),
          ])
          .where("status", "=", "delivered")
          .where("paymentMethod", "in", ["upi", "wallet"])
          .where("paymentStatus", "=", "paid")
          .where("payoutId", "is", null)
          .executeTakeFirstOrThrow(),
        db.selectFrom("users")
          .leftJoin("orders", "orders.customerUserId", "users.id")
          .select([
            "users.id", "users.displayName as name", "users.email", "users.phone", "users.createdAt", "users.walletBalance",
          ])
          .select((eb) => [
            eb.fn.count<number>("orders.id").as("orderCount"),
            eb.fn.max<Date>("orders.createdAt").as("lastOrderAt"),
          ])
          .where("users.role", "=", "user")
          .where("users.deletedAt", "is", null)
          .groupBy(["users.id", "users.displayName", "users.email", "users.phone", "users.createdAt", "users.walletBalance"])
          .orderBy("users.createdAt", "desc")
          .limit(1000)
          .execute(),
      ]);

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
    const sums = await db
      .selectFrom("orders")
      .select((eb) => [
        eb.fn.count<number>("id").as("n"),
        eb.fn.coalesce(eb.fn.sum<number>("total"), eb.lit(0)).as("gmv"),
        eb.fn.coalesce(eb.fn.sum<number>(eb(eb("commissionAmount", "+", eb.ref("platformFee")), "-", eb.ref("riderBonus"))), eb.lit(0)).as("zipto"),
      ])
      .where("status", "=", "delivered");
    const today = await sums.where("createdAt", ">=", startToday).executeTakeFirst();
    const month = await sums.where("createdAt", ">=", startMonth).executeTakeFirst();
    const pro = restaurants.filter((r) =>
      r.plan === "pro" && r.proPaidUntil !== null && r.proPaidUntil > new Date()
    ).length;

    return requireRole.json({
      stats: {
        ordersToday: Number(today?.n ?? 0),
        gmvToday: Number(today?.gmv ?? 0),
        ziptoToday: Number(today?.zipto ?? 0),
        ziptoMonth: Number(month?.zipto ?? 0),
        proRestaurants: pro,
        proMonthlyIncome: pro * settings.proMonthlyFee,
        pendingApprovals:
          restaurantsWithNotes.filter((r) => r.status === "pending").length +
          riders.filter((r) => r.status === "pending" && r.documentsSubmittedAt !== null).length +
          restaurants.filter((r) => r.profileImageReview === "pending").length +
          pendingDishPhotos.length,
        ridersOnline: riders.filter((r) => r.isOnline && r.status === "approved").length,
      },
      restaurants: restaurantsWithNotes,
      pendingDishPhotos,
      riders: ridersWithNotes,
      customers: customers.map((customer) => ({
        ...customer,
        recentOrders: orders.filter((order) => order.customerUserId === customer.id).slice(0, 5),
      })),
      orders,
      caAnswers,
      registrations: {
        customers: Number(registrationCounts.find((r) => r.role === "user")?.count ?? 0),
        restaurants: Number(registrationCounts.find((r) => r.role === "restaurant")?.count ?? 0),
        riders: Number(registrationCounts.find((r) => r.role === "rider")?.count ?? 0),
      },
      pendingProActivations,
      proBillingStartedAt: settings.proBillingStartedAt,
      payouts,
      unsettledOnline: {
        orderCount: Number(unsettled.orderCount),
        amount: Number(unsettled.amount),
      },

      settings: {
        deliveryFee: settings.deliveryFee,
        platformFee: settings.platformFee,
        riderBonus: settings.riderBonus,
        basicCommissionPercent: settings.basicCommissionPercent,
        proCommissionPercent: settings.proCommissionPercent,
        proMonthlyFee: settings.proMonthlyFee,
        upiId: settings.upiId,
        upiPayeeName: settings.upiPayeeName,
        launchMode: settings.launchMode,
      },
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}