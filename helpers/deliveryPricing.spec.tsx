import { deliveryPricing, type PricingSettings } from "./deliveryPricing";

const baseSettings: PricingSettings = {
  platformFee: 0,
  deliverySlabs: [
    { maxKm: 2, fee: 20 },
    { maxKm: 4, fee: 30 },
    { maxKm: 6, fee: 40 },
  ],
  deliveryPerKmBeyond: 8,
  deliveryMinFee: 20,
  deliveryMaxFee: 80,
  maxDeliveryM: 10_000,
  defaultDistanceM: 3_000,
  roadFactorPct: 130,
  peakFee: 0,
  peakStartHour: null,
  peakEndHour: null,
  surgeEnabled: false,
  surgeFee: 0,
  surgeReason: null,
  smallOrderFee: 0,
  smallOrderThreshold: 0,
  deliveryGstBps: 0,
  foodGstBps: 0,
  commissionGstBps: 0,
  restaurantWithholdingBps: 0,
  restaurantNoPanWithholdingBps: 500,
  riderBasePay: 20,
  riderBaseM: 2_000,
  riderPerKm: 6,
  riderBonus: 5,
  riderPeakIncentive: 0,
  riderCancelAfterAcceptPay: 10,
  deliveryOpsCost: 0,
  gatewayFeeBps: 236,
  promoDeliveryDiscount: 0,
  promoMinOrder: 0,
  basicCommissionPercent: 12,
  proCommissionPercent: 4,
};

function makeQuote(
  overrides: Partial<Parameters<typeof deliveryPricing.quote>[0]> = {},
) {
  return deliveryPricing.quote({
    itemsTotal: 400,
    plan: "basic",
    distanceM: 3_500,
    distanceSource: "gps",
    paymentMethod: "upi",
    at: new Date("2025-01-01T12:00:00.000Z"),
    settings: baseSettings,
    ...overrides,
  });
}

