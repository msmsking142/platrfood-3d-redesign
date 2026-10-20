import { db } from "../helpers/db";
import { deliveryPricing } from "../helpers/deliveryPricing";
import { riderOnboardingFee } from "../helpers/riderOnboardingFee";
import { OutputType } from "./settings_GET.schema";
import { requireRole } from "../helpers/requireRole";

export async function handle(request: Request) {
  try {
    const s = await db
      .selectFrom("appSettings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    const onboardingFee = await riderOnboardingFee.computeFee();
    return requireRole.json({
      deliveryFee: s.deliveryFee,
      platformFee: s.platformFee,
      deliveryMinFee: s.deliveryMinFee,
      deliveryMaxFee: s.deliveryMaxFee,
      deliverySlabs: deliveryPricing.parseSlabs(s.deliverySlabs),
      riderBasePay: s.riderBasePay,
      riderPerKm: s.riderPerKm,
      riderBaseKm: s.riderBaseM / 1000,
      riderIncentive: s.riderBonus,
      riderOnboardingFee: onboardingFee.baseRupees,
      riderOnboardingFeeTotalPaise: onboardingFee.amountPaise,
      riderOnboardingFeeGstPercent: onboardingFee.gstPercent,
      smallOrderFee: s.smallOrderFee,
      smallOrderThreshold: s.smallOrderThreshold,
      surgeEnabled: s.surgeEnabled,
      riderBonus: s.riderBonus,
      basicCommissionPercent: s.basicCommissionPercent,
      proCommissionPercent: s.proCommissionPercent,
      proTrialEnabled: s.proTrialEnabled,
      proTrialDays: s.proTrialDays,
      proMonthlyFee: s.proMonthlyFee,
      proMonthlyGst: Math.round(s.proMonthlyFee * s.commissionGstBps / 10000),
      proMonthlyTotal: s.proMonthlyFee + Math.round(s.proMonthlyFee * s.commissionGstBps / 10000),
      proGstPercent: s.commissionGstBps / 100,
      upiId: s.upiId,
      upiPayeeName: s.upiPayeeName,
      ziptoGstin: s.ziptoGstin,
      launchMode: s.launchMode,
      sitePaused: s.sitePaused,
      allowCustomerRegistration: s.allowCustomerRegistration,
      allowRiderRegistration: s.allowRiderRegistration,
      allowMerchantRegistration: s.allowMerchantRegistration,
    } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}