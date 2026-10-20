import type { Selectable } from "kysely";
import type { AppSettings } from "./schema";

export type RiderSearchSettings = {
  radiusM: number;
  expandedRadiusM: number;
  expandAfterMin: number;
  readyWindowMin: number;
  maxMin: number;
  incentiveEnabled: boolean;
  incentiveAmount: number;
  incentiveCap: number;
  compEnabled: boolean;
  compBps: number;
  compMin: number;
  compMax: number;
  prepGraceMin: number;
};

export type RiderSearchSettingsRow = Pick<
  Selectable<AppSettings>,
  | "riderSearchRadiusM"
  | "riderSearchExpandedRadiusM"
  | "riderSearchExpandAfterMin"
  | "riderSearchReadyWindowMin"
  | "riderSearchMaxMin"
  | "riderSearchIncentiveEnabled"
  | "riderSearchIncentiveAmount"
  | "riderSearchIncentiveCap"
  | "deliveryFailureCompEnabled"
  | "deliveryFailureCompBps"
  | "deliveryFailureCompMin"
  | "deliveryFailureCompMax"
  | "deliveryFailurePrepGraceMin"
>;

export type SearchState = {
  status: string;
  riderId: number | null;
  restaurantAcceptedAt: Date | null;
  readyAt: Date | null;
  stage: "initial" | "expanded" | "priority" | null;
  radiusM: number | null;
  deadlineAt: Date | null;
  incentive: number;
  atRiskAt: Date | null;
};

export type RiderSearchEvent = {
  type:
    | "search_started"
    | "search_expanded"
    | "incentive_offered"
    | "delivery_at_risk"
    | "priority_search_started"
    | "deadline_set";
  key: string;
  detail: Record<string, unknown>;
};

export type Decision = {
  active: boolean;
  patch: Partial<
    Pick<
      SearchState,
      "stage" | "radiusM" | "deadlineAt" | "incentive" | "atRiskAt"
    >
  >;
  events: RiderSearchEvent[];
  notifyAtRisk: boolean;
  cancel: boolean;
  nextCheckAt: Date | null;
};

export type CompensationInput = {
  readyAt: Date | null;
  restaurantAcceptedAt: Date | null;
  avgPrepMinutes: number;
  itemsTotal: number;
};

export type CompensationDecision = {
  eligible: boolean;
  amount: number;
  reason: string;
  calculation: {
    onTimeBy: string | null;
    readyAt: string | null;
    prepAllowedMin: number;
    bps: number;
    rawAmount: number;
    min: number;
    max: number;
  };
};

function fromSettingsRow(row: RiderSearchSettingsRow): RiderSearchSettings {
  return {
    radiusM: row.riderSearchRadiusM,
    expandedRadiusM: row.riderSearchExpandedRadiusM,
    expandAfterMin: row.riderSearchExpandAfterMin,
    readyWindowMin: row.riderSearchReadyWindowMin,
    maxMin: row.riderSearchMaxMin,
    incentiveEnabled: row.riderSearchIncentiveEnabled,
    incentiveAmount: row.riderSearchIncentiveAmount,
    incentiveCap: row.riderSearchIncentiveCap,
    compEnabled: row.deliveryFailureCompEnabled,
    compBps: row.deliveryFailureCompBps,
    compMin: row.deliveryFailureCompMin,
    compMax: row.deliveryFailureCompMax,
    prepGraceMin: row.deliveryFailurePrepGraceMin,
  };
}

function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function computeDeadline(
  state: SearchState,
  settings: RiderSearchSettings,
): Date | null {
  if (state.restaurantAcceptedAt === null) return null;
  return state.readyAt !== null
    ? minutesAfter(state.readyAt, settings.readyWindowMin)
    : minutesAfter(state.restaurantAcceptedAt, settings.maxMin);
}

