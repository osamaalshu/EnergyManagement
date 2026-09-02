// Types for the generated PV + BESS reference dataset.
// Source of truth: tools/export_pv_bess_dashboard.py in the enerlytics platform repo,
// which replays recorded public datasets through the block 6 / block 7 physics and the
// ADR-022 forecast + dispatch engines. Nothing here is a live feed.
import type { DatasetMeta } from '@/types/portfolio';

export interface PvBessMeta extends DatasetMeta {
  note: string;
}

export interface PvSite {
  name: string;
  tracking: 'fixed' | 'dual_axis';
  poaBasis: string;
  location: string;
  year: number;
  dcNameplateKw: number;
  mode: 'historical';
}

export interface PvAnnual {
  energyKwh: number;
  meterRegisterDeltaKwh: number;
  meterAgreementPct: number;
  specificYieldKwhPerKwp: number;
  poaKwhPerM2: number;
  performanceRatio: number;
  poaSensorCoveragePct: number;
}

export interface PvMonth {
  month: string;
  energyKwh: number;
  specificYieldKwhPerKwp: number;
  poaKwhPerM2: number;
  performanceRatio: number;
  availabilityPct: number;
  intervals: number;
}

export interface ForecastHour {
  hour: string;
  forecastKw: number;
  actualKw: number;
  poa: number;
}

export interface ForecastDay {
  day: string;
  csiUsed: number;
  siteFactor: number;
  siteFactorDays: number;
  forecastKwh: number;
  actualKwh: number;
  absPctError: number;
  hourly: ForecastHour[];
}

export interface ForecastSkill {
  days: number;
  mape_pct: number;
  median_ape_pct: number;
  share_within_10pct: number;
  p90_ape_pct: number;
}

export interface PvForecast {
  method: string;
  skill: ForecastSkill;
  clearDay: ForecastDay;
  cloudyDay: ForecastDay;
}

export interface FaultClass {
  label: string;
  minutes: number;
  medianResidualPctOfNameplate: number;
  p10: number;
  p90: number;
  flaggedMediumOrHighPct: number;
  flaggedHighPct: number;
}

export interface CalibrationClass {
  label: string;
  minutes: number;
  againstDatasheetPct: number;
  againstHealthyBaselinePct: number;
}

export interface FaultCalibration {
  status: string;
  fitRows?: number;
  heldOutRows?: number;
  cvRmsePct?: number;
  note?: string;
  reason?: string;
  classes?: CalibrationClass[];
}

export interface InverterRow {
  id: string;
  rows: number;
  efficiencyMedian: number;
  efficiencyP10: number;
  mediumFlags: number;
  belowLoadFloor: number;
}

export interface NasaCell {
  cycles: number;
  capacityAh: number[];
  sohPct: number[];
  rte: (number | null)[];
  rteMedian: number;
  eolCycle: number | null;
}

export interface SeversonCell {
  policy: string;
  cycles: number;
  qd_first: number;
  qd_last: number;
  fade_pct: number;
  rte_median: number;
  rte_n: number;
}

export interface DispatchHour {
  hour: string;
  loadKw: number;
  pvKw: number;
  rateBz: number;
  band: string;
  chargeKw: number;
  dischargeKw: number;
  gridImportKw: number;
  gridImportWithoutKw: number;
  curtailedKw: number;
  socPct: number;
}

export interface DispatchDay {
  loadDate: string;
  pvDate: string;
  hourly: DispatchHour[];
  costWithoutOmr: number;
  costWithOmr: number;
  savingOmr: number;
  savingPct: number;
  peakImportWithoutKw: number;
  peakImportWithKw: number;
  selfConsumptionWithoutPct: number;
  selfConsumptionWithPct: number;
  cyclesUsed: number;
}

export interface DispatchMonth {
  days: number;
  savingOmr: number;
  savingOmrPerDayMedian: number;
  peakImportWithoutKwMedian: number;
  peakImportWithKwMedian: number;
  selfConsumptionWithoutPct: number;
  selfConsumptionWithPct: number;
}

export interface PvBessData {
  meta: PvBessMeta;
  pv: { site: PvSite; annual: PvAnnual; monthly: PvMonth[]; forecast: PvForecast };
  pvFaults: { mode: string; source: string; path: string; classes: FaultClass[]; calibration: FaultCalibration };
  inverterFleet: { mode: string; source: string; path: string; inverters: InverterRow[] };
  bess: {
    mode: string;
    nasa: { source: string; cells: Record<string, NasaCell> };
    severson: { source: string; cells: Record<string, SeversonCell> };
    definitions: { rte: string; soh: string; eol: string };
  };
  dispatch: {
    mode: string;
    scenarioNote: string;
    assumptions: { pvKwp: number; batteryKwh: number; batteryKw: number; roundTripEfficiency: number; usableDodPct: number; tariff: string; solver: string };
    day: DispatchDay;
    month: DispatchMonth;
  };
  provenance: { datasets: string; replay: string; engines: string[]; standards: string[] };
}
