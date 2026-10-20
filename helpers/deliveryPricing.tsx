import type { OrderStatus, PaymentMethod, RestaurantPlan } from "./schema";
import { distanceInMeters } from "./geoDistance";

export type DeliverySlab = { maxKm: number; fee: number };

export type PricingSettings = {
  platformFee: number;
  deliverySlabs: DeliverySlab[];
  deliveryPerKmBeyond: number;
  deliveryMinFee: number;
  deliveryMaxFee: number;
  maxDeliveryM: number;
  defaultDistanceM: number;
  roadFactorPct: number;
  peakFee: number;
  peakStartHour: number | null;
  peakEndHour: number | null;
  surgeEnabled: boolean;
  surgeFee: number;
  surgeReason: string | null;
  smallOrderFee: number;
  smallOrderThreshold: number;
  deliveryGstBps: number;
  foodGstBps: number;
  commissionGstBps: number;
  restaurantWithholdingBps: number;
  restaurantNoPanWithholdingBps: number;
  riderBasePay: number;
  riderBaseM: number;
  riderPerKm: number;
  riderBonus: number;
  riderPeakIncentive: number;
  riderCancelAfterAcceptPay: number;
  deliveryOpsCost: number;
  gatewayFeeBps: number;
  promoDeliveryDiscount: number;
  promoMinOrder: number;
  basicCommissionPercent: number;
  proCommissionPercent: number;
};

type OverridableSetting =
  | "deliverySlabs"
  | "deliveryPerKmBeyond"
  | "deliveryMinFee"
  | "deliveryMaxFee"
  | "maxDeliveryM"
  | "riderBasePay"
  | "riderPerKm";

export type ServiceAreaOverride = {
  [K in OverridableSetting]?: PricingSettings[K] | null;
};

export type DistanceSource = "gps" | "estimated";

export type DistanceCoordinates = {
  restaurantLat: number | null | undefined;
  restaurantLng: number | null | undefined;
  customerLat: number | null | undefined;
  customerLng: number | null | undefined;
};

export type DistanceResolution = {
  distanceM: number;
  source: DistanceSource;
};

export type PricingInput = {
  itemsTotal: number;
  plan: RestaurantPlan;
  distanceM: number;
  distanceSource: DistanceSource;
  paymentMethod: PaymentMethod;
  at: Date;
  settings: PricingSettings;
  restaurantDiscount?: number;
};

export type PricingLineItem = {
  key: string;
  label: string;
  amount: number;
  note?: string;
};

export type RestaurantSettlement = {
  foodSubtotal: number;
  restaurantDiscount: number;
  commissionPercent: number;
  commissionAmount: number;
  commissionTax: number;
  withholding: number;
  net: number;
};

export type RiderPay = {
  basePay: number;
  distancePay: number;
  incentive: number;
  total: number;
};

export type PricingEconomics = {
  deliveryRevenue: number;
  deliveryCost: number;
  ziptoDeliverySubsidy: number;
  minimumDeliveryFeeToCover: number;
  gatewayFeeEstimate: number;
  deliveryOpsCost: number;
  contribution: number;
  economicsFlag: "negative_contribution" | "delivery_shortfall" | null;
};

export type PricingQuote = {
  itemsTotal: number;
  restaurantDiscount: number;
  deliveryFee: number;
  deliveryBaseFee: number;
  deliveryDistanceFee: number;
  peakFee: number;
  surgeFee: number;
  smallOrderFee: number;
  platformFee: number;
  ziptoDiscount: number;
  foodTax: number;
  deliveryTax: number;
  total: number;
  distanceM: number;
  distanceSource: DistanceSource;
  outOfRange: boolean;
  lineItems: PricingLineItem[];
  restaurantSettlement: RestaurantSettlement;
  rider: RiderPay;
  economics: PricingEconomics;
};

export type RiderCancellationInput = {
  statusAtCancel: OrderStatus;
  riderAssigned: boolean;
  riderTotal: number;
  settings: PricingSettings;
};

