import { z } from "zod";
import superjson from "superjson";
import type { DeliverySlab } from "../helpers/deliveryPricing";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;
export type OutputType = {
  deliveryFee: number;
  platformFee: number;
  deliveryMinFee: number;
  deliveryMaxFee: number;
  deliverySlabs: DeliverySlab[];
  riderBasePay: number;
  riderPerKm: number;
  riderBaseKm: number;
  riderIncentive: number;
  riderOnboardingFee: number;
  riderOnboardingFeeTotalPaise: number;
  riderOnboardingFeeGstPercent: number;
  smallOrderFee: number;
  smallOrderThreshold: number;
  surgeEnabled: boolean;
  riderBonus: number;
  basicCommissionPercent: number;
  proCommissionPercent: number;
  proTrialEnabled: boolean;
  proTrialDays: number;
  proMonthlyFee: number;
  proMonthlyGst: number;
  proMonthlyTotal: number;
  proGstPercent: number;
  upiId: string | null;
  upiPayeeName: string;
  ziptoGstin: string | null;
  launchMode: boolean;
  sitePaused: boolean;
  allowCustomerRegistration: boolean;
  allowRiderRegistration: boolean;
  allowMerchantRegistration: boolean;
};

export const getSettings = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/settings`, { method: "GET", ...init });
  if (!result.ok) {
    const e = superjson.parse<{ error: string }>(await result.text());
    throw new Error(e.error);
  }
  return superjson.parse<OutputType>(await result.text());
};