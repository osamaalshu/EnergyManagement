// In-browser production planner — recomputes plans live as the operator changes
// inputs. Mirrors the Python engine's economics (EPQ + energy + holding + greedy
// machine balancing) so the dashboard is a real what-if tool, not a static report.
// CP-SAT stays server-side for exact runs; this is the fast interactive model.

export type Strategy = 'mto' | 'balanced' | 'mts';
export const STRATEGIES: Strategy[] = ['mto', 'balanced', 'mts'];
export const STRATEGY_LABEL: Record<Strategy, string> = {
  mto: 'Make to order', balanced: 'Balanced', mts: 'Make to stock',
};

const HOURS_PER_DAY = 24;            // extrusion runs continuously
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
  changeovers: number;
  inventoryUnits: number; daysOfStock: number;
  scrapKg: number; energyKwh: number;
  energyOmr: number; holdingOmr: number; scrapOmr: number; totalOmr: number;
}

const round = (v: number, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

function epqRuns(demand: number, rate: number, unitValue: number, setupOmr: number,
                 holdingRate: number, days: number): number {
  const H = unitValue * holdingRate * (days / 365);
  if (H <= 0 || setupOmr <= 0) return 1;
  const d = demand / (days * HOURS_PER_DAY);
  const ratio = Math.min(d / rate, 0.95);
  const batch = Math.sqrt((2 * demand * setupOmr) / (H * Math.max(1 - ratio, 0.05)));
  return Math.max(1, Math.round(demand / Math.max(batch, MIN_BATCH)));
}

function runsFor(strategy: Strategy, sku: SkuParam, demand: number, days: number,
                 line: LineParam, econ: Econ): number {
  const unitValue = sku.kgPerUnit * econ.materialOmrPerKg;
  const dailyDemand = demand / days;
  const byStock = (targetDays: number) =>
    Math.max(1, Math.ceil(demand / Math.max(2 * targetDays * dailyDemand, MIN_BATCH)));
  if (strategy === 'mts') return byStock(MTS_DAYS_STOCK);
  if (strategy === 'mto') return byStock(MTO_DAYS_STOCK);
  const setupOmr = line.changeoverH * line.changeoverKw * econ.elecOmrPerKwh;
  return epqRuns(demand, sku.rateEffective, unitValue, setupOmr, econ.holdingRateAnnual, days);
}

export function planStrategy(
  strategy: Strategy, skus: SkuParam[], demands: Record<string, number>,
  days: number, machines: number, line: LineParam, econ: Econ,
): StrategyResult {
  const perSku: SkuPlan[] = skus.map((s) => {
    const demand = Math.max(0, demands[s.id] ?? s.demand);
    const runs = runsFor(strategy, s, demand, days, line, econ);
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
  const totalDemand = sum((p) => Math.max(0, demands[p.id] ?? 0)) || 1;

  return {
    strategy, perSku, lanes,
    makespanH: round(makespanH), makespanDays: round(makespanH / HOURS_PER_DAY, 1),
    changeovers: sum((p) => p.runs),
    inventoryUnits: round(inventoryUnits), daysOfStock: round(inventoryUnits / (totalDemand / days), 1),
    scrapKg: round(scrapKg), energyKwh: round(energyKwh),
    energyOmr: round(energyOmr), holdingOmr: round(holdingOmr), scrapOmr: round(scrapOmr),
    totalOmr: round(energyOmr + holdingOmr + scrapOmr),
  };
}

export function planAll(skus: SkuParam[], demands: Record<string, number>, days: number,
                        machines: number, line: LineParam, econ: Econ): Record<Strategy, StrategyResult> {
  return {
    mto: planStrategy('mto', skus, demands, days, machines, line, econ),
    balanced: planStrategy('balanced', skus, demands, days, machines, line, econ),
    mts: planStrategy('mts', skus, demands, days, machines, line, econ),
  };
}
