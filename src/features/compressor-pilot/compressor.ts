// Compressor pilot-preview contract (block5_gas_compressor synthetic output).
// Standalone from the cooling-plant model — a gas station is a different domain/site.
import type { DataMode } from '@/types/portfolio';

export interface CompressorMeta {
  facility: string;
  compressorTag: string;
  site: string;
  asOf: string;
  coverageStart: string;
  generatedAt: string;
  mode: DataMode;
  proxyStatus: string;
  note: string;
}

export interface CompressorKPIs {
  etaPoly: number | null;
  etaIsen: number | null;
  specificPowerKwPerNm3hr: number | null;
  compressionRatio: number | null;
  designPolyEff: number | null;
  ratedKw: number | null;
}

export interface CompressorSeriesPoint {
  label: string;
  etaPoly: number | null;
  specificPower: number | null;
  compressionRatio: number | null;
  actualKw: number | null;
  expectedKw: number | null;
  suctionP: number | null;
  suctionT: number | null;
  dischargeP: number | null;
  dischargeT: number | null;
  gasFlow: number | null;
}

export interface CompressorLatest {
  timestamp: string;
  etaPoly: number;
  actualKw: number;
  expectedKw: number | null;
  compressionRatio: number;
}

export interface CompressorFinding {
  ruleId: string;
  label: string;
  severity: string;
  triggeredHours: number;
  evaluatedHours: number;
  omrImpact: number;
  description: string;
}

export interface CompressorReinforcing {
  modelVersion: string;
  contextKey: string;
  nRecorded: number;
  nReconciled: number;
  coveragePct: number;
  mape: number | null;
}

export interface CompressorCounts {
  diagnosticReadings: number;
  badReadings: number;
  pathUsed: Record<string, number>;
  blockedClaims: number;
}

export interface CompressorData {
  meta: CompressorMeta;
  kpis: CompressorKPIs;
  series: CompressorSeriesPoint[];
  latest: CompressorLatest | null;
  findings: CompressorFinding[];
  totalOmrImpactPerWindow: number;
  counts: CompressorCounts;
  reinforcing: CompressorReinforcing | null;
}
