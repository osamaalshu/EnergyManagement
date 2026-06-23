// Run Fragility — a planner-facing pre-flight risk signal for a planned run.
//
// What it is: a relative startup/transition fragility score (0–100) computed from
// PLANNING-VISIBLE fields only (transition type, cold start, run size). It surfaces
// elevated startup/transition risk BEFORE a run is released, with the drivers and a
// rule-based action — it is NOT a scrap oracle and not a proven cause.
//
// Calibration: the weights are grounded in our internal MC01 analysis (first run of a
// campaign ~3× scrap; cold restart 3.87% vs 2.31%; sub-economic runs ~4×). Those are
// internal calibration assumptions, not formally product-claimed numbers — hence the
// `confidence: 'planning-only'` flag and the DEFERRED note in the UI.
//
// Deferred (NOT in planning data): colour-change severity, material-lot change and
// machine soak state. Those are a second, sensor-/changeover-log-driven layer; the
// UI contract (score, band, reasons, actions) stays the same when they land.
import type { OrderItem, OrderSchedule } from './productionModel';

export type FragilityBand = 'low' | 'moderate' | 'high' | 'critical';

export interface FragilityReason {
  code: 'family-change' | 'diameter-change' | 'cold-start' | 'sub-economic' | 'steady';
  label: string;
  impact: number;          // points this driver contributed to the score
  detail?: string;
}

export interface FragilityAction {
  code: 'campaign' | 'consolidate' | 'warm-start' | 'none';
  label: string;
  priority: 'info' | 'review' | 'act';
}

export interface RunFragility {
  score: number;
  band: FragilityBand;
  confidence: 'planning-only'; // ERP-derivable slice only — keeps the estimate honest
  reasons: FragilityReason[];
  actions: FragilityAction[];
}

// Fixed driver weights (the ERP-derivable slice). Sum of the heaviest realistic case
// (family + cold start + sub-economic = 90) lands in 'critical'; a clean continuation = 0 = 'low'.
const W_FAMILY = 45;
const W_DIAMETER = 20;
const W_COLD_START = 25;
const W_SUB_ECONOMIC = 20;

function bandFor(score: number): FragilityBand {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

export function runFragility(it: OrderItem): RunFragility {
  let score = 0;
  const reasons: FragilityReason[] = [];

  // Transition severity: a family change (recipe/colour swap) costs far more than a
  // diameter-only change (a die/calibrator change), so they are mutually exclusive here.
  if (it.setupType === 'family') {
    score += W_FAMILY;
    reasons.push({ code: 'family-change', label: 'Family change', impact: W_FAMILY,
      detail: 'Recipe/colour swap — the first run of a campaign scraps ~3× (internal calibration)' });
  } else if (it.setupType === 'diameter') {
    score += W_DIAMETER;
    reasons.push({ code: 'diameter-change', label: 'Diameter change', impact: W_DIAMETER,
      detail: 'Die/calibrator swap before this run' });
  }

  // Cold start: the first run on a lane warms the line from idle.
  if (it.seq === 1) {
    score += W_COLD_START;
    reasons.push({ code: 'cold-start', label: 'Cold start', impact: W_COLD_START,
      detail: 'Line warming from idle scraps more (internal calibration: 3.87% vs 2.31%)' });
  }

  // Small / sub-economic run: short runs carry startup scrap over fewer good kg.
  if (it.isSubEconomic) {
    score += W_SUB_ECONOMIC;
    reasons.push({ code: 'sub-economic', label: 'Sub-economic run', impact: W_SUB_ECONOMIC,
      detail: 'Below the min economic batch — small runs scrap ~4× (part is job-mix, not startup alone)' });
  }

  if (score > 100) score = 100;
  const band = bandFor(score);

  if (reasons.length === 0) {
    reasons.push({ code: 'steady', label: 'Steady continuation', impact: 0,
      detail: 'No transition or small-run penalty in planning data' });
  }

  // Actions prescribe a concrete schedule decision, not just a colour. Priority rises
  // with the score so the planner knows what to act on vs merely review.
  const actions: FragilityAction[] = [];
  if (it.setupType === 'family') {
    actions.push({ code: 'campaign', label: 'Group with same-family runs into one campaign',
      priority: score >= 60 ? 'act' : 'review' });
  }
  if (it.isSubEconomic) {
    actions.push({ code: 'consolidate', label: 'Merge with another order of this product, or extend the run',
      priority: 'act' });
  }
  if (it.seq === 1) {
    actions.push({ code: 'warm-start', label: 'Sequence after a compatible warm run, or apply a standardised startup',
      priority: 'review' });
  }
  if (actions.length === 0) {
    actions.push({ code: 'none', label: 'No action — steady run', priority: 'info' });
  }

  return { score, band, confidence: 'planning-only', reasons, actions };
}

export interface PlanViolation {
  kind: 'family-change' | 'sub-economic' | 'fragile-run' | 'reset-heavy';
  count: number;
  severity: 'review' | 'act';
  message: string;
  action: string;
}

export interface PlanRules {
  bandCounts: Record<FragilityBand, number>;
  violations: PlanViolation[];
}

// Plan-level rules read the whole schedule. They prescribe schedule decisions in plain
// language — the §6b prescription: not just "fragile", but "fragile because X; do Z".
const RESET_HEAVY_RATIO = 0.4; // setups / runs above this = reset-heavy plan worth resequencing

export function planRules(s: OrderSchedule): PlanRules {
  const runs = s.items.map(runFragility);
  const bandCounts: Record<FragilityBand, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const r of runs) bandCounts[r.band] += 1;

  const fragileRuns = bandCounts.high + bandCounts.critical;
  const subEcon = s.items.filter((i) => i.isSubEconomic).length;
  const totalResets = s.familyChanges + s.diameterChanges;
  const resetRatio = s.items.length > 0 ? totalResets / s.items.length : 0;

  const violations: PlanViolation[] = [];
  if (s.familyChanges > 0) {
    violations.push({ kind: 'family-change', count: s.familyChanges, severity: 'act',
      message: `${s.familyChanges} family change${s.familyChanges === 1 ? '' : 's'} — each is a full recipe/colour reset`,
      action: 'Group same-family runs into one campaign to cut resets' });
  }
  if (subEcon > 0) {
    violations.push({ kind: 'sub-economic', count: subEcon, severity: 'review',
      message: `${subEcon} sub-economic run${subEcon === 1 ? '' : 's'} below the min economic batch`,
      action: 'Merge with another order of the same product, or extend the run' });
  }
  if (fragileRuns > 0) {
    violations.push({ kind: 'fragile-run', count: fragileRuns, severity: 'review',
      message: `${fragileRuns} fragile run${fragileRuns === 1 ? '' : 's'} (high or critical)`,
      action: 'Re-sequence so transitions cluster; protect the first run with a standardised startup' });
  }
  if (resetRatio > RESET_HEAVY_RATIO) {
    violations.push({ kind: 'reset-heavy', count: totalResets, severity: 'review',
      message: `Reset-heavy plan — ${totalResets} setups across ${s.items.length} runs (${Math.round(resetRatio * 100)}%)`,
      action: 'Consolidate runs so fewer resets land in one shift' });
  }

  return { bandCounts, violations };
}
