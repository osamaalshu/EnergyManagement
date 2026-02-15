/**
 * realPortfolioData.ts
 *
 * Maps the preprocessed real CSV data (generated/realData.json)
 * into the same TypeScript shapes used by all dashboard components.
 *
 * Regenerate the JSON with:  node scripts/preprocess-csv.mjs
 */

import type {
  PortfolioWarning,
  PortfolioNotification,
  PortfolioMeta,
  KpiValue,
  HourlyProductionConsumptionPoint,
  Building,
  MonthComparison,
  ConsumptionBreakdownEntry,
  AnomalyData,
  AnomalyPoint,
  Equipment,
  BuildingDetail,
  BuildingAggregateKPIs,
  EquipmentDetail,
  ChillerKPIs,
  CoolingTowerKPIs,
  PumpKPIs,
  TimeSeriesPoint,
  TemperatureLoopPoint,
  PowerCoolingPoint,
  EquipmentStatus,
  TimeResolution,
  ByResolution,
} from '../types/portfolio';

import raw from './generated/realData.json';

// ═══════════════════════════════════════════════════════════════════
//  PORTFOLIO-LEVEL
// ═══════════════════════════════════════════════════════════════════

export const portfolioWarnings: PortfolioWarning[] = raw.warnings.map((w) => ({
  id: w.id,
  severity: w.severity as PortfolioWarning['severity'],
  message: w.message,
  timestamp: w.timestamp,
  buildingId: w.buildingId,
  equipmentId: (w as Record<string, unknown>).equipmentId as string | undefined,
}));

export const portfolioNotifications: PortfolioNotification[] = raw.notifications.map((n) => ({
  id: n.id,
  title: n.title,
  read: n.read,
  buildingId: (n as Record<string, unknown>).buildingId as string | undefined,
  equipmentId: (n as Record<string, unknown>).equipmentId as string | undefined,
  externalUrl: (n as Record<string, unknown>).externalUrl as string | undefined,
}));

export const portfolioMeta: PortfolioMeta = {
  name: raw.portfolioMeta.name,
  buildingCount: raw.portfolioMeta.buildingCount,
  score: Math.round(raw.portfolioMeta.score),
  savingsPotentialPercent: raw.portfolioMeta.savingsPotentialPercent,
};

export const todaysProduction: KpiValue = raw.todaysProduction;
export const todaysConsumption: KpiValue = raw.todaysConsumption;

export const hourlyProductionConsumption: HourlyProductionConsumptionPoint[] =
  (raw as unknown as { hourlyProductionConsumption: HourlyProductionConsumptionPoint[] }).hourlyProductionConsumption;

// ═══════════════════════════════════════════════════════════════════
//  BUILDING-LEVEL
// ═══════════════════════════════════════════════════════════════════

const buildingData = raw.building;

export const buildings: Building[] = [
  {
    id: buildingData.id,
    name: buildingData.name,
    sector: buildingData.sector,
    surfaceArea: buildingData.surfaceArea,
    normalizedConsumption: buildingData.normalizedConsumption,
    performanceBand: buildingData.performanceBand as Building['performanceBand'],
    category: buildingData.category,
  },
];

// Default monthly comparisons (backward compat)
export const monthComparisons: MonthComparison[] = raw.monthComparisons.map((mc) => ({
  month: mc.month,
  status: mc.status as MonthComparison['status'],
  portfolioValue: mc.portfolioValue,
  sectorValue: mc.sectorValue,
}));

// Multi-resolution comparisons
const rawComparisons = raw.comparisonsByResolution as Record<string, typeof raw.monthComparisons>;
const mapComparison = (mc: (typeof raw.monthComparisons)[number]) => ({ month: mc.month, status: mc.status as MonthComparison['status'], portfolioValue: mc.portfolioValue, sectorValue: mc.sectorValue });
export const comparisonsByResolution: ByResolution<MonthComparison[]> = {
  hourly:  rawComparisons.hourly.map(mapComparison),
  daily:   rawComparisons.daily.map(mapComparison),
  weekly:  rawComparisons.weekly.map(mapComparison),
  monthly: rawComparisons.monthly.map(mapComparison),
  yearly:  rawComparisons.yearly.map(mapComparison),
};