function parseSlabs(json: unknown): DeliverySlab[] {
  if (!Array.isArray(json)) return [];

  const slabs: DeliverySlab[] = [];
  for (const entry of json) {
    if (entry === null || typeof entry !== "object") return [];

    const { maxKm, fee } = entry as Record<string, unknown>;
    if (
      typeof maxKm !== "number" ||
      !Number.isFinite(maxKm) ||
      maxKm <= 0 ||
      typeof fee !== "number" ||
      !Number.isInteger(fee) ||
      fee < 0
    ) {
      return [];
    }
    slabs.push({ maxKm, fee });
  }

  return slabs.sort((a, b) => a.maxKm - b.maxKm);
}

function applyServiceArea(
  settings: PricingSettings,
  override: ServiceAreaOverride | null | undefined,
): PricingSettings {
  return {
    ...settings,
    deliverySlabs: override?.deliverySlabs ?? settings.deliverySlabs,
    deliveryPerKmBeyond:
      override?.deliveryPerKmBeyond ?? settings.deliveryPerKmBeyond,
    deliveryMinFee: override?.deliveryMinFee ?? settings.deliveryMinFee,
    deliveryMaxFee: override?.deliveryMaxFee ?? settings.deliveryMaxFee,
    maxDeliveryM: override?.maxDeliveryM ?? settings.maxDeliveryM,
    riderBasePay: override?.riderBasePay ?? settings.riderBasePay,
    riderPerKm: override?.riderPerKm ?? settings.riderPerKm,
  };
}

function straightLineMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  return distanceInMeters(latA, lngA, latB, lngB);
}

function resolveDistance(
  coordinates: DistanceCoordinates,
  settings: PricingSettings,
): DistanceResolution {
  const { restaurantLat, restaurantLng, customerLat, customerLng } =
    coordinates;

  if (
    restaurantLat != null &&
    restaurantLng != null &&
    customerLat != null &&
    customerLng != null &&
    Number.isFinite(restaurantLat) &&
    Number.isFinite(restaurantLng) &&
    Number.isFinite(customerLat) &&
    Number.isFinite(customerLng)
  ) {
    return {
      distanceM: Math.round(
        (straightLineMeters(
          restaurantLat,
          restaurantLng,
          customerLat,
          customerLng,
        ) *
          settings.roadFactorPct) /
          100,
      ),
      source: "gps",
    };
  }

  return { distanceM: settings.defaultDistanceM, source: "estimated" };
}

function isPeak(date: Date, settings: PricingSettings): boolean {
  const { peakStartHour: start, peakEndHour: end } = settings;
  if (start === null || end === null || start === end) return false;

  // Asia/Kolkata is UTC+05:30 year-round.
  const hour = new Date(date.getTime() + 330 * 60_000).getUTCHours();
  return start < end
    ? hour >= start && hour < end
    : hour >= start || hour < end;
}

