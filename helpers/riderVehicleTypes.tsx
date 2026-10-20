import type { InputType as RiderActionInput } from "../endpoints/rider/action_POST.schema";

type VehicleType = Extract<RiderActionInput, { action: "update_profile" }>["vehicleType"];

export const riderVehicleTypes = [
  "Ebike",
  "Normal bike",
] as const satisfies readonly VehicleType[];