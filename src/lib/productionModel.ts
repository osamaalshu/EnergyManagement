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
  id: string; name: string; family: string; diameterMm: number;
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
const _s = (id: string, family: string, diameterMm: number, demand: number, rateEffective: number, kgPerUnit: number, meanRejection: number): SkuParam =>
  ({ id, name: `${family} ${diameterMm} mm`, family, diameterMm, demand, rateEffective, kgPerUnit, meanRejection });
export const DEMO_SKUS: SkuParam[] = [
  _s('DR-75', 'Drainage', 75, 34000, 27, 4.0, 0.018),
  _s('DR-110', 'Drainage', 110, 28000, 22, 6.4, 0.020),
  _s('DR-160', 'Drainage', 160, 18000, 15, 11.2, 0.022),
  _s('DR-200', 'Drainage', 200, 9000, 10, 16.8, 0.028),
  _s('PR-75', 'Pressure', 75, 30000, 26, 5.2, 0.019),
  _s('PR-110', 'Pressure', 110, 24000, 20, 9.1, 0.024),
  _s('PR-160', 'Pressure', 160, 14000, 14, 14.0, 0.026),
  _s('CO-20', 'Conduit', 20, 60000, 40, 1.3, 0.015),
  _s('CO-25', 'Conduit', 25, 48000, 36, 1.7, 0.016),
  _s('CO-32', 'Conduit', 32, 36000, 30, 2.4, 0.017),
  _s('WP-50', 'Waste', 50, 26000, 28, 3.1, 0.018),
  _s('WP-110', 'Waste', 110, 16000, 18, 7.3, 0.021),
];

// ── Planning periods. Quantities are scaled from the calibrated annual demand.
export const PERIODS: Record<string, { label: string; days: number }> = {
  week: { label: 'Week', days: 7 },
  month: { label: 'Month', days: 30 },
  season: { label: 'Season', days: 91 },
  year: { label: 'Year', days: 365 },
};

// ── Sequence-dependent changeover, the real cost structure: switching FAMILY
//    (drainage→pressure: different recipe/colour) costs far more than switching
//    only DIAMETER within a family (just a die/calibrator change). Assumptions,
//    to be replaced by the measured matrix from the changeover log.
export const SETUP_FAMILY_H = 3.0;
export const SETUP_DIAMETER_H = 0.5;

export type SetupType = 'none' | 'diameter' | 'family';
export interface ScheduleItem {
  machine: number; machineName: string; seq: number;
  id: string; name: string; family: string; diameterMm: number;
  pieces: number; runtimeH: number; setupBeforeH: number; setupType: SetupType;
  startH: number; endH: number;
}
export interface ScheduleResult {
  items: ScheduleItem[];
  lanes: { machine: number; name: string; items: ScheduleItem[]; loadH: number }[];
  productionH: number; changeoverH: number; familyChanges: number; diameterChanges: number;
  makespanH: number; makespanDays: number; capacityPerMachineH: number; fits: boolean; utilization: number;
  naiveChangeoverH: number; savedH: number;
  energyKwh: number; costOmr: number;
}

// ── Monte-Carlo CONFIDENCE band. The schedule itself is deterministic; MC only
//    quantifies risk: rates vary run-to-run, so "finishes in N days" becomes a
//    distribution and "fits" becomes a probability. RATE_CV is the assumed
//    run-time variability (replace with the per-product spread once exposed).
export const RATE_CV = 0.35;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonteCarlo {
  p50Days: number; p90Days: number; pFit: number; deadlineDays: number;
  hist: { day: number; count: number; over: boolean }[];
  samplesDays: number[];
}

// structural: any schedule with lanes of run-times + setups (SKU- or order-based)
type LanedSchedule = { lanes: { items: { runtimeH: number; setupBeforeH: number }[] }[] };

