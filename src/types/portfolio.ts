// ── Time resolution ──────────────────────────────────────────────
export type TimeResolution = 'daily' | 'weekly' | 'monthly' | 'yearly';

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
