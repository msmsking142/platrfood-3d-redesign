import {
  riderSearchDecision,
  type RiderSearchSettings,
  type SearchState,
} from "./riderSearchDecision";

describe("riderSearchDecision", () => {
  const acceptedAt = new Date("2026-10-01T10:00:00.000Z");

  const settings: RiderSearchSettings = {
    radiusM: 2_000,
    expandedRadiusM: 5_000,
    expandAfterMin: 5,
    readyWindowMin: 7,
    maxMin: 20,
    incentiveEnabled: true,
    incentiveAmount: 30,
    incentiveCap: 50,
    compEnabled: true,
    compBps: 1_000,
    compMin: 20,
    compMax: 100,
    prepGraceMin: 5,
  };

  const state = (overrides: Partial<SearchState> = {}): SearchState => ({
    status: "accepted",
    riderId: null,
    restaurantAcceptedAt: acceptedAt,
    readyAt: null,
    stage: null,
    radiusM: null,
    deadlineAt: null,
    incentive: 0,
    atRiskAt: null,
    ...overrides,
  });

  const atMinute = (minute: number): Date =>
    new Date(acceptedAt.getTime() + minute * 60_000);

  it("maps every required app setting", () => {
    expect(
      riderSearchDecision.fromSettingsRow({
        riderSearchRadiusM: 2_000,
        riderSearchExpandedRadiusM: 5_000,
        riderSearchExpandAfterMin: 5,
        riderSearchReadyWindowMin: 7,
        riderSearchMaxMin: 20,
        riderSearchIncentiveEnabled: true,
        riderSearchIncentiveAmount: 30,
        riderSearchIncentiveCap: 50,
        deliveryFailureCompEnabled: true,
        deliveryFailureCompBps: 1_000,
        deliveryFailureCompMin: 20,
        deliveryFailureCompMax: 100,
        deliveryFailurePrepGraceMin: 5,
      }),
    ).toEqual(settings);
  });

  it("starts an initial search and schedules expansion", () => {
    const decision = riderSearchDecision.decide(state(), settings, atMinute(0));

    expect(decision.active).toBe(true);
    expect(decision.patch).toEqual({
      stage: "initial",
      radiusM: 2_000,
      deadlineAt: atMinute(20),
    });
    expect(decision.events.map((event) => event.type)).toEqual([
      "search_started",
      "deadline_set",
    ]);
    expect(decision.events.map((event) => event.key)).toEqual([
      "search_started",
      `deadline:${atMinute(20).toISOString()}`,
    ]);
    expect(decision.notifyAtRisk).toBe(false);
    expect(decision.cancel).toBe(false);
    expect(decision.nextCheckAt).toEqual(atMinute(5));
  });

  it("expands at five minutes, marks risk and caps the added incentive", () => {
    const decision = riderSearchDecision.decide(
      state({
        stage: "initial",
        radiusM: 2_000,
        deadlineAt: atMinute(20),
        incentive: 40,
      }),
      settings,
      atMinute(5),
    );

    expect(decision.patch).toEqual({
      stage: "expanded",
      radiusM: 5_000,
      atRiskAt: atMinute(5),
      incentive: 50,
    });
    expect(decision.events.map((event) => event.type)).toEqual([
      "search_expanded",
      "delivery_at_risk",
      "incentive_offered",
    ]);
    expect(decision.events[2]).toEqual({
      type: "incentive_offered",
      key: "incentive:50",
      detail: { amount: 10, total: 50 },
    });
    expect(decision.notifyAtRisk).toBe(true);
    expect(decision.nextCheckAt).toEqual(atMinute(20));
  });

  it("does not offer an incentive when incentives are disabled", () => {
    const decision = riderSearchDecision.decide(
      state({ stage: "initial", radiusM: 2_000 }),
      { ...settings, incentiveEnabled: false },
      atMinute(5),
    );

    expect(decision.patch.incentive).toBeUndefined();
    expect(
      decision.events.some((event) => event.type === "incentive_offered"),
    ).toBe(false);
  });

  it("makes READY priority, preserves expansion event order and grants the full ready window", () => {
    const readyAt = atMinute(21);
    const decision = riderSearchDecision.decide(
      state({
        status: "ready",
        stage: "initial",
        radiusM: 2_000,
        deadlineAt: atMinute(20),
        readyAt,
      }),
      settings,
      atMinute(22),
    );

    expect(decision.patch).toEqual({
      stage: "priority",
      radiusM: 5_000,
      atRiskAt: atMinute(22),
      incentive: 50,
      deadlineAt: atMinute(28),
    });
    expect(decision.events.map((event) => event.type)).toEqual([
      "search_expanded",
      "delivery_at_risk",
      "incentive_offered",
      "priority_search_started",
      "incentive_offered",
      "deadline_set",
    ]);
    expect(decision.events.map((event) => event.key)).toEqual([
      "expanded",
      "at_risk",
      "incentive:30",
      "priority",
      "incentive:50",
      `deadline:${atMinute(28).toISOString()}`,
    ]);
    expect(decision.notifyAtRisk).toBe(true);
    expect(decision.cancel).toBe(false);
    expect(decision.nextCheckAt).toEqual(atMinute(28));
    expect(riderSearchDecision.computeDeadline(state({ readyAt }), settings))
      .toEqual(atMinute(28));
  });

  it("starts priority immediately on READY, even before the expansion time", () => {
    const decision = riderSearchDecision.decide(
      state({
        status: "ready",
        stage: "initial",
        radiusM: 2_000,
        readyAt: atMinute(2),
      }),
      settings,
      atMinute(2),
    );

    expect(decision.patch.stage).toBe("priority");
    expect(decision.patch.incentive).toBe(50);
    expect(decision.patch.deadlineAt).toEqual(atMinute(9));
    expect(decision.events.map((event) => event.type)).toEqual([
      "priority_search_started",
      "delivery_at_risk",
      "incentive_offered",
      "deadline_set",
    ]);
    expect(decision.nextCheckAt).toEqual(atMinute(9));
  });

  it("cancels at the ready-window deadline if no rider has accepted", () => {
    const decision = riderSearchDecision.decide(
      state({
        status: "ready",
        stage: "priority",
        radiusM: 5_000,
        readyAt: atMinute(6),
        deadlineAt: atMinute(13),
        atRiskAt: atMinute(6),
        incentive: 50,
      }),
      settings,
      atMinute(13),
    );

    expect(decision.active).toBe(true);
    expect(decision.cancel).toBe(true);
    expect(decision.nextCheckAt).toBeNull();
    expect(decision.patch).toEqual({});
    expect(decision.events).toEqual([]);
    expect(decision.notifyAtRisk).toBe(false);
  });

  it("cancels a never-ready order at acceptance plus maxMin", () => {
    const decision = riderSearchDecision.decide(
      state({
        status: "preparing",
        stage: "expanded",
        radiusM: 5_000,
        deadlineAt: atMinute(20),
        atRiskAt: atMinute(5),
      }),
      settings,
      atMinute(20),
    );

    expect(riderSearchDecision.computeDeadline(state(), settings))
      .toEqual(atMinute(20));
    expect(decision.cancel).toBe(true);
    expect(decision.nextCheckAt).toBeNull();
  });

  it("does nothing after a delayed rider acceptance, even past the deadline", () => {
    const decision = riderSearchDecision.decide(
      state({
        riderId: 42,
        stage: "expanded",
        deadlineAt: atMinute(20),
        atRiskAt: atMinute(5),
      }),
      settings,
      atMinute(21),
    );

    expect(decision).toEqual({
      active: false,
      patch: {},
      events: [],
      notifyAtRisk: false,
      cancel: false,
      nextCheckAt: null,
    });
  });

  it("does nothing for delivered orders or orders without acceptance time", () => {
    for (const inactiveState of [
      state({ status: "delivered" }),
      state({ restaurantAcceptedAt: null }),
    ]) {
      const decision = riderSearchDecision.decide(
        inactiveState,
        settings,
        atMinute(30),
      );
      expect(decision.active).toBe(false);
      expect(decision.patch).toEqual({});
      expect(decision.events).toEqual([]);
      expect(decision.cancel).toBe(false);
      expect(decision.nextCheckAt).toBeNull();
    }
    expect(
      riderSearchDecision.computeDeadline(
        state({ restaurantAcceptedAt: null }),
        settings,
      ),
    ).toBeNull();
  });

  it("produces no repeated changes or events after applying a decision", () => {
    const initial = state({ status: "ready", readyAt: atMinute(8) });
    const first = riderSearchDecision.decide(initial, settings, atMinute(9));
    const second = riderSearchDecision.decide(
      { ...initial, ...first.patch },
      settings,
      atMinute(9),
    );

    expect(first.events.length).toBeGreaterThan(0);
    expect(second.patch).toEqual({});
    expect(second.events).toEqual([]);
    expect(second.notifyAtRisk).toBe(false);
    expect(second.cancel).toBe(false);
  });

  describe("compensation", () => {
    const input = {
      restaurantAcceptedAt: acceptedAt,
      readyAt: atMinute(35),
      avgPrepMinutes: 30,
      itemsTotal: 500,
    };

    it("awards an on-time restaurant a whole-rupee food-only amount", () => {
      expect(riderSearchDecision.compensation(input, settings)).toEqual({
        eligible: true,
        amount: 50,
        reason: "Food prepared on time but no platr™ rider was available",
        calculation: {
          onTimeBy: atMinute(35).toISOString(),
          readyAt: atMinute(35).toISOString(),
          prepAllowedMin: 35,
          bps: 1_000,
          rawAmount: 50,
          min: 20,
          max: 100,
        },
      });
    });

    it("rejects food marked ready after the agreed preparation time", () => {
      const result = riderSearchDecision.compensation(
        { ...input, readyAt: atMinute(36) },
        settings,
      );
      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toBe(
        "Order was marked ready after the agreed preparation time (35 min)",
      );
    });

    it("rejects an order that was never marked ready", () => {
      const result = riderSearchDecision.compensation(
        { ...input, readyAt: null },
        settings,
      );
      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toBe(
        "Order was not marked ready before the delivery deadline",
      );
      expect(result.calculation.readyAt).toBeNull();
    });

    it("respects the compensation switch", () => {
      const result = riderSearchDecision.compensation(
        input,
        { ...settings, compEnabled: false },
      );
      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
      expect(result.reason).toBe(
        "Compensation is turned off for delivery failures",
      );
    });

    it("does not award compensation without restaurant acceptance time", () => {
      const result = riderSearchDecision.compensation(
        { ...input, restaurantAcceptedAt: null },
        settings,
      );
      expect(result.eligible).toBe(false);
      expect(result.calculation.onTimeBy).toBeNull();
    });

    it("clamps awards to the minimum, maximum and item total", () => {
      expect(
        riderSearchDecision.compensation(
          { ...input, itemsTotal: 50 },
          settings,
        ).amount,
      ).toBe(20);
      expect(
        riderSearchDecision.compensation(
          { ...input, itemsTotal: 2_000 },
          settings,
        ).amount,
      ).toBe(100);
      expect(
        riderSearchDecision.compensation(
          { ...input, itemsTotal: 9.75 },
          settings,
        ).amount,
      ).toBe(9);
      expect(
        riderSearchDecision.compensation(
          { ...input, itemsTotal: -10 },
          settings,
        ).amount,
      ).toBe(0);
    });
  });

  it("uses haversine distance, including the inclusive boundary and unknown-location allowance", () => {
    expect(riderSearchDecision.withinRadius(0, 0, 0, 0, 0)).toBe(true);
    expect(riderSearchDecision.withinRadius(0, 0, 0, 0.01, 1_200))
      .toBe(true);
    expect(riderSearchDecision.withinRadius(0, 0, 0, 0.01, 1_100))
      .toBe(false);
    expect(riderSearchDecision.withinRadius(null, 0, 0, 0.01, 1))
      .toBe(true);
    expect(riderSearchDecision.withinRadius(0, 0, 0, 0.01, null))
      .toBe(true);
  });
});