function formatKm(distanceM: number): string {
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(distanceM / 1000)} km`;
}

function quote(input: PricingInput): PricingQuote {
  const {
    itemsTotal,
    plan,
    distanceM,
    distanceSource,
    paymentMethod,
    at,
    settings,
  } = input;

  const restaurantDiscount = Math.min(
    itemsTotal,
    Math.max(0, input.restaurantDiscount ?? 0),
  );
  const foodAfterDiscount = itemsTotal - restaurantDiscount;
  const km = distanceM / 1000;
  const slabs = settings.deliverySlabs;
  const matchingSlab = slabs.find((slab) => km <= slab.maxKm);
  const lastSlab = slabs.at(-1);

  let deliveryBaseFee = matchingSlab?.fee ?? lastSlab?.fee ?? settings.deliveryMinFee;
  let deliveryDistanceFee = matchingSlab
    ? 0
    : Math.ceil(km - (lastSlab?.maxKm ?? 0)) *
      settings.deliveryPerKmBeyond;
  let peakFee = isPeak(at, settings) ? settings.peakFee : 0;

  const rawDeliveryFee =
    deliveryBaseFee + deliveryDistanceFee + peakFee;
  const deliveryFee = Math.min(
    settings.deliveryMaxFee,
    Math.max(settings.deliveryMinFee, rawDeliveryFee),
  );

  if (deliveryFee > rawDeliveryFee) {
    deliveryDistanceFee += deliveryFee - rawDeliveryFee;
  } else if (deliveryFee < rawDeliveryFee) {
    let reduction = rawDeliveryFee - deliveryFee;
    const distanceReduction = Math.min(deliveryDistanceFee, reduction);
    deliveryDistanceFee -= distanceReduction;
    reduction -= distanceReduction;

    const baseReduction = Math.min(deliveryBaseFee, reduction);
    deliveryBaseFee -= baseReduction;
    reduction -= baseReduction;

    peakFee -= reduction;
  }

  const surgeFee = settings.surgeEnabled ? settings.surgeFee : 0;
  const smallOrderFee =
    settings.smallOrderThreshold > 0 &&
    foodAfterDiscount < settings.smallOrderThreshold
      ? settings.smallOrderFee
      : 0;
  const platformFee = settings.platformFee;
  const ziptoDiscount =
    settings.promoDeliveryDiscount > 0 &&
    foodAfterDiscount >= settings.promoMinOrder
      ? Math.min(settings.promoDeliveryDiscount, deliveryFee + surgeFee)
      : 0;

  const foodTax = Math.round(
    (foodAfterDiscount * settings.foodGstBps) / 10_000,
  );
  const deliveryTax = Math.round(
    (Math.max(
      0,
      deliveryFee +
        surgeFee +
        smallOrderFee +
        platformFee -
        ziptoDiscount,
    ) *
      settings.deliveryGstBps) /
      10_000,
  );
  const total =
    foodAfterDiscount +
    foodTax +
    deliveryFee +
    surgeFee +
    smallOrderFee +
    platformFee -
    ziptoDiscount +
    deliveryTax;

  const commissionPercent =
    plan === "pro"
      ? settings.proCommissionPercent
      : settings.basicCommissionPercent;
  const commissionAmount = Math.round(
    (foodAfterDiscount * commissionPercent) / 100,
  );
  const commissionTax = Math.round(
    (commissionAmount * settings.commissionGstBps) / 10_000,
  );
  // Income-tax TDS is deducted from the weekly restaurant payout, not each order.
  const withholding = 0;
  const restaurantSettlement: RestaurantSettlement = {
    foodSubtotal: itemsTotal,
    restaurantDiscount,
    commissionPercent,
    commissionAmount,
    commissionTax,
    withholding,
    net: foodAfterDiscount - commissionAmount - commissionTax - withholding,
  };

  const basePay = settings.riderBasePay;
  const distancePay =
    Math.max(0, Math.ceil((distanceM - settings.riderBaseM) / 1000)) *
    settings.riderPerKm;
  const incentive =
    settings.riderBonus +
    (isPeak(at, settings) ? settings.riderPeakIncentive : 0);
  const rider: RiderPay = {
    basePay,
    distancePay,
    incentive,
    total: basePay + distancePay + incentive,
  };

  const deliveryRevenue =
    deliveryFee + surgeFee + smallOrderFee - ziptoDiscount;
  const deliveryOpsCost = settings.deliveryOpsCost;
  const deliveryCost = rider.total + deliveryOpsCost;
  const ziptoDeliverySubsidy = Math.max(
    0,
    deliveryCost - deliveryRevenue,
  );
  const gatewayFeeEstimate =
    paymentMethod === "upi"
      ? Math.round((total * settings.gatewayFeeBps) / 10_000)
      : 0;
  const contribution =
    commissionAmount +
    platformFee +
    deliveryRevenue -
    rider.total -
    deliveryOpsCost -
    gatewayFeeEstimate;
  const economics: PricingEconomics = {
    deliveryRevenue,
    deliveryCost,
    ziptoDeliverySubsidy,
    minimumDeliveryFeeToCover: Math.max(
      0,
      deliveryCost - surgeFee - smallOrderFee + ziptoDiscount,
    ),
    gatewayFeeEstimate,
    deliveryOpsCost,
    contribution,
    economicsFlag:
      contribution < 0
        ? "negative_contribution"
        : ziptoDeliverySubsidy > 0
          ? "delivery_shortfall"
          : null,
  };

  const distanceNote =
    distanceSource === "estimated"
      ? `~${formatKm(distanceM)} estimate`
      : `${formatKm(distanceM)} · distance-based`;
  const peakNote =
    peakFee > 0
      ? ` · incl. ₹${new Intl.NumberFormat("en-IN").format(peakFee)} peak-time`
      : "";

  const lineItems: PricingLineItem[] = [
    { key: "itemsTotal", label: "Item total", amount: itemsTotal },
    ...(restaurantDiscount > 0
      ? [{
          key: "restaurantDiscount",
          label: "Restaurant discount",
          amount: -restaurantDiscount,
        }]
      : []),
    {
      key: "deliveryFee",
      label: "Delivery fee",
      amount: deliveryFee,
      note: distanceNote + peakNote,
    },
    ...(surgeFee > 0
      ? [{
          key: "surgeFee",
          label: "Surge fee",
          amount: surgeFee,
          note: settings.surgeReason ?? undefined,
        }]
      : []),
    ...(smallOrderFee > 0
      ? [{
          key: "smallOrderFee",
          label: "Small-order fee",
          amount: smallOrderFee,
          note: `Orders below ₹${new Intl.NumberFormat("en-IN").format(settings.smallOrderThreshold)}`,
        }]
      : []),
    { key: "platformFee", label: "Platform fee", amount: platformFee },
    ...(ziptoDiscount > 0
      ? [{
          key: "ziptoDiscount",
          label: "platr™ delivery offer",
          amount: -ziptoDiscount,
        }]
      : []),
    ...(foodTax > 0
      ? [{
          key: "foodTax",
          label: `GST on food (${settings.foodGstBps / 100}%)`,
          amount: foodTax,
          note: "Collected & paid by platr™ u/s 9(5) CGST Act",
        }]
      : []),
    ...(deliveryTax > 0
      ? [{
          key: "deliveryTax",
          label: `GST on delivery & fees (${settings.deliveryGstBps / 100}%)`,
          amount: deliveryTax,
        }]
      : []),
    { key: "total", label: "Total", amount: total },
  ];

  return {
    itemsTotal,
    restaurantDiscount,
    deliveryFee,
    deliveryBaseFee,
    deliveryDistanceFee,
    peakFee,
    surgeFee,
    smallOrderFee,
    platformFee,
    ziptoDiscount,
    foodTax,
    deliveryTax,
    total,
    distanceM,
    distanceSource,
    outOfRange: distanceM > settings.maxDeliveryM,
    lineItems,
    restaurantSettlement,
    rider,
    economics,
  };
}

function isValidPan(pan: string | null | undefined): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan?.trim().toUpperCase() ?? "");
}

function payoutTds({
  foodSales,
  hasValidPan,
  settings,
}: {
  foodSales: number;
  hasValidPan: boolean;
  settings: PricingSettings;
}): number {
  return Math.max(
    0,
    Math.round(
      (foodSales *
        (hasValidPan
          ? settings.restaurantWithholdingBps
          : settings.restaurantNoPanWithholdingBps)) /
        10_000,
    ),
  );
}

function riderCancellationPay({
  statusAtCancel,
  riderAssigned,
  riderTotal,
  settings,
}: RiderCancellationInput): number {
  if (!riderAssigned) return 0;
  if (statusAtCancel === "picked_up") return riderTotal;
  return Math.min(settings.riderCancelAfterAcceptPay, riderTotal);
}

export const deliveryPricing = {
  parseSlabs,
  applyServiceArea,
  straightLineMeters,
  resolveDistance,
  isPeak,
  quote,
  payoutTds,
  isValidPan,
  riderCancellationPay,
  formatKm,
};