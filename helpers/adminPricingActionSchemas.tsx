import { z } from "zod";

const deliverySlab = z.object({
  maxKm: z.number().positive().max(50),
  fee: z.number().int().min(0).max(500),
});

const deliverySlabs = z
  .array(deliverySlab)
  .min(1)
  .max(10)
  .refine(
    (slabs) =>
      slabs.every(
        (slab, index) =>
          index === 0 || slab.maxKm > slabs[index - 1].maxKm,
      ),
    "Delivery slab distances must be strictly increasing",
  );

const pricingSettings = z.object({
    action: z.literal("pricing_settings"),
    platformFee: z.number().int().min(0).max(100),
    deliverySlabs,
    deliveryPerKmBeyond: z.number().int().min(0).max(100),
    deliveryMinFee: z.number().int().min(0).max(500),
    deliveryMaxFee: z.number().int().min(0).max(1000),
    maxDeliveryKm: z.number().min(1).max(50),
    defaultDistanceKm: z.number().min(0.5).max(20),
    roadFactorPct: z.number().int().min(100).max(200),
    peakFee: z.number().int().min(0).max(100),
    peakStartHour: z.number().int().min(0).max(24).nullable(),
    peakEndHour: z.number().int().min(0).max(24).nullable(),
    surgeEnabled: z.boolean(),
    surgeFee: z.number().int().min(0).max(100),
    surgeReason: z.string().trim().max(120).nullable(),
    smallOrderFee: z.number().int().min(0).max(100),
    smallOrderThreshold: z.number().int().min(0).max(2000),
    deliveryGstPercent: z.number().min(0).max(28),
    foodGstPercent: z.number().min(0).max(28),
    commissionGstPercent: z.number().min(0).max(28),
    restaurantWithholdingPercent: z.number().min(0).max(28),
    restaurantNoPanWithholdingPercent: z.number().min(0).max(28),
    ziptoGstin: z.string().trim().max(15).nullable(),
    riderBasePay: z.number().int().min(0).max(500),
    riderBaseKm: z.number().min(0).max(20),
    riderPerKm: z.number().int().min(0).max(100),
    riderIncentive: z.number().int().min(0).max(200),
    riderPeakIncentive: z.number().int().min(0).max(200),
    riderCancelAfterAcceptPay: z.number().int().min(0).max(500),
    riderEarningHoldHours: z.number().int().min(0).max(168),
    deliveryOpsCost: z.number().int().min(0).max(200),
    gatewayFeePercent: z.number().min(0).max(10),
    promoDeliveryDiscount: z.number().int().min(0).max(200),
    promoMinOrder: z.number().int().min(0).max(5000),
    payoutWeekday: z.number().int().min(0).max(6),
  });

const serviceAreaUpsert = z.object({
    action: z.literal("service_area_upsert"),
    town: z.string().trim().min(2).max(60),
    isActive: z.boolean(),
    deliverySlabs: deliverySlabs.nullable(),
    deliveryPerKmBeyond: z.number().int().min(0).max(100).nullable(),
    deliveryMinFee: z.number().int().min(0).max(500).nullable(),
    deliveryMaxFee: z.number().int().min(0).max(1000).nullable(),
    riderBasePay: z.number().int().min(0).max(500).nullable(),
    riderPerKm: z.number().int().min(0).max(100).nullable(),
    maxDeliveryKm: z.number().min(1).max(50).nullable(),
    note: z.string().trim().max(200).nullable(),
  });

export const adminPricingActionSchemas = {
  pricingSettings,
  serviceAreaUpsert,
};