// In-browser production planner — recomputes plans live as the operator changes
// inputs. Mirrors the Python engine's economics (EPQ + energy + holding + greedy
// machine balancing) so the dashboard is a real what-if tool, not a static report.
// CP-SAT stays server-side for exact runs; this is the fast interactive model.

export type Strategy = 'mto' | 'balanced' | 'mts';
export const STRATEGIES: Strategy[] = ['mto', 'balanced', 'mts'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  mto: 'Make to order', balanced: 'Balanced', mts: 'Make to stock',
};

const MIN_BATCH = 25;
const MTO_DAYS_STOCK = 7;            // make-to-order: ~a week of stock
const MTS_DAYS_STOCK = 60;           // make-to-stock: ~two months of stock

export interface SkuParam {
  id: string; name: string;
  demand: number; rateEffective: number; kgPerUnit: number; meanRejection: number;
}
export interface LineParam {
  machineKw: number; changeoverH: number; changeoverKw: number;
  nMachines: number; machineNames: string[] | null;
}
export interface Econ { elecOmrPerKwh: number; materialOmrPerKg: number; holdingRateAnnual: number; }

export interface SkuPlan {
  id: string; name: string; runs: number; batch: number;
  productionH: number; changeoverH: number; inventoryUnits: number; scrapKg: number; machine: number;
}
export interface Lane { machine: number; name: string; products: { id: string; hours: number }[]; loadH: number; }
export interface StrategyResult {
  strategy: Strategy;
  perSku: SkuPlan[];
  lanes: Lane[];
  makespanH: number; makespanDays: number;
  totalMachineH: number;            // total run-time across all machines
  capacityPerMachineH: number;      // days × hours/day available per machine
  daysNeeded: number;               // calendar days to finish at the chosen shift length
  fits: boolean;                    // does the busiest machine finish within the time available?
  utilization: number;              // busiest machine load / capacity
  changeovers: number;
  inventoryUnits: number; daysOfStock: number;
  scrapKg: number; energyKwh: number;
  energyOmr: number; holdingOmr: number; scrapOmr: number; totalOmr: number;
}

