import { db } from "../../helpers/db";
import { requireRole } from "../../helpers/requireRole";
import { sql, type Selectable } from "kysely";
import { deliveryPricing } from "../../helpers/deliveryPricing";
import { mergeProSubscriptionTaxSummary } from "../../helpers/proSubscriptionTaxSummary";
import { ziptoWallet } from "../../helpers/ziptoWallet";
import type { LedgerEntries, Orders } from "../../helpers/schema";
import { schema, type OutputType } from "./finance_GET.schema";

function minimumDeliveryFeeToCover(
  snapshot: Selectable<Orders>["pricingSnapshot"],
): number | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const economics = snapshot.economics;
  if (!economics || typeof economics !== "object" || Array.isArray(economics)) {
    return null;
  }

  const value = economics.minimumDeliveryFeeToCover;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function maskedAccountLast4(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\s/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : null;
}

export async function handle(request: Request) {
  try {
    await requireRole(request, ["admin"]);

    const { days } = schema.parse({
      days: new URL(request.url).searchParams.get("days") ?? undefined,
    });
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const istNow = new Date(to.getTime() + 330 * 60_000);
    const taxStart = new Date(Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth() - 11,
      1,
      -5,
      -30,
    ));
    const taxEnd = new Date(Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth() + 1,
      1,
      -5,
      -30,
    ));
    const deliveryMonth = sql<string>`to_char(${sql.ref("orders.deliveredAt")} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`;
    const payoutMonth = sql<string>`to_char(${sql.ref("restaurantPayouts.payoutDate")} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`;
    const subscriptionMonth = sql<string>`to_char(${sql.ref("subscriptionPayments.paidAt")} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`;
    const riderOnboardingMonth = sql<string>`to_char(${sql.ref("riderOnboardingPayments.paidAt")} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`;

    const [
      settings,
      walletLiability,
      walletUserCount,
      walletTransactionTotals,
      ledgerTotals,
      restaurantBalance,
      riderBalance,
      orderTotals,
      earningTotals,
      flaggedRows,
      payoutRows,
      riderBalanceRows,
      serviceAreaRows,
      taxRows,
      subscriptionTaxRows,
      riderOnboardingTaxRows,
      allTimeOrderTax,
      allTimeSubscriptionTax,
      allTimeRiderOnboardingTax,
      tdsRows,
      failedOrderRefunds,
      failedPaymentRefunds,
    ] = await Promise.all([
      db.selectFrom("appSettings")
        .selectAll()
        .where("id", "=", 1)
        .executeTakeFirstOrThrow(),

      ziptoWallet.totalLiability(),

      db.selectFrom("users")
        .select((eb) => eb.fn.count<number>("id").as("count"))
        .where("walletBalance", ">", 0)
        .executeTakeFirstOrThrow(),

      db.selectFrom("walletTransactions")
        .select((eb) => [
          eb.fn.sum<number>("amount")
            .filterWhere("type", "=", "topup")
            .as("topups"),
          eb.fn.sum<number>("amount")
            .filterWhere("type", "=", "order_payment")
            .as("orderPayments"),
          eb.fn.sum<number>("amount")
            .filterWhere("type", "=", "order_refund")
            .as("refunds"),
        ])
        .where("status", "=", "success")
        .where("completedAt", ">=", from)
        .where("completedAt", "<", to)
        .executeTakeFirstOrThrow(),

      db.selectFrom("ledgerEntries")
        .select("entryType")
        .select((eb) => eb.fn.sum<number>("amount").as("amount"))
        .where("createdAt", ">=", from)
        .where("createdAt", "<", to)
        .groupBy("entryType")
        .execute(),

      db.selectFrom("ledgerEntries")
        .select((eb) => eb.fn.sum<number>("amount").as("amount"))
        .where("entryType", "in", ["restaurant_payable", "restaurant_payout"])
        .executeTakeFirstOrThrow(),

      db.selectFrom("ledgerEntries")
        .select((eb) => eb.fn.sum<number>("amount").as("amount"))
        .where((eb) =>
          eb.or([
            eb("entryType", "in", ["rider_payable", "rider_payout"]),
            eb.and([
              eb("entryType", "=", "adjustment"),
              eb("riderId", "is not", null),
            ]),
          ])
        )
        .executeTakeFirstOrThrow(),

      db.selectFrom("orders")
        .select((eb) => [
          eb.fn.count<number>("id").as("deliveredOrders"),
          eb.fn.sum<number>("contribution").as("contributionTotal"),
          eb.fn.count<number>("id")
            .filterWhere("economicsFlag", "is not", null)
            .as("flaggedOrders"),
          eb.fn.sum<number>("gatewayFeeEstimate")
            .filterWhere("paymentMethod", "=", "upi")
            .filterWhere("gatewayFee", "is", null)
            .as("gatewayFeesEstimated"),
        ])
        .where("status", "=", "delivered")
        .where("deliveredAt", ">=", from)
        .where("deliveredAt", "<", to)
        .executeTakeFirstOrThrow(),

      db.selectFrom("riderEarnings")
        .select((eb) => [
          eb.fn.sum<number>("amount")
            .filterWhere("entryType", "in", ["delivery", "cancellation"])
            .as("earnings"),
          eb.fn.sum<number>("incentive").as("incentives"),
          eb.fn.sum<number>("amount")
            .filterWhere("entryType", "=", "adjustment")
            .as("adjustments"),
        ])
        .where("createdAt", ">=", from)
        .where("createdAt", "<", to)
        .where("status", "!=", "reversed")
        .executeTakeFirstOrThrow(),

      // The flagged-order worklist is all-time and includes non-delivered orders.
      db.selectFrom("orders")
        .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
        .select([
          "orders.id",
          "orders.createdAt",
          "orders.status",
          "orders.town",
          "restaurants.name as restaurantName",
          "orders.itemsTotal",
          "orders.deliveryFee",
          "orders.total",
          "orders.distanceM",
          "orders.riderPayout",
          "orders.ziptoDeliverySubsidy",
          "orders.contribution",
          "orders.economicsFlag",
          "orders.economicsReviewedAt",
          "orders.pricingSnapshot",
        ])
        .where("orders.economicsFlag", "is not", null)
        .orderBy("orders.createdAt", "desc")
        .orderBy("orders.id", "desc")
        .limit(100)
        .execute(),

      db.selectFrom("riderPayouts")
        .innerJoin("riders", "riders.id", "riderPayouts.riderId")
        .innerJoin("users", "users.id", "riders.userId")
        .select([
          "riderPayouts.id",
          "riderPayouts.riderId",
          "users.displayName as riderName",
          "riders.phone",
          "riders.payoutUpiId",
          "riders.payoutAccountHolder",
          "riders.payoutAccountNumber",
          "riders.payoutIfsc",
          "riderPayouts.payoutDate",
          "riderPayouts.periodStart",
          "riderPayouts.periodEnd",
          "riderPayouts.entryCount",
          "riderPayouts.amount",
          "riderPayouts.status",
          "riderPayouts.utrReference",
          "riderPayouts.note",
          "riderPayouts.failureReason",
          "riderPayouts.approvedAt",
          "riderPayouts.paidAt",
        ])
        .orderBy("riderPayouts.createdAt", "desc")
        .orderBy("riderPayouts.id", "desc")
        .limit(100)
        .execute(),

      db.selectFrom("riders")
        .innerJoin("users", "users.id", "riders.userId")
        .leftJoin("riderEarnings", "riderEarnings.riderId", "riders.id")
        .select((eb) => [
          "riders.id as riderId",
          "users.displayName as name",
          "riders.town",
          eb.fn.sum<number>("riderEarnings.amount")
            .filterWhere("riderEarnings.status", "=", "pending")
            .as("pending"),
          eb.fn.sum<number>("riderEarnings.amount")
            .filterWhere("riderEarnings.status", "=", "eligible")
            .as("eligible"),
          eb.fn.sum<number>("riderEarnings.amount")
            .filterWhere("riderEarnings.status", "=", "in_payout")
            .as("inPayout"),
          eb.fn.sum<number>("riderEarnings.amount")
            .filterWhere("riderEarnings.status", "=", "paid")
            .as("paidTotal"),
        ])
        .where("riders.status", "=", "approved")
        .groupBy(["riders.id", "users.displayName", "riders.town"])
        .orderBy("users.displayName", "asc")
        .execute(),

      db.selectFrom("serviceAreas").selectAll().orderBy("town", "asc").execute(),

      db.selectFrom("orders")
        .select([
          deliveryMonth.as("month"),
          (eb) => eb.fn.count<number>("id").as("orderCount"),
          (eb) => eb.fn.sum<number>(
            sql<number>`${eb.ref("itemsTotal")} - ${eb.ref("restaurantDiscount")}`,
          ).as("foodSales"),
          (eb) => eb.fn.sum<number>("foodTax").as("foodGst"),
          (eb) => eb.fn.sum<number>("deliveryTax").as("deliveryPlatformGst"),
          (eb) => eb.fn.sum<number>("commissionTax").as("commissionGst"),
        ])
        .where("status", "=", "delivered")
        .where("paymentMethod", "in", ["upi", "wallet"])
        .where("paymentStatus", "=", "paid")
        .where("deliveredAt", ">=", taxStart)
        .where("deliveredAt", "<", taxEnd)
        .groupBy(deliveryMonth)
        .orderBy(deliveryMonth, "asc")
        .execute(),

      db.selectFrom("subscriptionPayments")
        .select([
          subscriptionMonth.as("month"),
          (eb) => eb.fn.count<number>("id").as("proSubscriptionCount"),
          (eb) => eb.fn.sum<number>("baseAmount").as("proSubscriptionBase"),
          (eb) => eb.fn.sum<number>("gstAmount").as("proSubscriptionGst"),
        ])
        .where("status", "=", "paid")
        .where("paidAt", ">=", taxStart)
        .where("paidAt", "<", taxEnd)
        .groupBy(subscriptionMonth)
        .execute(),

      db.selectFrom("riderOnboardingPayments")
        .select([
          riderOnboardingMonth.as("month"),
          (eb) => eb.fn.count<number>("id").as("paymentCount"),
          (eb) => eb.fn.sum<number>(sql<number>`${eb.ref("baseAmountPaise")} / 100`).as("baseAmount"),
          (eb) => eb.fn.sum<number>(sql<number>`${eb.ref("gstAmountPaise")} / 100`).as("gstAmount"),
        ])
        .where("status", "=", "paid")
        .where("paidAt", ">=", taxStart)
        .where("paidAt", "<", taxEnd)
        .groupBy(riderOnboardingMonth)
        .orderBy(riderOnboardingMonth, "asc")
        .execute(),

      db.selectFrom("orders")
        .select((eb) => [
          eb.fn.count<number>("id").as("paidFoodOrders"),
          eb.fn.sum<number>("foodTax").as("foodGst"),
          eb.fn.sum<number>("deliveryTax").as("deliveryPlatformGst"),
          eb.fn.sum<number>("commissionTax").as("commissionGst"),
        ])
        .where("status", "=", "delivered")
        .where("paymentMethod", "in", ["upi", "wallet"])
        .where("paymentStatus", "=", "paid")
        .executeTakeFirstOrThrow(),

      db.selectFrom("subscriptionPayments")
        .select((eb) => [
          eb.fn.count<number>("id").as("paidProSubscriptions"),
          eb.fn.sum<number>("gstAmount").as("proSubscriptionGst"),
          eb.fn.sum<number>("baseAmount").as("proSubscriptionBase"),
        ])
        .where("status", "=", "paid")
        .executeTakeFirstOrThrow(),

      db.selectFrom("riderOnboardingPayments")
        .select((eb) => [
          eb.fn.count<number>("id").as("paidRiderOnboardingFees"),
          eb.fn.sum<number>(sql<number>`${eb.ref("gstAmountPaise")} / 100`).as("riderOnboardingGst"),
          eb.fn.sum<number>(sql<number>`${eb.ref("baseAmountPaise")} / 100`).as("riderOnboardingBase"),
        ])
        .where("status", "=", "paid")
        .executeTakeFirstOrThrow(),

      db.selectFrom("restaurantPayouts")
        .innerJoin("restaurants", "restaurants.id", "restaurantPayouts.restaurantId")
        .select([
          payoutMonth.as("month"),
          "restaurantPayouts.restaurantId",
          "restaurants.name as restaurantName",
          "restaurants.pan",
          (eb) => eb.fn.sum<number>("restaurantPayouts.foodTotal").as("foodTotal"),
          (eb) => eb.fn.sum<number>("restaurantPayouts.tdsAmount").as("tdsAmount"),
        ])
        .where("restaurantPayouts.payoutDate", ">=", taxStart)
        .where("restaurantPayouts.payoutDate", "<", taxEnd)
        .groupBy([
          payoutMonth,
          "restaurantPayouts.restaurantId",
          "restaurants.name",
          "restaurants.pan",
        ])
        .orderBy(payoutMonth, "asc")
        .orderBy("restaurantPayouts.restaurantId", "asc")
        .execute(),

      db.selectFrom("orders")
        .select([
          "id as orderId",
          "total",
          "status",
          "razorpayPaymentId",
          "failedRazorpayRefundId",
          "refundFailureReason",
          "refundFailedAt",
        ])
        .where("refundFailedAt", "is not", null)
        .where("paymentStatus", "=", "paid")
        .where("razorpayRefundId", "is", null)
        .orderBy("refundFailedAt", "desc")
        .orderBy("id", "desc")
        .limit(100)
        .execute(),

      db.selectFrom("paymentReconciliations")
        .select([
          "id",
          "kind",
          "recordId",
          "amountPaise",
          "razorpayPaymentId",
          "razorpayRefundId",
          "error",
          "refundFailedAt",
          "action",
        ])
        .where("status", "=", "refund_failed")
        .orderBy("refundFailedAt", "desc")
        .orderBy("id", "desc")
        .limit(100)
        .execute(),
    ]);

    const amounts = new Map<Selectable<LedgerEntries>["entryType"], number>(
      ledgerTotals.map((row) => [row.entryType, Number(row.amount ?? 0)]),
    );
    const ledger = (type: Selectable<LedgerEntries>["entryType"]) =>
      amounts.get(type) ?? 0;

    const deliveredOrders = Number(orderTotals.deliveredOrders);
    const contributionTotal = Number(orderTotals.contributionTotal ?? 0);

    const flaggedOrders = flaggedRows.map(({ pricingSnapshot, ...order }) => ({
      ...order,
      minimumDeliveryFeeToCover: minimumDeliveryFeeToCover(pricingSnapshot),
    }));

    const riderPayouts = payoutRows.map(({ payoutAccountNumber, ...payout }) => ({
      ...payout,
      payoutAccountNumberLast4: maskedAccountLast4(payoutAccountNumber),
    }));

    const result: OutputType = {
      range: { from, to },
      refundFailures: {
        orders: failedOrderRefunds,
        payments: failedPaymentRefunds,
      },
      wallet: {
        totalLiability: walletLiability,
        walletUsers: Number(walletUserCount.count),
        topupsInRange: Number(walletTransactionTotals.topups ?? 0),
        spentInRange: -Number(walletTransactionTotals.orderPayments ?? 0),
        refundsInRange: Number(walletTransactionTotals.refunds ?? 0),
      },
      summary: {
        customerCollected: ledger("customer_payment") + ledger("cod_collected"),
        refunds: Math.abs(ledger("customer_refund")),
        restaurantPayableBalance: Number(restaurantBalance.amount ?? 0),
        riderPayableBalance: Number(riderBalance.amount ?? 0),
        commissionRevenue: ledger("platform_commission"),
        platformFeeRevenue: ledger("platform_fee"),
        deliveryRevenue: ledger("delivery_revenue"),
        taxCollected: ledger("tax_collected"),
        riderEarnings: Number(earningTotals.earnings ?? 0),
        riderIncentives: Number(earningTotals.incentives ?? 0),
        riderAdjustments: Number(earningTotals.adjustments ?? 0),
        gatewayFeesActual: ledger("gateway_fee"),
        gatewayFeesEstimated: Number(orderTotals.gatewayFeesEstimated ?? 0),
        ziptoDeliverySubsidy: ledger("zipto_delivery_subsidy"),
        deliveredOrders,
        contributionTotal,
        avgContributionPerOrder: deliveredOrders
          ? Math.round((contributionTotal / deliveredOrders) * 100) / 100
          : 0,
        flaggedOrders: Number(orderTotals.flaggedOrders),
      },
      flaggedOrders,
      taxSummary: mergeProSubscriptionTaxSummary(
        taxRows.map((row) => ({
          month: row.month,
          orderCount: Number(row.orderCount),
          foodSales: Number(row.foodSales ?? 0),
          foodGst: Number(row.foodGst ?? 0),
          deliveryPlatformGst: Number(row.deliveryPlatformGst ?? 0),
          commissionGst: Number(row.commissionGst ?? 0),
        })),
        subscriptionTaxRows,
      ),
      gstReserve: (() => {
        const foodGst = Number(allTimeOrderTax.foodGst ?? 0);
        const deliveryPlatformGst = Number(allTimeOrderTax.deliveryPlatformGst ?? 0);
        const commissionGst = Number(allTimeOrderTax.commissionGst ?? 0);
        const proSubscriptionGst = Number(allTimeSubscriptionTax.proSubscriptionGst ?? 0);
        const riderOnboardingGst = Number(allTimeRiderOnboardingTax.riderOnboardingGst ?? 0);
        return {
          foodGst,
          deliveryPlatformGst,
          commissionGst,
          proSubscriptionGst,
          riderOnboardingGst,
          totalGst: foodGst + deliveryPlatformGst + commissionGst + proSubscriptionGst + riderOnboardingGst,
          proSubscriptionBase: Number(allTimeSubscriptionTax.proSubscriptionBase ?? 0),
          riderOnboardingBase: Number(allTimeRiderOnboardingTax.riderOnboardingBase ?? 0),
          paidFoodOrders: Number(allTimeOrderTax.paidFoodOrders ?? 0),
          paidProSubscriptions: Number(allTimeSubscriptionTax.paidProSubscriptions ?? 0),
          paidRiderOnboardingFees: Number(allTimeRiderOnboardingTax.paidRiderOnboardingFees ?? 0),
        };
      })(),
      riderOnboardingTaxSummary: riderOnboardingTaxRows.map((row) => ({
        month: row.month,
        paymentCount: Number(row.paymentCount),
        baseAmount: Number(row.baseAmount ?? 0),
        gstAmount: Number(row.gstAmount ?? 0),
      })),
      tdsByRestaurant: tdsRows.map((row) => {
        const hasPan = deliveryPricing.isValidPan(row.pan);
        return {
          month: row.month,
          restaurantId: row.restaurantId,
          restaurantName: row.restaurantName,
          panMasked: hasPan ? `XXXXXX${row.pan!.trim().toUpperCase().slice(-4)}` : null,
          hasPan,
          foodTotal: Number(row.foodTotal ?? 0),
          tdsAmount: Number(row.tdsAmount ?? 0),
        };
      }),
      riderPayouts,
      riderBalances: riderBalanceRows.map((row) => ({
        riderId: row.riderId,
        name: row.name,
        town: row.town,
        pending: Number(row.pending ?? 0),
        eligible: Number(row.eligible ?? 0),
        inPayout: Number(row.inPayout ?? 0),
        paidTotal: Number(row.paidTotal ?? 0),
      })),
      serviceAreas: serviceAreaRows.map((area) => ({
        ...area,
        maxDeliveryKm: area.maxDeliveryM === null
          ? null
          : area.maxDeliveryM / 1000,
      })),
      pricing: {
        platformFee: settings.platformFee,
        deliverySlabs: settings.deliverySlabs,
        deliveryPerKmBeyond: settings.deliveryPerKmBeyond,
        deliveryMinFee: settings.deliveryMinFee,
        deliveryMaxFee: settings.deliveryMaxFee,
        maxDeliveryKm: settings.maxDeliveryM / 1000,
        defaultDistanceKm: settings.defaultDistanceM / 1000,
        roadFactorPct: settings.roadFactorPct,
        peakFee: settings.peakFee,
        peakStartHour: settings.peakStartHour,
        peakEndHour: settings.peakEndHour,
        surgeEnabled: settings.surgeEnabled,
        surgeFee: settings.surgeFee,
        surgeReason: settings.surgeReason,
        smallOrderFee: settings.smallOrderFee,
        smallOrderThreshold: settings.smallOrderThreshold,
        deliveryGstPercent: settings.deliveryGstBps / 100,
        foodGstPercent: settings.foodGstBps / 100,
        commissionGstPercent: settings.commissionGstBps / 100,
        restaurantWithholdingPercent: settings.restaurantWithholdingBps / 100,
        restaurantNoPanWithholdingPercent: settings.restaurantNoPanWithholdingBps / 100,
        ziptoGstin: settings.ziptoGstin,
        riderBasePay: settings.riderBasePay,
        riderBaseKm: settings.riderBaseM / 1000,
        riderPerKm: settings.riderPerKm,
        riderIncentive: settings.riderBonus,
        riderPeakIncentive: settings.riderPeakIncentive,
        riderCancelAfterAcceptPay: settings.riderCancelAfterAcceptPay,
        riderEarningHoldHours: settings.riderEarningHoldHours,
        deliveryOpsCost: settings.deliveryOpsCost,
        gatewayFeePercent: settings.gatewayFeeBps / 100,
        promoDeliveryDiscount: settings.promoDeliveryDiscount,
        promoMinOrder: settings.promoMinOrder,
        payoutWeekday: settings.payoutWeekday,
        basicCommissionPercent: settings.basicCommissionPercent,
        proCommissionPercent: settings.proCommissionPercent,
        proMonthlyFee: settings.proMonthlyFee,
        updatedAt: settings.updatedAt,
      },
    };

    return requireRole.json(result);
  } catch (error) {
    console.error("Could not load admin finance:", error);
    return requireRole.errorResponse(error);
  }
}