describe("deliveryPricing", () => {
  it("sorts valid slabs and rejects invalid slab data", () => {
    expect(
      deliveryPricing.parseSlabs([
        { maxKm: 4, fee: 30 },
        { maxKm: 2, fee: 20 },
      ]),
    ).toEqual([
      { maxKm: 2, fee: 20 },
      { maxKm: 4, fee: 30 },
    ]);
    expect(deliveryPricing.parseSlabs([{ maxKm: 2, fee: 2.5 }])).toEqual([]);
    expect(deliveryPricing.parseSlabs([{ maxKm: 0, fee: 20 }])).toEqual([]);
    expect(deliveryPricing.parseSlabs(null)).toEqual([]);
  });

  it("uses non-null service-area overrides without changing global settings", () => {
    const result = deliveryPricing.applyServiceArea(baseSettings, {
      deliveryMinFee: null,
      riderPerKm: 8,
      deliverySlabs: [],
    });

    expect(result.deliveryMinFee).toBe(20);
    expect(result.riderPerKm).toBe(8);
    expect(result.deliverySlabs).toEqual([]);
    expect(baseSettings.riderPerKm).toBe(6);
  });

  it("prices slabs and keeps capped delivery components nonnegative and balanced", () => {
    expect(makeQuote({ distanceM: 1_500 }).deliveryFee).toBe(20);
    expect(makeQuote({ distanceM: 3_500 }).deliveryFee).toBe(30);

    const beyond = makeQuote({ distanceM: 8_200 });
    expect(beyond.deliveryBaseFee).toBe(40);
    expect(beyond.deliveryDistanceFee).toBe(24);
    expect(beyond.deliveryFee).toBe(64);

    const capped = makeQuote({ distanceM: 15_000 });
    expect(capped.deliveryFee).toBe(80);
    expect(capped.deliveryBaseFee).toBe(40);
    expect(capped.deliveryDistanceFee).toBe(40);
    expect(capped.deliveryBaseFee + capped.deliveryDistanceFee + capped.peakFee)
      .toBe(capped.deliveryFee);
    expect(capped.outOfRange).toBeTrue();
  });

  it("shows a zero platform fee while keeping commission out of the customer bill", () => {
    const basic = makeQuote();
    const pro = makeQuote({ plan: "pro" });

    expect(basic.total).toBe(430);
    expect(
      basic.lineItems.find((item) => item.key === "platformFee")?.amount,
    ).toBe(0);
    expect(basic.lineItems.at(-1)).toEqual({
      key: "total",
      label: "Total",
      amount: 430,
    });
    expect(basic.restaurantSettlement.commissionAmount).toBe(48);
    expect(basic.restaurantSettlement.net).toBe(352);
    expect(pro.restaurantSettlement.commissionAmount).toBe(16);
    expect(pro.restaurantSettlement.net).toBe(384);
    expect(
      basic.lineItems.some((item) => item.label.toLowerCase().includes("commission")),
    ).toBeFalse();
  });

  it("pays riders independently of the customer fee and identifies a delivery shortfall", () => {
    expect(makeQuote().rider).toEqual({
      basePay: 20,
      distancePay: 12,
      incentive: 5,
      total: 37,
    });

    const shortfall = makeQuote({ distanceM: 1_500 });
    expect(shortfall.rider.total).toBe(25);
    expect(shortfall.deliveryFee).toBe(20);
    expect(shortfall.economics.ziptoDeliverySubsidy).toBe(5);
    expect(shortfall.economics.minimumDeliveryFeeToCover).toBe(25);
    expect(shortfall.economics.economicsFlag).toBe("delivery_shortfall");
  });

  it("prioritizes negative contribution over a delivery shortfall", () => {
    const result = makeQuote({
      itemsTotal: 50,
      distanceM: 1_500,
      paymentMethod: "upi",
    });

    expect(result.restaurantSettlement.commissionAmount).toBe(6);
    expect(result.economics.gatewayFeeEstimate).toBe(2);
    expect(result.economics.contribution).toBe(-1);
    expect(result.economics.economicsFlag).toBe("negative_contribution");
  });

  it("handles a midnight-crossing Kolkata peak window and displays surge", () => {
    const settings: PricingSettings = {
      ...baseSettings,
      peakStartHour: 22,
      peakEndHour: 2,
      peakFee: 7,
      riderPeakIncentive: 4,
      surgeEnabled: true,
      surgeFee: 9,
      surgeReason: "High demand",
    };

    expect(
      deliveryPricing.isPeak(new Date("2025-01-01T17:30:00.000Z"), settings),
    ).toBeTrue(); // 23:00 IST
    expect(
      deliveryPricing.isPeak(new Date("2025-01-01T20:29:00.000Z"), settings),
    ).toBeTrue(); // 01:59 IST
    expect(
      deliveryPricing.isPeak(new Date("2025-01-01T20:30:00.000Z"), settings),
    ).toBeFalse(); // 02:00 IST, exclusive end

    const result = makeQuote({
      settings,
      at: new Date("2025-01-01T17:30:00.000Z"),
    });
    expect(result.deliveryFee).toBe(37);
    expect(result.surgeFee).toBe(9);
    expect(result.rider.total).toBe(41);
    expect(
      result.lineItems.find((item) => item.key === "deliveryFee")?.note,
    ).toContain("incl. ₹7 peak-time");
    expect(
      result.lineItems.find((item) => item.key === "surgeFee")?.note,
    ).toBe("High demand");
  });

  it("accounts for discounts, taxes, withholding, and operating costs", () => {
    const result = makeQuote({
      restaurantDiscount: 50,
      paymentMethod: "upi",
      settings: {
        ...baseSettings,
        platformFee: 2,
        smallOrderThreshold: 360,
        smallOrderFee: 5,
        promoMinOrder: 300,
        promoDeliveryDiscount: 10,
        foodGstBps: 500,
        deliveryGstBps: 500,
        commissionGstBps: 1800,
        restaurantWithholdingBps: 100,
        deliveryOpsCost: 3,
      },
    });

    expect(result.foodTax).toBe(18);
    expect(result.deliveryTax).toBe(1);
    expect(result.ziptoDiscount).toBe(10);
    expect(result.total).toBe(396);
    expect(result.restaurantSettlement.withholding).toBe(0);
    expect(result.restaurantSettlement.net).toBe(300);
    expect(result.economics.deliveryRevenue).toBe(25);
    expect(result.economics.minimumDeliveryFeeToCover).toBe(45);
    expect(result.economics.contribution).toBe(20);
  });

  it("deducts TDS from payout food sales at the applicable PAN rate", () => {
    const settings = {
      ...baseSettings,
      restaurantWithholdingBps: 10,
    };

    expect(deliveryPricing.payoutTds({
      foodSales: 4_000,
      hasValidPan: true,
      settings,
    })).toBe(4);
    expect(deliveryPricing.payoutTds({
      foodSales: 4_000,
      hasValidPan: false,
      settings,
    })).toBe(200);
    expect(deliveryPricing.payoutTds({
      foodSales: -100,
      hasValidPan: false,
      settings,
    })).toBe(0);
  });

  it("validates PAN after trimming and uppercasing", () => {
    expect(deliveryPricing.isValidPan("  abcde1234f ")).toBeTrue();
    expect(deliveryPricing.isValidPan("ABCDE123F")).toBeFalse();
    expect(deliveryPricing.isValidPan(null)).toBeFalse();
  });

  it("prices production slabs and keeps Basic and Pro contributions positive", () => {
    const settings: PricingSettings = {
      ...baseSettings,
      deliverySlabs: [
        { maxKm: 2, fee: 25 },
        { maxKm: 3, fee: 31 },
        { maxKm: 4, fee: 37 },
        { maxKm: 5, fee: 43 },
        { maxKm: 6, fee: 49 },
      ],
      deliveryPerKmBeyond: 7,
      deliveryMinFee: 25,
      deliveryMaxFee: 80,
    };

    expect(makeQuote({ distanceM: 1_500, settings }).deliveryFee).toBe(25);
    expect(makeQuote({ distanceM: 3_500, settings }).deliveryFee).toBe(37);
    expect(makeQuote({ distanceM: 8_000, settings }).deliveryFee).toBe(63);
    for (const plan of ["basic", "pro"] as const) {
      expect(makeQuote({ distanceM: 3_500, settings, plan }).economics.contribution)
        .toBeGreaterThan(0);
    }
  });

  it("pays the full rider amount after pickup and capped compensation before pickup", () => {
    const input = {
      riderAssigned: true,
      riderTotal: 37,
      settings: baseSettings,
    };

    expect(
      deliveryPricing.riderCancellationPay({
        ...input,
        riderAssigned: false,
        statusAtCancel: "picked_up",
      }),
    ).toBe(0);
    expect(
      deliveryPricing.riderCancellationPay({
        ...input,
        statusAtCancel: "picked_up",
      }),
    ).toBe(37);
    expect(
      deliveryPricing.riderCancellationPay({
        ...input,
        statusAtCancel: "preparing",
      }),
    ).toBe(10);
    expect(
      deliveryPricing.riderCancellationPay({
        ...input,
        riderTotal: 6,
        statusAtCancel: "ready",
      }),
    ).toBe(6);
  });

  it("estimates distance without complete coordinates and accepts zero coordinates", () => {
    expect(
      deliveryPricing.resolveDistance(
        {
          restaurantLat: 29,
          restaurantLng: 79,
          customerLat: null,
          customerLng: 79,
        },
        baseSettings,
      ),
    ).toEqual({ distanceM: 3_000, source: "estimated" });

    expect(
      deliveryPricing.resolveDistance(
        {
          restaurantLat: 0,
          restaurantLng: 0,
          customerLat: 0,
          customerLng: 0,
        },
        baseSettings,
      ),
    ).toEqual({ distanceM: 0, source: "gps" });
    expect(deliveryPricing.formatKm(2_400)).toBe("2.4 km");
  });
});

