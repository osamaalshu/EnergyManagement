// In-browser order scheduler for the planner. Recomputes a single-machine (MC01)
// plan live as the manager edits orders: sequence-dependent setups, on-time vs due
// dates, scrap, and a Monte-Carlo confidence band. The exact optimiser runs
// server-side; this is the fast interactive model.

export interface SkuParam {
  id: string; name: string; family: string; diameterMm: number;
  demand: number; rateEffective: number; kgPerUnit: number; meanRejection: number;
}
export interface LineParam {
  machineKw: number; changeoverH: number; changeoverKw: number;
  nMachines: number; machineNames: string[] | null;
}
export interface Econ { elecOmrPerKwh: number; materialOmrPerKg: number; holdingRateAnnual: number; }

const round = (v: number, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

export const energyIntensityKwhPerKg = (machineKw: number, rateEffective: number, kgPerUnit: number): number => { const d = rateEffective * kgPerUnit; return d > 0 ? machineKw / d : 0; };

// ── A synthetic full-catalogue plant, kept ONLY for the clearly-labelled
// "Illustrative" toggle. Not the client's data. Real decisions use the pilot data.
export const DEMO_LINE: LineParam = {
  machineKw: 75, changeoverH: 2, changeoverKw: 75, nMachines: 1,
  machineNames: ['Machine 01'],
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

// ── Sequence-dependent changeover: switching FAMILY (different recipe/colour) costs
//    far more than switching only DIAMETER within a family (a die/calibrator change).
//    Assumptions, to be replaced by the measured matrix from the changeover log.
export const SETUP_FAMILY_H = 3.0;
export const SETUP_DIAMETER_H = 0.5;
export type SetupType = 'none' | 'diameter' | 'family';

// ── Monte-Carlo CONFIDENCE band. The schedule is deterministic; MC only quantifies
//    risk: run rates vary run-to-run, so "finishes in N days" becomes a distribution
//    and "ships on time" becomes a probability. RATE_CV is an ASSUMED run-time
//    variability — not measured. We have proof rates are highly dispersed (the
//    effective-vs-median rate gap), but the effective rate already absorbs the mean
//    impact, so this models only residual run-to-run spread. Adjustable in the UI.
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

// ════════════════════════════════════════════════════════════════════
//  ORDER BOOK — the real-world input: orders with quantities and due dates
// ════════════════════════════════════════════════════════════════════

export interface Order { id: string; productId: string; qty: number; dueDay: number; priority?: boolean; }
export interface OrderItem {
  orderId: string; machine: number; machineName: string; seq: number;
  productId: string; name: string; family: string; diameterMm: number;
  qty: number; runtimeH: number; setupBeforeH: number; setupType: SetupType;
  startH: number; endH: number; finishDay: number; dueDay: number; onTime: boolean; lateDays: number;
  onTimeProb?: number;
}
export interface OrderSchedule {
  mode: 'grouped' | 'due' | 'balanced';
  items: OrderItem[];
  lanes: { machine: number; name: string; items: OrderItem[]; loadH: number }[];
  productionH: number; changeoverH: number; familyChanges: number; diameterChanges: number;
  makespanH: number; makespanDays: number; capacityPerMachineH: number; utilization: number; fits: boolean;
  steadyStatePct: number;  // production time / (production + changeover) — higher = steadier runs
  onTime: number; total: number; lateOrders: OrderItem[];
  baseScrapKg: number; startupScrapKg: number; scrapKg: number; scrapOmr: number;
}

export function scheduleOrders(
  orders: Order[], products: Record<string, SkuParam>, days: number, machines: number,
  line: LineParam, econ: Econ, hoursPerDay: number,
  famH = SETUP_FAMILY_H, diaH = SETUP_DIAMETER_H, startupScrapKgPerChangeover = 0,
  mode: 'grouped' | 'due' | 'balanced' = 'grouped',
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
  if (mode === 'due') { // EDD: hit due dates, ignore family discipline (most changeovers)
    const load = new Array(m).fill(0);
    for (const o of [...valid].sort((a, b) => a.dueDay - b.dueDay)) {
      const lo = load.indexOf(Math.min(...load)); machineSeqs[lo].push(o); load[lo] += runtime(o);
    }
  } else { // whole families per machine — 'grouped' (fewest changeovers) or 'balanced' (urgent families first)
    const fams = [...new Set(valid.map((o) => products[o.productId].family))];
    const famLoad = (f: string) => valid.filter((o) => products[o.productId].family === f).reduce((a, o) => a + runtime(o), 0);
    const famDue = (f: string) => Math.min(...valid.filter((o) => products[o.productId].family === f).map((o) => o.dueDay));
    fams.sort((a, b) => mode === 'balanced' ? famDue(a) - famDue(b) : famLoad(b) - famLoad(a));
    const load = new Array(m).fill(0);
    for (const f of fams) {
      const fo = valid.filter((o) => products[o.productId].family === f).sort((a, b) =>
        mode === 'balanced'
          ? (a.dueDay - b.dueDay || products[a.productId].diameterMm - products[b.productId].diameterMm)
          : (products[a.productId].diameterMm - products[b.productId].diameterMm || a.dueDay - b.dueDay));
      const lo = load.indexOf(Math.min(...load)); machineSeqs[lo].push(...fo); load[lo] += famLoad(f);
    }
  }

  const items: OrderItem[] = [];
  const lanes = machineSeqs.map((rawSeq, mi) => {
    // Priority orders jump to the front of the line (earliest-due first); the rest
    // keep the strategy's ordering. Lets a manager protect must-ship corporate
    // commitments even if it costs an extra changeover.
    const seq = [...rawSeq.filter((o) => o.priority).sort((a, b) => a.dueDay - b.dueDay), ...rawSeq.filter((o) => !o.priority)];
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
    steadyStatePct: round(productionH / (productionH + changeoverH || 1), 3),
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
