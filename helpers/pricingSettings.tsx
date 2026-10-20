import type { Selectable } from "kysely";
import { db } from "./db";
import { deliveryPricing, type PricingSettings } from "./deliveryPricing";
import type { AppSettings, ServiceAreas } from "./schema";

type LoadedPricingSettings = {
  row: Selectable<AppSettings>;
  settings: PricingSettings;
  area: Selectable<ServiceAreas> | null;
  areaActive: boolean;
};

export const pricingSettings = {
  fromRow(row: Selectable<AppSettings>): PricingSettings {
    return {
      platformFee: row.platformFee,
      deliverySlabs: deliveryPricing.parseSlabs(row.deliverySlabs),
      deliveryPerKmBeyond: row.deliveryPerKmBeyond,
      deliveryMinFee: row.deliveryMinFee,
      deliveryMaxFee: row.deliveryMaxFee,
      maxDeliveryM: row.maxDeliveryM,
      defaultDistanceM: row.defaultDistanceM,
      roadFactorPct: row.roadFactorPct,
      peakFee: row.peakFee,
      peakStartHour: row.peakStartHour,
      peakEndHour: row.peakEndHour,
      surgeEnabled: row.surgeEnabled,
      surgeFee: row.surgeFee,
      surgeReason: row.surgeReason,
      smallOrderFee: row.smallOrderFee,
      smallOrderThreshold: row.smallOrderThreshold,
      deliveryGstBps: row.deliveryGstBps,
      foodGstBps: row.foodGstBps,
      commissionGstBps: row.commissionGstBps,
      restaurantWithholdingBps: row.restaurantWithholdingBps,
      restaurantNoPanWithholdingBps: row.restaurantNoPanWithholdingBps,
      riderBasePay: row.riderBasePay,
      riderBaseM: row.riderBaseM,
      riderPerKm: row.riderPerKm,
      riderBonus: row.riderBonus,
      riderPeakIncentive: row.riderPeakIncentive,
      riderCancelAfterAcceptPay: row.riderCancelAfterAcceptPay,
      deliveryOpsCost: row.deliveryOpsCost,
      gatewayFeeBps: row.gatewayFeeBps,
      promoDeliveryDiscount: row.promoDeliveryDiscount,
      promoMinOrder: row.promoMinOrder,
      basicCommissionPercent: row.basicCommissionPercent,
      proCommissionPercent: row.proCommissionPercent,
    };
  },

  async load(
    town?: string | null,
    executor: typeof db = db,
  ): Promise<LoadedPricingSettings> {
    try {
      const row = await executor
        .selectFrom("appSettings")
        .selectAll()
        .where("id", "=", 1)
        .executeTakeFirst();

      if (!row) {
        throw new Error("platr™ pricing settings (id 1) are missing");
      }

      const normalizedTown = town?.trim();
      const area = normalizedTown
        ? (await executor
            .selectFrom("serviceAreas")
            .selectAll()
            .where(
              (expression) =>
                expression(
                  expression.fn<string>("lower", ["town"]),
                  "=",
                  normalizedTown.toLowerCase(),
                ),
            )
            .orderBy("id", "asc")
            .executeTakeFirst()) ?? null
        : null;

      const parsedAreaSlabs =
        area?.deliverySlabs == null
          ? []
          : deliveryPricing.parseSlabs(area.deliverySlabs);

      const settings = deliveryPricing.applyServiceArea(
        pricingSettings.fromRow(row),
        area
          ? {
              deliverySlabs:
                parsedAreaSlabs.length > 0 ? parsedAreaSlabs : null,
              deliveryPerKmBeyond: area.deliveryPerKmBeyond,
              deliveryMinFee: area.deliveryMinFee,
              deliveryMaxFee: area.deliveryMaxFee,
              maxDeliveryM: area.maxDeliveryM,
              riderBasePay: area.riderBasePay,
              riderPerKm: area.riderPerKm,
            }
          : null,
      );

      return {
        row,
        settings,
        area,
        areaActive: area?.isActive ?? true,
      };
    } catch (error) {
      console.error("Could not load platr™ pricing settings:", error);
      throw error;
    }
  },
};