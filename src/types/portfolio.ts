// ── Time resolution ──────────────────────────────────────────────
export type TimeResolution = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Where the dashboard's data comes from, as a product environment:
 *  - `demo`       polished sample dataset used to present the intended UX
 *  - `historical` a real but non-current dataset (show "Latest available · <date>")
 *  - `live`       a real current feed (may show "Live" only if also fresh)
 */
export type DataMode = 'demo' | 'historical' | 'live';

/**
 * Dataset-level provenance/freshness (Slice 1 of the provenance contract).
 * One descriptor for the whole dashboard, derived at the adapter boundary.
 * `mode` is the source of truth; "is it live?" is *derived* from mode + freshness
 * (see `isLiveDataset` in lib/datasetFreshness.ts) rather than stored, to avoid
 * a redundant field that could disagree with `mode`.
 */
export interface DatasetMeta {
  /** ISO date (YYYY-MM-DD) of the latest real reading. */
  asOf: string;
  /** ISO date of the earliest real reading. */
  coverageStart: string;
  /** ISO date the underlying JSON was prepared (build/process date). */
  generatedAt: string;
  mode: DataMode;
}

/** A record keyed by time resolution containing data of type T */
export type ByResolution<T> = Record<TimeResolution, T>;

// ── Performance band ──────────────────────────────────────────────
export type PerformanceBand = 'Exceeded' | 'Average' | 'Lower';

// ── Portfolio-level ──────────────────────────────────────────────
export interface PortfolioWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  /** Optional: clicking navigates to this building */
  buildingId?: string;
  /** Optional: clicking navigates to this equipment within the building */
  equipmentId?: string;
}

export interface PortfolioNotification {
  id: string;
  title: string;
  read: boolean;
  /** Optional: clicking navigates to this building */
  buildingId?: string;
  /** Optional: clicking navigates to this equipment within the building */
  equipmentId?: string;
  /** Optional: external link (opens in new tab) */
  externalUrl?: string;
}

export interface HourlyProductionConsumptionPoint {
  hour: string;
  production: number;
  consumption: number;
}

export interface PortfolioMeta {
  name: string;
  buildingCount: number;
  score: number;          // out of 100
  savingsPotentialPercent: number;
}

export interface KpiValue {
  kWh: number;
  omr: number;
}

// ── Building-level ───────────────────────────────────────────────
export interface Building {
  id: string;
  name: string;
  sector: string;
  surfaceArea: number;                 // m²
  normalizedConsumption: number;       // kWh/m²
  performanceBand: PerformanceBand;
  category: string;
}

export interface MonthComparison {
  month: string;
  status: PerformanceBand;
  portfolioValue: number;
  sectorValue: number;
}

export interface ConsumptionBreakdownEntry {
  name: string;
  value: number;
  color: string;
}

// ── Anomaly ──────────────────────────────────────────────────────
export interface AnomalyPoint {
  label: string;
  baseline: number;
  actual: number;
}

export interface AnomalyData {
  anomalyCount: number;
  inefficiencyCost: number; // OMR
  series: AnomalyPoint[];
}

// ── Equipment ────────────────────────────────────────────────────
export type EquipmentType = 'chiller' | 'coolingTower' | 'pump';
export type EquipmentStatus = 'running' | 'off' | 'warning';

export interface Equipment {
  id: string;
  buildingId: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  /** Quick-glance value shown on the card (kW for chillers/pumps, °C for towers) */
  primaryValue: number;
  primaryUnit: string;
  /** Secondary value (efficiency for chillers) */
  secondaryValue?: number;
  secondaryUnit?: string;
}

export interface ChillerKPIs {
  deltaT: number;                    // °C
  chilledWaterFlowRate: number;      // L/s
  condenserWaterFlowRate: number;    // L/s
  coolingTons: number;
  efficiency: number;                // kW/ton
  powerDraw: number;                 // kW
  chilledWaterSupplyTemp: number;    // °C
  chilledWaterReturnTemp: number;    // °C
  condenserWaterSupplyTemp: number;  // °C
  condenserWaterReturnTemp: number;  // °C
}

export interface CoolingTowerKPIs {
  condenserWaterSupplyTemp: number;  // °C
}

