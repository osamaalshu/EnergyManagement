# Codex Brief — chiller/cooling energy block (swap-ready placeholder)

**Repo:** `energy-mgmt-redesign` · **Branch:** `feat/cooling-energy-placeholder`. Adds the cooling/chiller term that telemetry's kWh/kg currently omits — as an **explicit ESTIMATED placeholder** (no meter yet), built on the real physics so it swaps to measured when the chilled-water sensors land. Architect spec; Codex implements + tests.

## Why
Today telemetry `kwh_per_unit` is **machine-direct only** (we even caption it so). This adds the **attributed cooling** term: `Q = flow·cp·ΔT` (thermal) → `/COP` (electrical), so the manager sees a **total** kWh/kg. Parameters are the exact quantities the line-side supply/return + flow sensors will measure → swap-ready.

## 1. New pure module — `src/features/production-planning/coolingEnergy.ts`
```ts
// Placeholder chiller/cooling energy — physics-grounded, swap-ready.
// Thermal load removed from MC01's chilled water:  Q[kW] = flow[L/s] · cp · ΔT[°C]   (water: flow L/s ≈ kg/s)
// Chiller electrical share:                        kW_elec = Q / COP                 (air-cooled COP falls with ambient)
export const COOLING_DEFAULTS = {
  flowLps: 1.5,   // chilled-water flow to MC01 — PLACEHOLDER (sensor will measure)
  deltaTC: 4,     // return − supply ΔT (°C)    — PLACEHOLDER
  cop: 3.0,       // air-cooled chiller COP (~2.5–3.5, drops in summer) — PLACEHOLDER (calibrate w/ temp chiller meter)
  cpKjKgK: 4.18,  // water specific heat
} as const;

export interface CoolingInputs { runHours: number; flowLps?: number; deltaTC?: number; cop?: number; cpKjKgK?: number; }
export interface CoolingEstimate { thermalKw: number; coolingKw: number; coolingKwh: number; }

export function estimateCoolingEnergy(i: CoolingInputs): CoolingEstimate {
  const flow = i.flowLps ?? COOLING_DEFAULTS.flowLps;
  const dT   = i.deltaTC ?? COOLING_DEFAULTS.deltaTC;
  const cop  = i.cop     ?? COOLING_DEFAULTS.cop;
  const cp   = i.cpKjKgK ?? COOLING_DEFAULTS.cpKjKgK;
  const thermalKw = flow * cp * dT;                 // kW thermal
  const coolingKw = cop > 0 ? thermalKw / cop : 0;  // kW electrical
  return { thermalKw: round(thermalKw,1), coolingKw: round(coolingKw,1), coolingKwh: round(coolingKw * Math.max(0,i.runHours)) };
}
```
(Use the repo's existing `round` helper or a local one.)

## 2. Wire into Plant Telemetry — `src/pages/PlantTelemetryPage/PlantTelemetryPage.tsx`
- `const runHours = pl.real.hours_by_state?.run ?? (pl.real.makespan_h * pl.real.utilization_run);`
- `const cooling = estimateCoolingEnergy({ runHours });`
- **Add a "Cooling — estimated (placeholder)" card** (amber ESTIMATED chip, visually distinct from the SIMULATED machine trace): show the formula `Q = flow·cp·ΔT → /COP`, the assumed params (`flow 1.5 L/s · ΔT 4°C · COP 3.0, air-cooled`), `thermalKw`, `coolingKw`, `coolingKwh`, and the **swap note**: *"becomes measured from MC01's chilled-water supply/return + flow when sensors land (COP calibrated with a temporary chiller-input meter)."*
- **Show the total alongside machine-direct:** `Energy / unit (machine) = ${r.kwh_per_unit}` **and** `Energy / unit (incl. cooling, est.) = ${round((r.energy_kwh + cooling.coolingKwh)/r.units, 3)}`. Also a total energy line `machine + cooling = ${num(r.energy_kwh)} + ${num(cooling.coolingKwh)} kWh`.
- **Update the existing caption** ("machine-direct power only — cooling/chiller not yet included") → now cooling IS included as an estimate: *"machine energy is simulated; cooling is an estimated placeholder (chiller physics) until metered."*

## Honesty contract (critical)
Three tiers must stay distinct: machine telemetry = **SIMULATED**, cooling = **ESTIMATED (placeholder)**, nothing here is measured. The cooling card carries an amber ESTIMATED chip; never style it as measured. Do not weaken `scripts/verify-provenance.mjs`.

## Tests Codex must write
1. `estimateCoolingEnergy`: with defaults + `runHours=100` → `thermalKw = 1.5*4.18*4`, `coolingKw = thermalKw/3.0`, `coolingKwh = coolingKw*100`. Overrides applied when passed. `cop=0` → `coolingKw=0` (no divide-by-zero).
2. Component: Telemetry renders the cooling card (formula + the three params + swap note), the "incl. cooling (est.)" total kWh/kg, and an ESTIMATED label; the total = machine + cooling.
3. Existing telemetry/suite tests still pass.

## Acceptance
- Pure `coolingEnergy.ts` + the Telemetry wiring; cooling is a clearly-labelled ESTIMATED placeholder, swap-ready (params = future sensor readings); total kWh/kg shown next to machine-direct.
- Full suite green; `npm run build` clean (provenance gate + tsc + Vite); no new deps; only `coolingEnergy.ts` + `PlantTelemetryPage.tsx` (+ tests).
- Do **not** commit or push — leave for review.