const round = (v: number, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

function epqRuns(demand: number, rate: number, unitValue: number, setupOmr: number,
                 holdingRate: number, days: number, hoursPerDay: number): number {
  const H = unitValue * holdingRate * (days / 365);
  if (H <= 0 || setupOmr <= 0) return 1;
  const d = demand / (days * hoursPerDay);
  const ratio = Math.min(d / rate, 0.95);
  const batch = Math.sqrt((2 * demand * setupOmr) / (H * Math.max(1 - ratio, 0.05)));
  return Math.max(1, Math.round(demand / Math.max(batch, MIN_BATCH)));
}

function runsFor(strategy: Strategy, sku: SkuParam, demand: number, days: number,
                 line: LineParam, econ: Econ, hoursPerDay: number): number {
  const unitValue = sku.kgPerUnit * econ.materialOmrPerKg;
  const dailyDemand = demand / days;
  const byStock = (targetDays: number) =>
    Math.max(1, Math.ceil(demand / Math.max(2 * targetDays * dailyDemand, MIN_BATCH)));
  if (strategy === 'mts') return byStock(MTS_DAYS_STOCK);
  if (strategy === 'mto') return byStock(MTO_DAYS_STOCK);
  const setupOmr = line.changeoverH * line.changeoverKw * econ.elecOmrPerKwh;
  return epqRuns(demand, sku.rateEffective, unitValue, setupOmr, econ.holdingRateAnnual, days, hoursPerDay);
}

export function planStrategy(
  strategy: Strategy, skus: SkuParam[], demands: Record<string, number>,
  days: number, machines: number, line: LineParam, econ: Econ, hoursPerDay = 24,
): StrategyResult {
  const perSku: SkuPlan[] = skus.map((s) => {
    const demand = Math.max(0, demands[s.id] ?? s.demand);
    const runs = runsFor(strategy, s, demand, days, line, econ, hoursPerDay);
    const batch = demand / runs;
    const productionH = demand / Math.max(s.rateEffective, 1e-9);
    const changeoverH = runs * line.changeoverH;
    return { id: s.id, name: s.name, runs, batch, productionH, changeoverH,
             inventoryUnits: batch / 2, scrapKg: demand * s.kgPerUnit * s.meanRejection, machine: 0 };
  });

  // greedy balance: assign each product's total hours to the least-loaded machine
  const m = Math.max(1, machines);
  const lanes: Lane[] = Array.from({ length: m }, (_, i) => ({
    machine: i, name: line.machineNames?.[i] ?? `Machine ${i + 1}`, products: [], loadH: 0,
  }));
  [...perSku].sort((a, b) => (b.productionH + b.changeoverH) - (a.productionH + a.changeoverH))
    .forEach((sp) => {
      const lane = lanes.reduce((lo, l) => (l.loadH < lo.loadH ? l : lo), lanes[0]);
      const hours = sp.productionH + sp.changeoverH;
      lane.products.push({ id: sp.id, hours });
      lane.loadH += hours;
      sp.machine = lane.machine;
    });

  const sum = (f: (p: SkuPlan) => number) => perSku.reduce((a, p) => a + f(p), 0);
  const energyKwh = sum((p) => p.productionH) * line.machineKw + sum((p) => p.changeoverH) * line.changeoverKw;
  const inventoryUnits = sum((p) => p.inventoryUnits);
  const scrapKg = sum((p) => p.scrapKg);
  const energyOmr = energyKwh * econ.elecOmrPerKwh;
  const holdingOmr = perSku.reduce((a, p) => {
    const s = skus.find((x) => x.id === p.id)!;
    return a + p.inventoryUnits * s.kgPerUnit * econ.materialOmrPerKg * econ.holdingRateAnnual * (days / 365);
  }, 0);
  const scrapOmr = scrapKg * econ.materialOmrPerKg;
  const makespanH = Math.max(...lanes.map((l) => l.loadH));
  const totalMachineH = lanes.reduce((a, l) => a + l.loadH, 0);
  const capacityPerMachineH = days * hoursPerDay;
  const totalDemand = sum((p) => Math.max(0, demands[p.id] ?? 0)) || 1;

  return {
    strategy, perSku, lanes,
    makespanH: round(makespanH), makespanDays: round(makespanH / hoursPerDay, 1),
    totalMachineH: round(totalMachineH),
    capacityPerMachineH: round(capacityPerMachineH),
    daysNeeded: round(makespanH / hoursPerDay, 1),
    fits: makespanH <= capacityPerMachineH,
    utilization: round(capacityPerMachineH ? makespanH / capacityPerMachineH : 0, 3),
    changeovers: sum((p) => p.runs),
    inventoryUnits: round(inventoryUnits), daysOfStock: round(inventoryUnits / (totalDemand / days), 1),
    scrapKg: round(scrapKg), energyKwh: round(energyKwh),
    energyOmr: round(energyOmr), holdingOmr: round(holdingOmr), scrapOmr: round(scrapOmr),
    totalOmr: round(energyOmr + holdingOmr + scrapOmr),
  };
}

export function planAll(skus: SkuParam[], demands: Record<string, number>, days: number,
                        machines: number, line: LineParam, econ: Econ, hoursPerDay = 24): Record<Strategy, StrategyResult> {
  return {
    mto: planStrategy('mto', skus, demands, days, machines, line, econ, hoursPerDay),
    balanced: planStrategy('balanced', skus, demands, days, machines, line, econ, hoursPerDay),
    mts: planStrategy('mts', skus, demands, days, machines, line, econ, hoursPerDay),
  };
}

// ── A synthetic full-catalog plant, so the planner can be seen representing a
// whole operation (many products contending for shared machines), not just the
// 2-product pilot. Illustrative / DEVELOPMENT_PROXY — not the client's real data.
export const DEMO_LINE: LineParam = {
  machineKw: 75, changeoverH: 2, changeoverKw: 75, nMachines: 3,
  machineNames: ['Machine 01', 'Machine 02', 'Machine 03'],
};
export const DEMO_ECON: Econ = { elecOmrPerKwh: 0.025, materialOmrPerKg: 0.32, holdingRateAnnual: 0.20 };
export const DEMO_SKUS: SkuParam[] = [
  { id: 'DR-110', name: 'Drainage 110 mm', demand: 28000, rateEffective: 22, kgPerUnit: 6.4, meanRejection: 0.020 },
  { id: 'DR-160', name: 'Drainage 160 mm', demand: 18000, rateEffective: 15, kgPerUnit: 11.2, meanRejection: 0.022 },
  { id: 'DR-200', name: 'Drainage 200 mm', demand: 9000, rateEffective: 10, kgPerUnit: 16.8, meanRejection: 0.028 },
  { id: 'PR-110', name: 'Pressure 110 mm', demand: 24000, rateEffective: 20, kgPerUnit: 9.1, meanRejection: 0.024 },
  { id: 'PR-160', name: 'Pressure 160 mm', demand: 14000, rateEffective: 14, kgPerUnit: 14.0, meanRejection: 0.026 },
  { id: 'PR-75', name: 'Pressure 75 mm', demand: 30000, rateEffective: 26, kgPerUnit: 5.2, meanRejection: 0.019 },
  { id: 'CO-20', name: 'Conduit 20 mm', demand: 60000, rateEffective: 40, kgPerUnit: 1.3, meanRejection: 0.015 },
  { id: 'CO-25', name: 'Conduit 25 mm', demand: 48000, rateEffective: 36, kgPerUnit: 1.7, meanRejection: 0.016 },
  { id: 'CO-32', name: 'Conduit 32 mm', demand: 36000, rateEffective: 30, kgPerUnit: 2.4, meanRejection: 0.017 },
  { id: 'WP-50', name: 'Waste 50 mm', demand: 26000, rateEffective: 28, kgPerUnit: 3.1, meanRejection: 0.018 },
  { id: 'WP-110', name: 'Waste 110 mm', demand: 16000, rateEffective: 18, kgPerUnit: 7.3, meanRejection: 0.021 },
  { id: 'DR-75', name: 'Drainage 75 mm', demand: 34000, rateEffective: 27, kgPerUnit: 4.0, meanRejection: 0.018 },
];