export interface PumpKPIs {
  powerDraw: number;                 // kW
  flowRate: number;                  // m³/s (total chilled water flow)
  specificEnergy: number;            // kWh/m³
}

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface TemperatureLoopPoint {
  label: string;
  chilledSupply: number;
  chilledReturn: number;
  condenserSupply: number;
  condenserReturn: number;
  ambientTemp?: number;
}

export interface PowerCoolingPoint {
  label: string;
  power: number;
  coolingTons: number;
}

export interface EquipmentDetail {
  equipment: Equipment;
  chillerKPIs?: ChillerKPIs;
  coolingTowerKPIs?: CoolingTowerKPIs;
  pumpKPIs?: PumpKPIs;
  efficiencySeries?: TimeSeriesPoint[];
  temperatureLoopSeries?: TemperatureLoopPoint[];
  powerCoolingSeries?: PowerCoolingPoint[];
  anomaly: AnomalyData;
}

// ── Tariff / COP / Baseline ──────────────────────────────────────
export interface TariffHourlyDataPoint {
  timestamp: string;
  kw: number;
  kwh: number;
}

export interface CopDataPoint {
  label: string;
  value: number;
}

export interface BaselineDeviationPoint {
  label: string;
  month: string;
  actual: number;
  baseline: number;
  deviationPercent: number;
}

// ── Enriched data (Python reference engine output) ──────────────
/** Connection voltage levels supported by the APSR CRT engine */
export type CrtVoltage = '33kV' | '11kV' | '0.415kV';

export interface QualityEpisode {
  reason: string;
  status?: string;
  count: number;
  first: string;
  last: string;
  distinctDays: number;
}

export interface ChillerQualityReport {
  totalRows: number;
  byStatus: Record<string, number>;
  goodForDiagnosis: number;
  /** GOOD + SUSPECT — the basis used for COP/efficiency. */
  usableForDiagnosis?: number;
  /** Inverted-ΔT / impossible-COP readings — kept and flagged to investigate. */
  impossibleReadings?: number;
  flaggedNotDiscarded: number;
  episodes: QualityEpisode[];
}

export interface DataQualityReport {
  totalRows: number;
  byStatus: Record<string, number>;
  perChiller: Record<string, ChillerQualityReport>;
}

export interface PhysicsRuleResult {
  ruleId: string;
  severity: string;
  triggeredHours: number;
  evaluatedHours: number;
  omrImpact: number;
  description: string;
}

export interface MonthlyKwPerTonPoint {
  month: string;
  label: string;
  actual: number;
  benchmark: number;
}

export interface MonthlyCopPoint {
  month: string;
  label: string;
  value: number;
}

export interface ChillerPhysics {
  goodRows: number;
  avgCop: number;
  avgKwPerTon: number;
  monthlyKwPerTon: MonthlyKwPerTonPoint[];
  monthlyCop: MonthlyCopPoint[];
  rules: PhysicsRuleResult[];
}

export interface CrtBandDetail {
  kwh: number;
  omr: number;
}

export interface CrtMonthlyBill {
  month: string;
  label: string;
  hours: number;
  totalKwh: number;
  bstOmr: number;
  duosOmr: number;
  tuosOmr: number;
  standingOmr: number;
  subtotalOmr: number;
  vatOmr: number;
  totalOmr: number;
  peakKw: number;
  coincidentKw: number;
  byBand: Record<string, CrtBandDetail>;
}

export interface TariffOptionTotal {
  totalOmr: number;
  energyOmr: number;
  months: number;
}

export interface DecompositionMonth {
  month: string;
  label: string;
  totalOmr: number;
  structuralOmr: number;
  structuralPct: number;
  tariffDrivenOmr: number;
  tariffDrivenPct: number;
  operationalOmr: number;
  operationalPct: number;
  targetCop: number;
  actualCop: number;
  physicsOmr: number;
  physicsRawOmr: number;
  referenceTotalOmr: number;
  referenceProfile: string;
  /** True when the month's actual bill came in below the reference profile */
  betterThanReference: boolean;
  savingsVsReferenceOmr: number;
  operationalComponents: Record<string, number>;
}

// ── Building detail ──────────────────────────────────────────────
export interface BuildingAggregateKPIs {
  systemDeltaT: number;       // °C
  totalFlowRate: number;      // L/s
  systemKwPerTon: number;     // kW/ton
}

export interface BuildingDetail {
  building: Building;
  aggregateKPIs: BuildingAggregateKPIs;
  equipment: Equipment[];
  anomaly: AnomalyData;
}
