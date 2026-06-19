import raw from './generated/energyKpi.json';

// Measured energy-intensity KPI, line × month. Factory electricity bills (all site
// loads) ÷ MC01 production kg. Absolute level overstates the extruder (not yet
// sub-metered); the TREND, the best-month benchmark, and the utilization driver are
// the signal. Per-product/per-machine kWh/kg needs sub-metering (data request).
export interface EnergyMonth { ym: string; productionKg: number; kwh: number; kwhPerKg: number; }
export interface EnergyKpi {
  meta: { source: string; scope: string; driver: string; unit: string };
  months: EnergyMonth[];
  summary: {
    latestYm: string; latestKwhPerKg: number;
    bestYm: string; bestKwhPerKg: number;
    worstYm: string; worstKwhPerKg: number;
    medianKwhPerKg: number;
  };
}

export const energyKpi = raw as unknown as EnergyKpi;
