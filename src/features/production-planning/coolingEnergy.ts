// Placeholder chiller/cooling energy: physics-grounded and swap-ready.
// Thermal load removed from MC01 chilled water: Q[kW] = flow[L/s] * cp * dT[C].
export const COOLING_DEFAULTS = {
  flowLps: 1.5,
  deltaTC: 4,
  cop: 3.0,
  cpKjKgK: 4.18,
} as const;

export interface CoolingInputs {
  runHours: number;
  flowLps?: number;
  deltaTC?: number;
  cop?: number;
  cpKjKgK?: number;
}

export interface CoolingEstimate {
  thermalKw: number;
  coolingKw: number;
  coolingKwh: number;
}

export function estimateCoolingEnergy(i: CoolingInputs): CoolingEstimate {
  const flow = i.flowLps ?? COOLING_DEFAULTS.flowLps;
  const dT = i.deltaTC ?? COOLING_DEFAULTS.deltaTC;
  const cop = i.cop ?? COOLING_DEFAULTS.cop;
  const cp = i.cpKjKgK ?? COOLING_DEFAULTS.cpKjKgK;
  const runHours = Math.max(0, i.runHours);
  const thermalKw = flow * cp * dT;
  const coolingKw = cop > 0 ? thermalKw / cop : 0;

  return {
    thermalKw,
    coolingKw,
    coolingKwh: coolingKw * runHours,
  };
}