export const buildingConsumptionBreakdown: ConsumptionBreakdownEntry[] = raw.consumptionBreakdown;

// ── Portfolio anomaly (default = weekly, backward compat) ─────────
export const portfolioAnomaly: AnomalyData = {
  anomalyCount: raw.portfolioAnomaly.anomalyCount,
  inefficiencyCost: raw.portfolioAnomaly.inefficiencyCost,
  series: raw.portfolioAnomaly.series as AnomalyPoint[],
};

// Multi-resolution anomalies
type RawAnomalyData = { anomalyCount: number; inefficiencyCost: number; series: AnomalyPoint[] };
const rawPortfolioAnom = raw.portfolioAnomalyByResolution as Record<string, RawAnomalyData>;
const rawBuildingAnom = raw.buildingAnomalyByResolution as Record<string, RawAnomalyData>;

function mapAnomalyResolutions(source: Record<string, RawAnomalyData>): ByResolution<AnomalyData> {
  const resolutions: TimeResolution[] = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
  const result = {} as ByResolution<AnomalyData>;
  for (const res of resolutions) {
    const a = source[res];
    result[res] = {
      anomalyCount: a.anomalyCount,
      inefficiencyCost: a.inefficiencyCost,
      series: a.series as AnomalyPoint[],
    };
  }
  return result;
}

export const portfolioAnomalyByResolution: ByResolution<AnomalyData> = mapAnomalyResolutions(rawPortfolioAnom);
export const buildingAnomalyByResolution: ByResolution<AnomalyData> = mapAnomalyResolutions(rawBuildingAnom);

// ═══════════════════════════════════════════════════════════════════
//  EQUIPMENT
// ═══════════════════════════════════════════════════════════════════

const bid = buildingData.id; // 'CP1'

const chillerEquipment: Equipment[] = raw.chillerSnapshots.map((cs) => ({
  id: `${bid}-chiller-${cs.n}`,
  buildingId: bid,
  name: `Chiller ${cs.n}`,
  type: 'chiller' as const,
  status: cs.status as EquipmentStatus,
  primaryValue: cs.kW,
  primaryUnit: 'kW',
  secondaryValue: cs.efficiency,
  secondaryUnit: 'kW/ton',
}));

const towerEquipment: Equipment[] = raw.towerSnapshots.map((ts) => ({
  id: `${bid}-tower-${ts.n}`,
  buildingId: bid,
  name: `Cooling Tower ${ts.n}`,
  type: 'coolingTower' as const,
  status: ts.status as EquipmentStatus,
  primaryValue: ts.temp,
  primaryUnit: '°C',
}));

const pumpEquipment: Equipment[] = [
  {
    id: `${bid}-pump-1`,
    buildingId: bid,
    name: 'Chilled Water Pump',
    type: 'pump' as const,
    status: raw.pumpSnapshot.status as EquipmentStatus,
    primaryValue: raw.pumpSnapshot.kW,
    primaryUnit: 'kW',
  },
];

const allEquipment: Equipment[] = [...chillerEquipment, ...towerEquipment, ...pumpEquipment];

// ═══════════════════════════════════════════════════════════════════
//  BUILDING DETAILS MAP
// ═══════════════════════════════════════════════════════════════════

const aggregateKPIs: BuildingAggregateKPIs = raw.aggregateKPIs;

const buildingAnomaly: AnomalyData = {
  anomalyCount: raw.buildingAnomaly.anomalyCount,
  inefficiencyCost: raw.buildingAnomaly.inefficiencyCost,
  series: raw.buildingAnomaly.series as AnomalyPoint[],
};