function decide(
  state: SearchState,
  settings: RiderSearchSettings,
  now: Date,
): Decision {
  const patch: Decision["patch"] = {};
  const events: RiderSearchEvent[] = [];

  if (
    state.riderId !== null ||
    !["accepted", "preparing", "ready"].includes(state.status) ||
    state.restaurantAcceptedAt === null
  ) {
    return {
      active: false,
      patch,
      events,
      notifyAtRisk: false,
      cancel: false,
      nextCheckAt: null,
    };
  }

  let stage = state.stage;
  let radiusM = state.radiusM;
  let incentive = state.incentive;
  let atRiskAt = state.atRiskAt;
  let notifyAtRisk = false;

  const setRadius = (newRadiusM: number) => {
    if (radiusM !== newRadiusM) {
      radiusM = newRadiusM;
      patch.radiusM = newRadiusM;
    }
  };

  const markAtRisk = () => {
    if (atRiskAt !== null) return;
    atRiskAt = new Date(now.getTime());
    patch.atRiskAt = atRiskAt;
    notifyAtRisk = true;
    events.push({
      type: "delivery_at_risk",
      key: "at_risk",
      detail: { atRiskAt: atRiskAt.toISOString() },
    });
  };

  const offerIncentive = (total: number) => {
    if (!settings.incentiveEnabled || total <= incentive) return;
    const added = total - incentive;
    incentive = total;
    patch.incentive = total;
    events.push({
      type: "incentive_offered",
      key: `incentive:${total}`,
      detail: { amount: added, total },
    });
  };

  if (stage === null) {
    stage = "initial";
    patch.stage = stage;
    setRadius(settings.radiusM);
    events.push({
      type: "search_started",
      key: "search_started",
      detail: { radiusM: settings.radiusM },
    });
  }

  const expandAt = minutesAfter(
    state.restaurantAcceptedAt,
    settings.expandAfterMin,
  );

  if (
    (stage === "initial" || stage === null) &&
    now.getTime() >= expandAt.getTime()
  ) {
    stage = "expanded";
    patch.stage = stage;
    setRadius(Math.max(radiusM ?? settings.radiusM, settings.expandedRadiusM));
    events.push({
      type: "search_expanded",
      key: "expanded",
      detail: { radiusM },
    });
    markAtRisk();
    offerIncentive(
      Math.min(
        settings.incentiveCap,
        incentive + Math.max(0, settings.incentiveAmount),
      ),
    );
  }

  if (state.readyAt !== null && stage !== "priority") {
    stage = "priority";
    patch.stage = stage;
    setRadius(Math.max(radiusM ?? settings.radiusM, settings.expandedRadiusM));
    events.push({
      type: "priority_search_started",
      key: "priority",
      detail: { radiusM },
    });
    markAtRisk();
    offerIncentive(settings.incentiveCap);
  }

  const deadline = computeDeadline(state, settings);
  if (
    deadline !== null &&
    state.deadlineAt?.getTime() !== deadline.getTime()
  ) {
    patch.deadlineAt = deadline;
    events.push({
      type: "deadline_set",
      key: `deadline:${deadline.toISOString()}`,
      detail: { deadlineAt: deadline.toISOString() },
    });
  }

  const cancel = deadline !== null && now.getTime() >= deadline.getTime();
  let nextCheckAt: Date | null = null;

  if (!cancel && deadline !== null) {
    nextCheckAt = deadline;
    if (
      stage === "initial" &&
      expandAt.getTime() > now.getTime() &&
      expandAt.getTime() < deadline.getTime()
    ) {
      nextCheckAt = expandAt;
    }
  }

  return {
    active: true,
    patch,
    events,
    notifyAtRisk,
    cancel,
    nextCheckAt,
  };
}

function compensation(
  input: CompensationInput,
  settings: RiderSearchSettings,
): CompensationDecision {
  const prepAllowedMin = input.avgPrepMinutes + settings.prepGraceMin;
  const onTimeBy =
    input.restaurantAcceptedAt === null
      ? null
      : minutesAfter(input.restaurantAcceptedAt, prepAllowedMin);
  const rawAmount = Math.round(
    (input.itemsTotal * settings.compBps) / 10_000,
  );
  const calculation: CompensationDecision["calculation"] = {
    onTimeBy: onTimeBy?.toISOString() ?? null,
    readyAt: input.readyAt?.toISOString() ?? null,
    prepAllowedMin,
    bps: settings.compBps,
    rawAmount,
    min: settings.compMin,
    max: settings.compMax,
  };

  const ineligible = (reason: string): CompensationDecision => ({
    eligible: false,
    amount: 0,
    reason,
    calculation,
  });

  if (!settings.compEnabled) {
    return ineligible("Compensation is turned off for delivery failures");
  }
  if (input.readyAt === null) {
    return ineligible("Order was not marked ready before the delivery deadline");
  }
  if (onTimeBy === null) {
    return ineligible("Restaurant acceptance time is unavailable");
  }
  if (input.readyAt.getTime() > onTimeBy.getTime()) {
    return ineligible(
      `Order was marked ready after the agreed preparation time (${prepAllowedMin} min)`,
    );
  }

  // Apply the configured bounds, then cap at the food value. Flooring the
  // ceilings keeps the award in whole rupees even for fractional item totals.
  const ceiling = Math.min(
    Math.max(0, Math.floor(input.itemsTotal)),
    Math.max(0, Math.floor(settings.compMax)),
  );
  const amount = Math.min(
    ceiling,
    Math.max(Math.max(0, Math.ceil(settings.compMin)), rawAmount),
  );

  return {
    eligible: true,
    amount,
    reason: "Food prepared on time but no platr™ rider was available",
    calculation,
  };
}

function withinRadius(
  riderLat: number | null,
  riderLng: number | null,
  restaurantLat: number | null,
  restaurantLng: number | null,
  radiusM: number | null,
): boolean {
  if (
    riderLat === null ||
    riderLng === null ||
    restaurantLat === null ||
    restaurantLng === null ||
    radiusM === null
  ) {
    return true;
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(restaurantLat - riderLat);
  const longitudeDelta = radians(restaurantLng - riderLng);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(riderLat)) *
      Math.cos(radians(restaurantLat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  const distanceM =
    2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, arc)));

  return distanceM <= radiusM;
}

export const riderSearchDecision = {
  fromSettingsRow,
  computeDeadline,
  decide,
  compensation,
  withinRadius,
};