import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./requireRole";
import { adminPricingActionSchemas } from "./adminPricingActionSchemas";

export const adminPricingActions = {
  async updateSettings(
    input: z.infer<typeof adminPricingActionSchemas.pricingSettings>,
  ): Promise<void> {
    if (input.deliveryMaxFee < input.deliveryMinFee)
      throw new HttpError(400, "Maximum delivery fee must be at least the minimum");
    if (input.surgeEnabled && input.surgeFee > 0 && !input.surgeReason?.trim())
      throw new HttpError(400, "A surge reason is required when a surge fee is enabled");
    if ((input.peakStartHour === null) !== (input.peakEndHour === null))
      throw new HttpError(400, "Peak start and end hours must both be set or both be empty");

    const ziptoGstin = input.ziptoGstin?.trim().toUpperCase() || null;
    if (
      ziptoGstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(ziptoGstin)
    )
      throw new HttpError(400, "Invalid GSTIN");

    const result = await db
      .updateTable("appSettings")
      .set({
        platformFee: input.platformFee,
        deliverySlabs: input.deliverySlabs,
        deliveryPerKmBeyond: input.deliveryPerKmBeyond,
        deliveryMinFee: input.deliveryMinFee,
        deliveryMaxFee: input.deliveryMaxFee,
        maxDeliveryM: Math.round(input.maxDeliveryKm * 1000),
        defaultDistanceM: Math.round(input.defaultDistanceKm * 1000),
        roadFactorPct: input.roadFactorPct,
        peakFee: input.peakFee,
        peakStartHour: input.peakStartHour,
        peakEndHour: input.peakEndHour,
        surgeEnabled: input.surgeEnabled,
        surgeFee: input.surgeFee,
        surgeReason: input.surgeReason,
        smallOrderFee: input.smallOrderFee,
        smallOrderThreshold: input.smallOrderThreshold,
        deliveryGstBps: Math.round(input.deliveryGstPercent * 100),
        foodGstBps: Math.round(input.foodGstPercent * 100),
        commissionGstBps: Math.round(input.commissionGstPercent * 100),
        restaurantWithholdingBps: Math.round(
          input.restaurantWithholdingPercent * 100,
        ),
        restaurantNoPanWithholdingBps: Math.round(
          input.restaurantNoPanWithholdingPercent * 100,
        ),
        ziptoGstin,
        riderBasePay: input.riderBasePay,
        riderBaseM: Math.round(input.riderBaseKm * 1000),
        riderPerKm: input.riderPerKm,
        riderBonus: input.riderIncentive,
        riderPeakIncentive: input.riderPeakIncentive,
        riderCancelAfterAcceptPay: input.riderCancelAfterAcceptPay,
        riderEarningHoldHours: input.riderEarningHoldHours,
        deliveryOpsCost: input.deliveryOpsCost,
        gatewayFeeBps: Math.round(input.gatewayFeePercent * 100),
        promoDeliveryDiscount: input.promoDeliveryDiscount,
        promoMinOrder: input.promoMinOrder,
        payoutWeekday: input.payoutWeekday,
        updatedAt: new Date(),
      })
      .where("id", "=", 1)
      .returning("id")
      .executeTakeFirst();

    if (!result) throw new HttpError(404, "App settings were not found");
  },

  async upsertServiceArea(
    input: z.infer<typeof adminPricingActionSchemas.serviceAreaUpsert>,
  ): Promise<void> {
    if (
      input.deliveryMinFee !== null &&
      input.deliveryMaxFee !== null &&
      input.deliveryMaxFee < input.deliveryMinFee
    )
      throw new HttpError(400, "Maximum delivery fee must be at least the minimum");

    const { action, maxDeliveryKm, ...values } = input;
    const area = {
      ...values,
      maxDeliveryM:
        maxDeliveryKm === null ? null : Math.round(maxDeliveryKm * 1000),
      updatedAt: new Date(),
    };

    await db
      .insertInto("serviceAreas")
      .values(area)
      .onConflict((conflict) =>
        conflict.column("town").doUpdateSet(area),
      )
      .execute();
  },

  async deleteServiceArea(id: number): Promise<void> {
    const deleted = await db
      .deleteFrom("serviceAreas")
      .where("id", "=", id)
      .returning("id")
      .executeTakeFirst();

    if (!deleted) throw new HttpError(404, "Service area was not found");
  },
};