export const buildingDetails: Record<string, BuildingDetail> = {
  [bid]: {
    building: buildings[0],
    aggregateKPIs,
    equipment: allEquipment,
    anomaly: buildingAnomaly,
  },
};

// ═══════════════════════════════════════════════════════════════════
//  EQUIPMENT DETAILS (for drill-down)
// ═══════════════════════════════════════════════════════════════════

type RawTimeSeries = {
  efficiencySeries: { label: string; value: number }[];
  temperatureLoopSeries: { label: string; chilledSupply: number; chilledReturn: number; condenserSupply: number; condenserReturn: number }[];
  powerCoolingSeries: { label: string; power: number; coolingTons: number }[];
};

type RawChillerAllResolutions = Record<string, RawTimeSeries>;

const rawChillerTS = raw.chillerTimeSeries as Record<string, RawChillerAllResolutions>;
const rawChillerAnomalies = raw.chillerAnomalies as Record<string, RawAnomalyData>;
const rawChillerAnomByRes = raw.chillerAnomaliesByResolution as Record<string, Record<string, RawAnomalyData>>;

// Build equipment details with default hourly series (shows latest 7 days of real variation)
const chillerDetails: Record<string, EquipmentDetail> = {};
for (const cs of raw.chillerSnapshots) {
  const eqId = `${bid}-chiller-${cs.n}`;
  const equip = chillerEquipment.find((e) => e.id === eqId)!;
  const ts = rawChillerTS[String(cs.n)].hourly; // default resolution — hourly for real variations
  const anom = rawChillerAnomalies[String(cs.n)];

  const kpis: ChillerKPIs = {
    deltaT: cs.deltaT,
    chilledWaterFlowRate: cs.cwFlow,
    condenserWaterFlowRate: cs.cdwFlow,
    coolingTons: cs.coolingTons,
    efficiency: cs.efficiency,
    powerDraw: cs.kW,
    chilledWaterSupplyTemp: cs.cwSupply,
    chilledWaterReturnTemp: cs.cwReturn,
    condenserWaterSupplyTemp: cs.cdwSupply,
    condenserWaterReturnTemp: cs.cdwReturn,
  };

  chillerDetails[eqId] = {
    equipment: equip,
    chillerKPIs: kpis,
    efficiencySeries: ts.efficiencySeries as TimeSeriesPoint[],
    temperatureLoopSeries: ts.temperatureLoopSeries as TemperatureLoopPoint[],
    powerCoolingSeries: ts.powerCoolingSeries as PowerCoolingPoint[],
    anomaly: {
      anomalyCount: anom.anomalyCount,
      inefficiencyCost: anom.inefficiencyCost,
      series: anom.series,
    },
  };
}

const towerDetails: Record<string, EquipmentDetail> = {};
for (const ts of raw.towerSnapshots) {
  const eqId = `${bid}-tower-${ts.n}`;
  const equip = towerEquipment.find((e) => e.id === eqId)!;
  const kpis: CoolingTowerKPIs = {
    condenserWaterSupplyTemp: ts.temp,
  };
  towerDetails[eqId] = {
    equipment: equip,
    coolingTowerKPIs: kpis,
    anomaly: { anomalyCount: 0, inefficiencyCost: 0, series: [] },
  };
}

const pumpDetails: Record<string, EquipmentDetail> = {
  [`${bid}-pump-1`]: {
    equipment: pumpEquipment[0],
    pumpKPIs: {
      powerDraw: raw.pumpSnapshot.kW,
      flowRate: (raw.pumpSnapshot as unknown as { flowRate: number }).flowRate ?? 0,
    } as PumpKPIs,
    anomaly: { anomalyCount: 0, inefficiencyCost: 0, series: [] },
  },
};

/** All equipment details indexed by equipment ID (default: hourly resolution) */
export const equipmentDetails: Record<string, EquipmentDetail> = {
  ...chillerDetails,
  ...towerDetails,
  ...pumpDetails,
};