export function monteCarloFit(sched: LanedSchedule, capH: number, hoursPerDay: number,
                              cv = RATE_CV, reps = 1500, seed = 42): MonteCarlo {
  const rng = mulberry32(seed);
  const gauss = () => { // Box–Muller
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const sigma = Math.sqrt(Math.log(1 + cv * cv)); const mu = -sigma * sigma / 2;
  const mult = () => Math.exp(mu + sigma * gauss()); // mean 1, CV = cv
  const lanes = sched.lanes.map((l) => ({
    setup: l.items.reduce((a, it) => a + it.setupBeforeH, 0),
    runs: l.items.map((it) => it.runtimeH),
  }));

  const samples: number[] = [];
  for (let r = 0; r < reps; r++) {
    let mk = 0;
    for (const lane of lanes) {
      let t = lane.setup;
      for (const rt of lane.runs) t += rt * mult();
      if (t > mk) mk = t;
    }
    samples.push(mk);
  }
  samples.sort((a, b) => a - b);
  const pct = (q: number) => samples[Math.floor((q / 100) * (samples.length - 1))] || 0;
  const pFit = samples.filter((s) => s <= capH).length / samples.length;

  const minD = samples[0] / hoursPerDay, maxD = samples[samples.length - 1] / hoursPerDay;
  const deadlineDays = capH / hoursPerDay;
  const nb = 16; const w = (maxD - minD) / nb || 1;
  const hist = Array.from({ length: nb }, (_, i) => {
    const lo = minD + i * w, center = lo + w / 2;
    const count = samples.filter((s) => { const d = s / hoursPerDay; return d >= lo && (i === nb - 1 ? d <= lo + w + 1e-9 : d < lo + w); }).length;
    return { day: round(center, 1), count, over: center > deadlineDays };
  });
  return { p50Days: round(pct(50) / hoursPerDay, 1), p90Days: round(pct(90) / hoursPerDay, 1), pFit: round(pFit, 3), deadlineDays: round(deadlineDays, 1), hist, samplesDays: samples.map((s) => s / hoursPerDay) };
}

/** Build the changeover-minimising schedule: group products by family, step
 *  diameters within each family, balance whole families across machines. */
export function buildSchedule(
  skus: SkuParam[], pieces: Record<string, number>, days: number, machines: number,
  line: LineParam, econ: Econ, hoursPerDay: number,
  setupFamilyH: number = SETUP_FAMILY_H, setupDiameterH: number = SETUP_DIAMETER_H,
): ScheduleResult {
  const active = skus.filter((s) => (pieces[s.id] ?? 0) > 0);
  const runtime = (s: SkuParam) => (pieces[s.id] ?? 0) / Math.max(s.rateEffective, 1e-9);
  const setup = (prev: SkuParam | null, cur: SkuParam): { h: number; type: SetupType } =>
    !prev ? { h: 0, type: 'none' }
      : prev.family !== cur.family ? { h: setupFamilyH, type: 'family' }
        : prev.diameterMm !== cur.diameterMm ? { h: setupDiameterH, type: 'diameter' }
          : { h: 0, type: 'none' };

  // group by family → assign whole families to the least-loaded machine
  const families = [...new Set(active.map((s) => s.family))];
  const famLoad = (f: string) => active.filter((s) => s.family === f).reduce((a, s) => a + runtime(s), 0);
  families.sort((a, b) => famLoad(b) - famLoad(a));
  const m = Math.max(1, machines);
  const machineFamilies: SkuParam[][] = Array.from({ length: m }, () => []);
  const machineLoad = new Array(m).fill(0);
  for (const f of families) {
    const items = active.filter((s) => s.family === f).sort((a, b) => a.diameterMm - b.diameterMm); // step diameters
    const lo = machineLoad.indexOf(Math.min(...machineLoad));
    machineFamilies[lo].push(...items);
    machineLoad[lo] += famLoad(f);
  }

  const items: ScheduleItem[] = [];
  const lanes = machineFamilies.map((seq, mi) => {
    let t = 0; const laneItems: ScheduleItem[] = [];
    seq.forEach((s, idx) => {
      const su = setup(idx === 0 ? null : seq[idx - 1], s);
      const rt = runtime(s);
      const item: ScheduleItem = {
        machine: mi, machineName: line.machineNames?.[mi] ?? `Machine ${mi + 1}`, seq: idx + 1,
        id: s.id, name: s.name, family: s.family, diameterMm: s.diameterMm,
        pieces: pieces[s.id] ?? 0, runtimeH: rt, setupBeforeH: su.h, setupType: su.type,
        startH: t + su.h, endH: t + su.h + rt,
      };
      t = item.endH; laneItems.push(item); items.push(item);
    });
    return { machine: mi, name: line.machineNames?.[mi] ?? `Machine ${mi + 1}`, items: laneItems, loadH: t };
  });

  const productionH = active.reduce((a, s) => a + runtime(s), 0);
  const changeoverH = items.reduce((a, it) => a + it.setupBeforeH, 0);
  const familyChanges = items.filter((it) => it.setupType === 'family').length;
  const diameterChanges = items.filter((it) => it.setupType === 'diameter').length;
  const makespanH = Math.max(0, ...lanes.map((l) => l.loadH));
  const capacityPerMachineH = days * hoursPerDay;
  // naive = run ungrouped (entry order) — the reference the smart schedule beats
  let naiveChangeoverH = 0;
  for (let i = 1; i < active.length; i++) naiveChangeoverH += setup(active[i - 1], active[i]).h;

  const energyKwh = productionH * line.machineKw + changeoverH * line.changeoverKw;
  const costOmr = energyKwh * econ.elecOmrPerKwh;

  return {
    items, lanes,
    productionH: round(productionH), changeoverH: round(changeoverH, 1),
    familyChanges, diameterChanges,
    makespanH: round(makespanH), makespanDays: round(makespanH / hoursPerDay, 1),
    capacityPerMachineH: round(capacityPerMachineH), fits: makespanH <= capacityPerMachineH,
    utilization: round(capacityPerMachineH ? makespanH / capacityPerMachineH : 0, 3),
    naiveChangeoverH: round(naiveChangeoverH, 1), savedH: round(naiveChangeoverH - changeoverH, 1),
    energyKwh: round(energyKwh), costOmr: round(costOmr),
  };
}

// ════════════════════════════════════════════════════════════════════
//  ORDER BOOK — the real-world input: orders with quantities and due dates
// ════════════════════════════════════════════════════════════════════

export interface Order { id: string; productId: string; qty: number; dueDay: number; }
export interface OrderItem {
  orderId: string; machine: number; machineName: string; seq: number;
  productId: string; name: string; family: string; diameterMm: number;
  qty: number; runtimeH: number; setupBeforeH: number; setupType: SetupType;
  startH: number; endH: number; finishDay: number; dueDay: number; onTime: boolean; lateDays: number;
  onTimeProb?: number;
}
export interface OrderSchedule {
  mode: 'grouped' | 'due';
  items: OrderItem[];
  lanes: { machine: number; name: string; items: OrderItem[]; loadH: number }[];
  productionH: number; changeoverH: number; familyChanges: number; diameterChanges: number;
  makespanH: number; makespanDays: number; capacityPerMachineH: number; utilization: number; fits: boolean;
  onTime: number; total: number; lateOrders: OrderItem[];
  baseScrapKg: number; startupScrapKg: number; scrapKg: number; scrapOmr: number;
}

export function scheduleOrders(
  orders: Order[], products: Record<string, SkuParam>, days: number, machines: number,
  line: LineParam, econ: Econ, hoursPerDay: number,
  famH = SETUP_FAMILY_H, diaH = SETUP_DIAMETER_H, startupScrapKgPerChangeover = 0, mode: 'grouped' | 'due' = 'grouped',
): OrderSchedule {
  const valid = orders.filter((o) => o.qty > 0 && products[o.productId]);
  const runtime = (o: Order) => o.qty / Math.max(products[o.productId].rateEffective, 1e-9);
  const setup = (prev: Order | null, cur: Order): { h: number; type: SetupType } => {
    if (!prev) return { h: 0, type: 'none' };
    const a = products[prev.productId], b = products[cur.productId];
    if (a.family !== b.family) return { h: famH, type: 'family' };
    if (a.diameterMm !== b.diameterMm) return { h: diaH, type: 'diameter' };
    return { h: 0, type: 'none' };
  };

  const m = Math.max(1, machines);
  const machineSeqs: Order[][] = Array.from({ length: m }, () => []);
  if (mode === 'grouped') { // minimise changeover: whole families per machine, step diameters
    const fams = [...new Set(valid.map((o) => products[o.productId].family))];
    const famLoad = (f: string) => valid.filter((o) => products[o.productId].family === f).reduce((a, o) => a + runtime(o), 0);
    fams.sort((a, b) => famLoad(b) - famLoad(a));
    const load = new Array(m).fill(0);
    for (const f of fams) {
      const fo = valid.filter((o) => products[o.productId].family === f)
        .sort((a, b) => products[a.productId].diameterMm - products[b.productId].diameterMm || a.dueDay - b.dueDay);
      const lo = load.indexOf(Math.min(...load)); machineSeqs[lo].push(...fo); load[lo] += famLoad(f);
    }
  } else { // "current way": earliest due date, balanced — ignores family discipline
    const load = new Array(m).fill(0);
    for (const o of [...valid].sort((a, b) => a.dueDay - b.dueDay)) {
      const lo = load.indexOf(Math.min(...load)); machineSeqs[lo].push(o); load[lo] += runtime(o);
    }
  }

  const items: OrderItem[] = [];
  const lanes = machineSeqs.map((seq, mi) => {
    let t = 0; const laneItems: OrderItem[] = [];
    seq.forEach((o, idx) => {
      const p = products[o.productId]; const su = setup(idx === 0 ? null : seq[idx - 1], o); const rt = runtime(o);
      const endH = t + su.h + rt; const finishDay = endH / hoursPerDay;
      const it: OrderItem = {
        orderId: o.id, machine: mi, machineName: line.machineNames?.[mi] ?? `Machine ${mi + 1}`, seq: idx + 1,
        productId: o.productId, name: p.name, family: p.family, diameterMm: p.diameterMm,
        qty: o.qty, runtimeH: rt, setupBeforeH: su.h, setupType: su.type,
        startH: t + su.h, endH, finishDay: round(finishDay, 1), dueDay: o.dueDay,
        onTime: finishDay <= o.dueDay + 1e-9, lateDays: round(Math.max(0, finishDay - o.dueDay), 1),
      };
      t = endH; laneItems.push(it); items.push(it);
    });
    return { machine: mi, name: line.machineNames?.[mi] ?? `Machine ${mi + 1}`, items: laneItems, loadH: t };
  });

  const productionH = valid.reduce((a, o) => a + runtime(o), 0);
  const changeoverH = items.reduce((a, it) => a + it.setupBeforeH, 0);
  const familyChanges = items.filter((it) => it.setupType === 'family').length;
  const diameterChanges = items.filter((it) => it.setupType === 'diameter').length;
  const makespanH = Math.max(0, ...lanes.map((l) => l.loadH));
  const capacityPerMachineH = days * hoursPerDay;
  const baseScrapKg = valid.reduce((a, o) => a + o.qty * products[o.productId].kgPerUnit * products[o.productId].meanRejection, 0);
  const startupScrapKg = (familyChanges + diameterChanges) * startupScrapKgPerChangeover;
  const scrapKg = baseScrapKg + startupScrapKg;
  const lateOrders = items.filter((it) => !it.onTime);

  return {
    mode, items, lanes,
    productionH: round(productionH), changeoverH: round(changeoverH, 1), familyChanges, diameterChanges,
    makespanH: round(makespanH), makespanDays: round(makespanH / hoursPerDay, 1),
    capacityPerMachineH: round(capacityPerMachineH), utilization: round(capacityPerMachineH ? makespanH / capacityPerMachineH : 0, 3),
    fits: makespanH <= capacityPerMachineH,
    onTime: items.length - lateOrders.length, total: items.length, lateOrders,
    baseScrapKg: round(baseScrapKg), startupScrapKg: round(startupScrapKg), scrapKg: round(scrapKg), scrapOmr: round(scrapKg * econ.materialOmrPerKg),
  };
}

/** Monte-Carlo over the order schedule: per-order on-time PROBABILITY + the
 *  chance ALL orders ship on time + makespan samples (for the distribution graph). */
export function monteCarloOrders(sched: OrderSchedule, hoursPerDay: number, cv = RATE_CV, reps = 1500, seed = 42) {
  const rng = mulberry32(seed);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sigma = Math.sqrt(Math.log(1 + cv * cv)); const mu = -sigma * sigma / 2;
  const mult = () => Math.exp(mu + sigma * gauss());
  const onTimeCount: Record<string, number> = {};
  const samplesDays: number[] = []; let allOnTime = 0;
  for (let r = 0; r < reps; r++) {
    let mk = 0; let everyOnTime = true;
    for (const lane of sched.lanes) {
      let t = 0;
      for (const it of lane.items) {
        t += it.setupBeforeH + it.runtimeH * mult();
        const ok = t / hoursPerDay <= it.dueDay + 1e-9;
        if (ok) onTimeCount[it.orderId] = (onTimeCount[it.orderId] || 0) + 1; else everyOnTime = false;
      }
      if (t > mk) mk = t;
    }
    if (everyOnTime) allOnTime++;
    samplesDays.push(mk / hoursPerDay);
  }
  const onTimeProb: Record<string, number> = {};
  for (const it of sched.items) onTimeProb[it.orderId] = round((onTimeCount[it.orderId] || 0) / reps, 3);
  samplesDays.sort((a, b) => a - b);
  return { onTimeProb, pAllOnTime: round(allOnTime / reps, 3), samplesDays };
}