describe("production pricing audit (2026 launch settings)", () => {
  const prodSettings: PricingSettings = {
    ...baseSettings,
    platformFee: 0,
    deliverySlabs: [
      { maxKm: 2, fee: 25 },
      { maxKm: 3, fee: 31 },
      { maxKm: 4, fee: 37 },
      { maxKm: 5, fee: 43 },
      { maxKm: 6, fee: 49 },
    ],
    deliveryPerKmBeyond: 6,
    deliveryMinFee: 25,
    deliveryMaxFee: 80,
    maxDeliveryM: 10_000,
    deliveryGstBps: 1800,
    foodGstBps: 500,
    commissionGstBps: 1800,
    restaurantWithholdingBps: 10,
    restaurantNoPanWithholdingBps: 500,
    riderBasePay: 20,
    riderBaseM: 2_000,
    riderPerKm: 6,
    riderBonus: 5,
    riderPeakIncentive: 0,
    riderCancelAfterAcceptPay: 10,
    gatewayFeeBps: 236,
    basicCommissionPercent: 15,
    proCommissionPercent: 8,
  };

  const examples = [
    {
      itemsTotal: 400, distanceM: 3_500, foodTax: 20,
      deliveryFee: 37, deliveryTax: 7, total: 464, riderTotal: 37,
      basic: { commissionAmount: 60, commissionTax: 11, net: 329 },
      pro: { commissionAmount: 32, commissionTax: 6, net: 362 },
    },
    {
      itemsTotal: 150, distanceM: 2_000, foodTax: 8,
      deliveryFee: 25, deliveryTax: 5, total: 188, riderTotal: 25,
      basic: { commissionAmount: 23, commissionTax: 4, net: 123 },
      pro: { commissionAmount: 12, commissionTax: 2, net: 136 },
    },
    {
      itemsTotal: 300, distanceM: 8_000, foodTax: 15,
      deliveryFee: 61, deliveryTax: 11, total: 387, riderTotal: 61,
      basic: { commissionAmount: 45, commissionTax: 8, net: 247 },
      pro: { commissionAmount: 24, commissionTax: 4, net: 272 },
    },
  ] as const;

  it("matches worked customer, rider and restaurant amounts for both plans", () => {
    for (const example of examples) {
      for (const plan of ["basic", "pro"] as const) {
        const result = makeQuote({
          itemsTotal: example.itemsTotal,
          distanceM: example.distanceM,
          paymentMethod: "upi",
          plan,
          settings: prodSettings,
        });

        expect(result.foodTax).toBe(example.foodTax);
        expect(result.deliveryFee).toBe(example.deliveryFee);
        expect(result.deliveryTax).toBe(example.deliveryTax);
        expect(result.total).toBe(example.total);
        expect(result.rider.total).toBe(example.riderTotal);
        expect(result.restaurantSettlement.commissionAmount).toBe(example[plan].commissionAmount);
        expect(result.restaurantSettlement.commissionTax).toBe(example[plan].commissionTax);
        expect(result.restaurantSettlement.net).toBe(example[plan].net);
      }
    }

    expect(makeQuote({ settings: prodSettings }).economics.contribution).toBe(49);
    expect(makeQuote({ settings: prodSettings, plan: "pro" }).economics.contribution).toBe(21);
  });

  it("has no hidden platform fee or customer-facing commission", () => {
    for (const example of examples) {
      const result = makeQuote({
        itemsTotal: example.itemsTotal,
        distanceM: example.distanceM,
        settings: prodSettings,
      });

      expect(result.lineItems.find((line) => line.key === "platformFee")?.amount).toBe(0);
      expect(result.total).toBe(
        result.lineItems
          .filter((line) => line.key !== "total")
          .reduce((sum, line) => sum + line.amount, 0),
      );
      expect(result.lineItems.some((line) => line.label.toLowerCase().includes("commission"))).toBeFalse();
    }
  });

  it("matches rider pay throughout the delivery radius and at slab boundaries", () => {
    const distances = new Set([
      ...Array.from({ length: 41 }, (_, index) => index * 250),
      6_000, 6_001, 7_000, 7_001, 9_001, 10_000,
    ]);

    for (const distanceM of distances) {
      const result = makeQuote({ distanceM, settings: prodSettings });
      expect(result.deliveryFee).toBe(result.rider.total);
      expect(result.outOfRange).toBeFalse();
    }

    for (const [distanceM, fee] of [
      [6_001, 55], [7_001, 61], [10_000, 73],
    ] as const) {
      expect(makeQuote({ distanceM, settings: prodSettings }).deliveryFee).toBe(fee);
    }

    expect(makeQuote({ distanceM: 10_001, settings: prodSettings }).outOfRange).toBeTrue();
  });

  it("reconciles settlements while keeping taxes separate from retained revenue", () => {
    for (const example of examples) {
      for (const plan of ["basic", "pro"] as const) {
        const result = makeQuote({
          itemsTotal: example.itemsTotal,
          distanceM: example.distanceM,
          plan,
          settings: prodSettings,
        });
        const { net, commissionAmount, commissionTax } = result.restaurantSettlement;

        expect(result.total).toBe(
          net + commissionAmount + commissionTax +
          result.foodTax + result.deliveryFee + result.deliveryTax,
        );
        expect(
          (result.total - net - result.rider.total) -
          (result.foodTax + result.deliveryTax + commissionTax),
        ).toBe(commissionAmount + result.deliveryFee - result.rider.total);
      }
    }
  });

  it("pays riders correctly when an order is cancelled", () => {
    for (const statusAtCancel of ["accepted", "preparing", "ready"] as const) {
      expect(deliveryPricing.riderCancellationPay({
        statusAtCancel, riderAssigned: true, riderTotal: 61, settings: prodSettings,
      })).toBe(10);
    }
    expect(deliveryPricing.riderCancellationPay({
      statusAtCancel: "picked_up", riderAssigned: false,
      riderTotal: 61, settings: prodSettings,
    })).toBe(0);
    expect(deliveryPricing.riderCancellationPay({
      statusAtCancel: "picked_up", riderAssigned: true,
      riderTotal: 61, settings: prodSettings,
    })).toBe(61);
    expect(deliveryPricing.riderCancellationPay({
      statusAtCancel: "ready", riderAssigned: true,
      riderTotal: 6, settings: prodSettings,
    })).toBe(6);
  });

  it("calculates PAN-dependent TDS on the payout batch, not each order", () => {
    expect(deliveryPricing.payoutTds({
      foodSales: 850, hasValidPan: true, settings: prodSettings,
    })).toBe(1);
    expect(deliveryPricing.payoutTds({
      foodSales: 850, hasValidPan: false, settings: prodSettings,
    })).toBe(43);
    expect(deliveryPricing.payoutTds({
      foodSales: 400, hasValidPan: true, settings: prodSettings,
    })).toBe(0);
  });
});