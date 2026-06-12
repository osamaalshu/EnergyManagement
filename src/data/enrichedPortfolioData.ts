/**
 * enrichedPortfolioData.ts
 *
 * Typed adapter for generated/enrichedData.json — the output of the
 * Enerlytics Python reference platform (physics validation, diagnostic
 * rules, APSR CRT bills for Options 1/2/3, bill decomposition).
 *
 * Regenerate with:  npm run enrich
 * (requires the enerlytics Python repo; see scripts/enrich_data.py)
 */

import type {
  AnomalyData,
  ChillerPhysics,
  CrtMonthlyBill,
  CrtVoltage,
  DataQualityReport,
  DecompositionMonth,
  PhysicsRuleResult,
  TariffOptionTotal,
} from '../types/portfolio';

import enriched from './generated/enrichedData.json';

// ═══════════════════════════════════════════════════════════════════
//  META
// ═══════════════════════════════════════════════════════════════════

export const enrichedMeta = enriched.meta as {
  generatedAt: string;
  engine: string;
  tariffConfigYear: number;
  system: string;
  siteId: string;
  dataRange: { from: string; to: string; totalRows: number };
  notes: string[];
};

const _fromYear = enrichedMeta.dataRange.from.substring(0, 4);
const _toYear = enrichedMeta.dataRange.to.substring(0, 4);

/**
 * One-line tariff-vintage disclosure, DERIVED from `enrichedData.meta` — the
 * single source. The UI must render this string, never re-author the wording.
 * Distinguishes the historical load period from the (newer) tariff schedule, so
 * a bill is never mistaken for a historical invoice.
 */
export const tariffBasis = `Estimated using ${enrichedMeta.tariffConfigYear} CRT tariff rates applied to historical ${_fromYear}–${_toYear} load data.`;

/** Compact provenance view sourced from `enrichedData.meta` (period, build date, tariff vintage, engine, notes). */
export const datasetProvenance = {
  periodFrom: enrichedMeta.dataRange.from.substring(0, 10),
  periodTo: enrichedMeta.dataRange.to.substring(0, 10),
  generatedAt: enrichedMeta.generatedAt.substring(0, 10),
  tariffYear: enrichedMeta.tariffConfigYear,
  engine: enrichedMeta.engine,
  notes: enrichedMeta.notes,
};

// ═══════════════════════════════════════════════════════════════════
//  DATA QUALITY
// ═══════════════════════════════════════════════════════════════════

export const dataQuality: DataQualityReport = enriched.dataQuality as unknown as DataQualityReport;

/** Ordered status list for consistent rendering */
export const QUALITY_STATUS_ORDER = ['GOOD', 'SUSPECT', 'BAD', 'MISSING', 'IDLE'] as const;

export const QUALITY_STATUS_COLORS: Record<string, string> = {
  GOOD: '#82C91E',
  SUSPECT: '#FAB005',
  BAD: '#f87171',
  MISSING: '#a78bfa',
  IDLE: '#94a3b8',
};

// ═══════════════════════════════════════════════════════════════════
//  PHYSICS (GOOD-rows-only KPIs + diagnostic rules)
// ═══════════════════════════════════════════════════════════════════

type EnrichedPhysics = {
  constants: {
    copAlertThreshold: number;
    copBenchmarkPeak: number;
    kwPerTonBenchmark: number;
    copPhysicalBounds: number[];
    kwPerTonRefrigeration: number;
  };
  perChiller: Record<string, ChillerPhysics>;
  plant: ChillerPhysics & { avgKwPerTon?: number };
  notApplicableRules: { ruleId: string; reason: string }[];
  monthlyPhysicsOmr: { month: string; label: string; omr: number }[];
};

const physics = enriched.physics as unknown as EnrichedPhysics;

export const physicsConstants = physics.constants;
export const chillerPhysics: Record<string, ChillerPhysics> = physics.perChiller;
export const plantPhysics = physics.plant;
export const notApplicableRules = physics.notApplicableRules;
export const monthlyPhysicsOmr = physics.monthlyPhysicsOmr;

/**
 * Physics-based anomaly feed for AnomalyPanel: monthly kW/ton from
 * physics-validated GOOD rows vs the Gulf COP=4.5 benchmark, with the
 * rule engine's triggered-hour count and priced OMR impact as KPIs.
 */
export function getPhysicsAnomaly(chillerNum?: number): { data: AnomalyData; findings: PhysicsRuleResult[] } {
  const src = chillerNum ? chillerPhysics[String(chillerNum)] : plantPhysics;
  if (!src) {
    return { data: { anomalyCount: 0, inefficiencyCost: 0, series: [] }, findings: [] };
  }
  const findings = src.rules;
  const anomalyCount = findings.reduce((s, f) => s + f.triggeredHours, 0);
  const inefficiencyCost = Math.round(findings.reduce((s, f) => s + f.omrImpact, 0) * 10) / 10;
  return {
    data: {
      anomalyCount,
      inefficiencyCost,
      series: src.monthlyKwPerTon.map((p) => ({ label: p.label, baseline: p.benchmark, actual: p.actual })),
    },
    findings,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  CRT TARIFF (Options 1/2/3 × voltage levels)
// ═══════════════════════════════════════════════════════════════════

type EnrichedTariff = {
  voltages: CrtVoltage[];
  options: number[];
  defaultVoltage: CrtVoltage;
  bills: Record<string, Record<string, CrtMonthlyBill[]>>;
  optionTotals: Record<string, Record<string, TariffOptionTotal>>;
};

const tariff = enriched.tariff as unknown as EnrichedTariff;

export const crtVoltages: CrtVoltage[] = tariff.voltages;
export const crtDefaultVoltage: CrtVoltage = tariff.defaultVoltage;

export function getCrtBills(voltage: CrtVoltage, option: 1 | 2 | 3): CrtMonthlyBill[] {
  return tariff.bills[voltage]?.[String(option)] ?? [];
}

export function getOptionTotals(voltage: CrtVoltage): Record<string, TariffOptionTotal> {
  return tariff.optionTotals[voltage] ?? {};
}

export const TARIFF_OPTION_LABELS: Record<string, string> = {
  '1': 'Option 1 — Time of Use',
  '2': 'Option 2 — Seasonal',
  '3': 'Option 3 — Flat',
};

// ═══════════════════════════════════════════════════════════════════
//  BILL DECOMPOSITION
// ═══════════════════════════════════════════════════════════════════

type EnrichedDecomposition = {
  voltage: CrtVoltage;
  option: number;
  targetCop: number;
  months: DecompositionMonth[];
};

const decomposition = enriched.decomposition as unknown as EnrichedDecomposition;

export const decompositionMeta = {
  voltage: decomposition.voltage,
  option: decomposition.option,
  targetCop: decomposition.targetCop,
};
export const decompositionMonths: DecompositionMonth[] = decomposition.months;

// ═══════════════════════════════════════════════════════════════════
//  PARITY (Python engine vs TS tariffEngine.ts)
// ═══════════════════════════════════════════════════════════════════

export const tariffParity = enriched.parity as {
  checkedBills: number;
  maxDiffPct: number;
  tolerancePct: number;
  pass: boolean;
};