// ═══════════════════════════════════════════════════════════════════
//  MULTI-RESOLUTION ACCESSORS (used by components with time toggle)
// ═══════════════════════════════════════════════════════════════════

export interface ChillerTimeSeriesBundle {
  efficiencySeries: TimeSeriesPoint[];
  temperatureLoopSeries: TemperatureLoopPoint[];
  powerCoolingSeries: PowerCoolingPoint[];
}

/**
 * Get chiller time-series data for a specific resolution.
 * @param chillerNum  1 | 2 | 3
 * @param resolution  TimeResolution
 */
export function getChillerTimeSeries(chillerNum: number, resolution: TimeResolution): ChillerTimeSeriesBundle {
  const ts = rawChillerTS[String(chillerNum)]?.[resolution];
  if (!ts) {
    return { efficiencySeries: [], temperatureLoopSeries: [], powerCoolingSeries: [] };
  }
  return {
    efficiencySeries: ts.efficiencySeries as TimeSeriesPoint[],
    temperatureLoopSeries: ts.temperatureLoopSeries as TemperatureLoopPoint[],
    powerCoolingSeries: ts.powerCoolingSeries as PowerCoolingPoint[],
  };
}

/**
 * Get chiller anomaly data for a specific resolution.
 */
export function getChillerAnomaly(chillerNum: number, resolution: TimeResolution): AnomalyData {
  const a = rawChillerAnomByRes[String(chillerNum)]?.[resolution];
  if (!a) return { anomalyCount: 0, inefficiencyCost: 0, series: [] };
  return {
    anomalyCount: a.anomalyCount,
    inefficiencyCost: a.inefficiencyCost,
    series: a.series as AnomalyPoint[],
  };
}

// ═══════════════════════════════════════════════════════════════════
//  COOLING TOWER & PUMP TIME SERIES (derived from chiller data)
// ═══════════════════════════════════════════════════════════════════

export interface TowerTempPoint {
  label: string;
  condenserSupply: number;
  condenserReturn: number;
  ambientTemp?: number;
}

/**
 * Get condenser water temperature time series for a cooling tower.
 * Derived from chiller 1 temperature loop series (towers serve all chillers).
 */
export function getTowerTempSeries(resolution: TimeResolution): TowerTempPoint[] {
  const ts = rawChillerTS['1']?.[resolution];
  if (!ts) return [];
  return ts.temperatureLoopSeries.map((p) => ({
    label: p.label,
    condenserSupply: (p as unknown as Record<string, number>).condenserSupply ?? 0,
    condenserReturn: (p as unknown as Record<string, number>).condenserReturn ?? 0,
    ambientTemp: (p as unknown as Record<string, number>).ambientTemp,
  }));
}

export interface PumpTimePoint {
  label: string;
  power: number;
  flowRate: number;
}

/**
 * Get pump flow rate and power time series.
 * Derived from chiller 1 power/cooling series (pump power ≈ fraction of total system).
 * Flow rate scaled from snapshot ratio.
 */
export function getPumpTimeSeries(resolution: TimeResolution): PumpTimePoint[] {
  const ts = rawChillerTS['1']?.[resolution];
  if (!ts) return [];
  // Use pump snapshot ratio to scale: pump kW / chiller kW at snapshot time
  const pumpKw = raw.pumpSnapshot.kW;
  const snapshotChillerKw = raw.chillerSnapshots[0]?.kW ?? 1;
  const pumpRatio = pumpKw / snapshotChillerKw;
  const pumpFlowSnapshot = (raw.pumpSnapshot as unknown as { flowRate: number }).flowRate ?? 0;

  return ts.powerCoolingSeries.map((p) => ({
    label: p.label,
    power: Math.round(p.power * pumpRatio * 100) / 100,
    flowRate: Math.round(pumpFlowSnapshot * (p.power / snapshotChillerKw) * 1000) / 1000,
  }));
}
