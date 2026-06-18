// Production Planner contract (layer3_production simulator output).
// Standalone from the energy portfolio — manufacturing is a different domain.
import type { DataMode } from './portfolio';

/** A self-describing number: how it was obtained drives how the UI labels it. */
export type ValueKind = 'measured' | 'calculated' | 'inferred' | 'assumed';
export interface Quantity {
  value: number;
  unit: string;
  kind: ValueKind;
  note?: string;
}

export interface ProductionMeta {
  facility: string;
  site: string;
  lineId: string;
  generatedAt: string;
  mode: DataMode;
  proxyStatus: string;
  note: string;
}

export interface SkuScenario {
  sku_id: string;
  name: string;
  line_id: string;
  measured: Record<string, Quantity | number>;
  baseline: Record<string, Quantity>;
  optimal: Record<string, Quantity>;
  delta_baseline_minus_optimal: Record<string, Quantity>;
  scrap_kg_bounds_p10_p50_p90: number[];
}

export interface LinePlanSide {
  name: string;
  line_id: string;
  feasible: boolean;
  runs_by_sku: Record<string, number>;
  batch_by_sku: Record<string, number>;
  production_hours: number;
  changeover_hours: number;
  total_hours: number;
  capacity_hours: number;
  energy_kwh: number;
  setup_cost_omr: number;
  holding_cost_omr: number;
  fixed_cost_omr: number;
  total_cost_omr: number;
  note: string;
}

export interface DesValidation {
  n_campaigns: number;
  makespan_h_p10_p50_p90: number[];
  scrap_kg_p10_p50_p90: number[];
  analytical_total_hours: number;
  median_utilization: number;
  mean_energy_kwh: number;
  reps: number;
  dependence: string;
}

export interface ProductionLine {
  baseline: LinePlanSide;
  optimal: LinePlanSide;
  saving_total_omr: number;
  saving_decision_omr: number;
  des_validation: DesValidation;
}

export interface ProductionData {
  meta: ProductionMeta;
  assumptions: Record<string, number>;
  skus: SkuScenario[];
  line: ProductionLine;
  savings: { totalOmr: number; decisionOmr: number };
  desValidation: DesValidation;
}
