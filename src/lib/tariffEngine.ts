/**
 * tariffEngine.ts
 *
 * Port of the Python CRT (Cost-Reflective Tariff) calculation engine
 * from calc/crt_calc_py.ipynb.
 *
 * Implements the Oman 2025 MIS tariff structure:
 *   - TOU (Time-of-Use) energy charges by season block and band
 *   - Capacity charges (coincident CPR+CGR, non-coincident NCPR)
 *   - Supply charge
 *   - VAT
 */

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

export type TOUBand = 'OP' | 'NP' | 'WDP' | 'WEDP';
export type SeasonBlock = 'Jan-Mar' | 'Apr' | 'May-Jul' | 'Aug-Sep' | 'Oct' | 'Nov-Dec';

export interface HourlyDataPoint {
  timestamp: string; // ISO or parseable date string
  kw: number;
  kwh: number;
}

export interface TOUBandValues {
  OP: number;
  NP: number;
  WDP: number;
  WEDP: number;
}

export interface MonthlyBill {
  month: string;
  kwhTotal: number;
  mwhTotal: number;
  kwhByBand: TOUBandValues;
  energyCostByBand: TOUBandValues;
  energyCostBstOmr: number;
  energyCostDvOmr: number;
  energyCostTuosOmr: number;
  touEnergyOmr: number;
  dcKw: number;
  dncKw: number;
  capacityCprOmr: number;
  capacityNcprOmr: number;
  capacityCgrOmr: number;
  capacityOmr: number;
  supplyOmr: number;
  subtotalOmr: number;
  vatOmr: number;
  totalBillOmr: number;
  voltageLevel: string;
  dvRoPerMwh: number;
  tuosEnergyAdderOmrPerMwh: number;
  includeCgr: boolean;
  dcMethod: string;
}

export interface TariffCalculationOptions {
  voltageLevel: '33kV' | '11kV' | '0.415kV';
  tuosEnergyAdderOmrPerMwh?: number;
  includeCgr?: boolean;
  dcMethod?: 'top3_peakbands' | 'top3_any';
}

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** BST MIS 2025 rates in RO per MWh, by season block and TOU band */
export const BST_MIS_2025_RO_PER_MWH: Record<SeasonBlock, Record<TOUBand, number>> = {
  'Jan-Mar': { OP: 12, NP: 12, WDP: 12, WEDP: 12 },
  'Apr':     { OP: 16, NP: 16, WDP: 16, WEDP: 16 },
  'May-Jul': { OP: 19, NP: 46, WDP: 36, WEDP: 28 },
  'Aug-Sep': { OP: 17, NP: 27, WDP: 20, WEDP: 20 },
  'Oct':     { OP: 16, NP: 16, WDP: 16, WEDP: 16 },
  'Nov-Dec': { OP: 12, NP: 12, WDP: 12, WEDP: 12 },
};

/** Distribution charge in bz per kWh (treated as RO/MWh adder) */
export const DIST_BZ_PER_KWH: Record<string, number> = {
  '33kV': 4.0,
  '11kV': 5.0,
  '0.415kV': 10.6,
};

/** Capacity charges in OMR per MW per year */
export const CAPACITY_OMR_PER_MW_YEAR: Record<string, number> = {
  CGR: 6775,
  CPR: 7691,
  NCPR: 1839,
};

export const SUPPLY_CHARGE_OMR_PER_YEAR = 50;
export const VAT_RATE = 0.05;

// ═══════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/** Map a month number (1-12) to its season block */
export function monthBlock(m: number): SeasonBlock {
  if (m >= 1 && m <= 3) return 'Jan-Mar';
  if (m === 4) return 'Apr';
  if (m >= 5 && m <= 7) return 'May-Jul';
  if (m >= 8 && m <= 9) return 'Aug-Sep';
  if (m === 10) return 'Oct';
  if (m >= 11 && m <= 12) return 'Nov-Dec';
  throw new Error(`Invalid month: ${m}`);
}

/** Determine the TOU band for a given timestamp.
 *  Oman weekend: Friday (5) and Saturday (6) in JS Date.getDay()
 */
export function touBand(ts: Date): TOUBand {
  const hm = ts.getHours() * 60 + ts.getMinutes();
  const dow = ts.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const isWeekend = dow === 5 || dow === 6; // Oman weekend: Fri, Sat

  // Night: 22:00 -> 02:59
  if (hm >= 22 * 60 || hm <= 2 * 60 + 59) {
    return 'NP';
  }

  // Midday peak: 13:00 -> 15:59
  if (hm >= 13 * 60 && hm <= 15 * 60 + 59) {
    return isWeekend ? 'WEDP' : 'WDP';
  }

  // Off-peak: 03:00–12:59 and 16:00–21:59
  return 'OP';
}

/** Distribution rate in RO/MWh for the given voltage level */
export function distRoPerMwh(voltageLevel: string): number {
  const v = DIST_BZ_PER_KWH[voltageLevel];
  if (v === undefined) {
    throw new Error(`voltage_level must be one of ${Object.keys(DIST_BZ_PER_KWH).join(', ')}`);
  }
  return v;
}

/** Convert OMR/MW/year to OMR/kW/month */
export function omrPerKwMonthFromOmrPerMwYear(xOmrPerMwYear: number): number {
  return xOmrPerMwYear / 12000.0;
}

/** Get BST rate for a given timestamp */
export function bstRate(ts: Date): number {
  const blk = monthBlock(ts.getMonth() + 1);
  const band = touBand(ts);
  return BST_MIS_2025_RO_PER_MWH[blk][band];
}

/** Get the month key from a Date (e.g. "2013-01") */
function getMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

/** Group hourly data by month */
function groupByMonth(data: Array<{ ts: Date; kw: number; kwh: number; band: TOUBand; bstRoPerMwh: number }>): Map<string, typeof data> {
  const groups = new Map<string, typeof data>();
  for (const d of data) {
    const key = getMonthKey(d.ts);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  return groups;
}

/** Compute coincident peak proxy: mean of top N kW values within peak bands */
function computeDcKw(
  rows: Array<{ kw: number; band: TOUBand }>,
  method: string,
  topN: number = 3,
): number {
  if (method === 'top3_peakbands') {
    const peakRows = rows.filter(r => r.band === 'WDP' || r.band === 'WEDP');
    const kwValues = peakRows.map(r => r.kw).filter(v => v > 0);
    if (kwValues.length > 0) {
      kwValues.sort((a, b) => b - a);
      const top = kwValues.slice(0, topN);
      return top.reduce((s, v) => s + v, 0) / top.length;
    }
  }
  // fallback: top N any hour
  const allKw = rows.map(r => r.kw).filter(v => v > 0);
  if (allKw.length === 0) return 0;
  allKw.sort((a, b) => b - a);
  const top = allKw.slice(0, topN);
  return top.reduce((s, v) => s + v, 0) / top.length;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN CALCULATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate monthly detailed CRT bills from hourly data.
 * Port of Python's `monthly_detailed_crt_bill()`.
 */
export function calculateMonthlyDetailedBills(
  hourlyData: HourlyDataPoint[],
  options: TariffCalculationOptions,
): MonthlyBill[] {
  const {
    voltageLevel,
    tuosEnergyAdderOmrPerMwh = 0.0,
    includeCgr = true,
    dcMethod = 'top3_peakbands',
  } = options;

  const dvRoPerMwh = distRoPerMwh(voltageLevel);

  // Capacity rates (OMR/kW-month)
  const cprKwMonth = omrPerKwMonthFromOmrPerMwYear(CAPACITY_OMR_PER_MW_YEAR.CPR);
  const ncprKwMonth = omrPerKwMonthFromOmrPerMwYear(CAPACITY_OMR_PER_MW_YEAR.NCPR);
  const cgrKwMonth = omrPerKwMonthFromOmrPerMwYear(CAPACITY_OMR_PER_MW_YEAR.CGR);

  // Preprocess: parse timestamps, compute TOU band & BST rate
  const enriched = hourlyData.map(d => {
    const ts = new Date(d.timestamp);
    const band = touBand(ts);
    const blk = monthBlock(ts.getMonth() + 1);
    const bstRo = BST_MIS_2025_RO_PER_MWH[blk][band];
    return {
      ts,
      kw: d.kw,
      kwh: d.kwh,
      band,
      bstRoPerMwh: bstRo,
    };
  });

  // Group by month
  const monthGroups = groupByMonth(enriched);

  const bills: MonthlyBill[] = [];

  for (const [month, rows] of monthGroups) {
    // kWh by band
    const kwhByBand: TOUBandValues = { OP: 0, NP: 0, WDP: 0, WEDP: 0 };
    // Energy cost by component
    let costBst = 0;
    let costDv = 0;
    let costTuos = 0;
    // Energy cost by band (total)
    const energyCostByBand: TOUBandValues = { OP: 0, NP: 0, WDP: 0, WEDP: 0 };

    let kwhTotal = 0;

    for (const r of rows) {
      const mwh = r.kwh / 1000.0;
      kwhByBand[r.band] += r.kwh;
      kwhTotal += r.kwh;

      const bstCost = mwh * r.bstRoPerMwh;
      const dvCost = mwh * dvRoPerMwh;
      const tuosCost = mwh * tuosEnergyAdderOmrPerMwh;
      const totalEnergyCost = bstCost + dvCost + tuosCost;

      costBst += bstCost;
      costDv += dvCost;
      costTuos += tuosCost;
      energyCostByBand[r.band] += totalEnergyCost;
    }

    const touEnergyOmr = costBst + costDv + costTuos;
    const mwhTotal = kwhTotal / 1000.0;

    // Peaks
    const allKw = rows.map(r => r.kw).filter(v => !isNaN(v));
    const dncKw = allKw.length > 0 ? Math.max(...allKw) : 0;
    const dcKw = computeDcKw(rows, dcMethod);

    // Capacity charges
    const capacityCpr = dcKw * cprKwMonth;
    const capacityNcpr = dncKw * ncprKwMonth;
    const capacityCgr = includeCgr ? dcKw * cgrKwMonth : 0;
    const capacityTotal = capacityCpr + capacityNcpr + capacityCgr;

    // Supply
    const supplyOmr = SUPPLY_CHARGE_OMR_PER_YEAR / 12.0;

    // Totals
    const subtotalOmr = touEnergyOmr + capacityTotal + supplyOmr;
    const vatOmr = subtotalOmr * VAT_RATE;
    const totalBillOmr = subtotalOmr + vatOmr;

    bills.push({
      month,
      kwhTotal,
      mwhTotal,
      kwhByBand,
      energyCostByBand,
      energyCostBstOmr: costBst,
      energyCostDvOmr: costDv,
      energyCostTuosOmr: costTuos,
      touEnergyOmr,
      dcKw,
      dncKw,
      capacityCprOmr: capacityCpr,
      capacityNcprOmr: capacityNcpr,
      capacityCgrOmr: capacityCgr,
      capacityOmr: capacityTotal,
      supplyOmr,
      subtotalOmr,
      vatOmr,
      totalBillOmr,
      voltageLevel,
      dvRoPerMwh,
      tuosEnergyAdderOmrPerMwh,
      includeCgr,
      dcMethod,
    });
  }

  // Sort by month
  bills.sort((a, b) => a.month.localeCompare(b.month));
  return bills;
}

/**
 * Compute the effective OMR/kWh rate for a given timestamp.
 * Useful for hourly cost charts.
 */
export function effectiveRateOmrPerKwh(ts: Date, voltageLevel: string, tuosAdder: number = 0): number {
  const blk = monthBlock(ts.getMonth() + 1);
  const band = touBand(ts);
  const bst = BST_MIS_2025_RO_PER_MWH[blk][band];
  const dv = distRoPerMwh(voltageLevel);
  // Rate is in RO/MWh, convert to OMR/kWh (divide by 1000)
  return (bst + dv + tuosAdder) / 1000.0;
}

/**
 * Aggregate hourly tariff data to different resolutions.
 */
export interface AggregatedTariffPoint {
  label: string;
  kwh: number;
  omr: number;
}

export function aggregateToDaily(hourlyData: HourlyDataPoint[], voltageLevel: string): AggregatedTariffPoint[] {
  const dayMap = new Map<string, { kwh: number; omr: number }>();
  for (const d of hourlyData) {
    const ts = new Date(d.timestamp);
    const key = d.timestamp.substring(0, 10); // "YYYY-MM-DD"
    if (!dayMap.has(key)) dayMap.set(key, { kwh: 0, omr: 0 });
    const entry = dayMap.get(key)!;
    entry.kwh += d.kwh;
    entry.omr += d.kwh * effectiveRateOmrPerKwh(ts, voltageLevel);
  }
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, kwh: Math.round(v.kwh * 100) / 100, omr: Math.round(v.omr * 100) / 100 }));
}

export function aggregateToWeekly(hourlyData: HourlyDataPoint[], voltageLevel: string): AggregatedTariffPoint[] {
  const weekMap = new Map<string, { kwh: number; omr: number }>();
  for (const d of hourlyData) {
    const ts = new Date(d.timestamp);
    // ISO week: get the Monday of the week
    const day = ts.getDay();
    const diff = ts.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(ts);
    monday.setDate(diff);
    const key = `${monday.getFullYear()}-${(monday.getMonth() + 1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}`;
    if (!weekMap.has(key)) weekMap.set(key, { kwh: 0, omr: 0 });
    const entry = weekMap.get(key)!;
    entry.kwh += d.kwh;
    entry.omr += d.kwh * effectiveRateOmrPerKwh(ts, voltageLevel);
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label: `W ${label}`, kwh: Math.round(v.kwh * 100) / 100, omr: Math.round(v.omr * 100) / 100 }));
}

export function aggregateToMonthly(hourlyData: HourlyDataPoint[], voltageLevel: string): AggregatedTariffPoint[] {
  const monthMap = new Map<string, { kwh: number; omr: number }>();
  for (const d of hourlyData) {
    const ts = new Date(d.timestamp);
    const key = getMonthKey(ts);
    if (!monthMap.has(key)) monthMap.set(key, { kwh: 0, omr: 0 });
    const entry = monthMap.get(key)!;
    entry.kwh += d.kwh;
    entry.omr += d.kwh * effectiveRateOmrPerKwh(ts, voltageLevel);
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, kwh: Math.round(v.kwh * 100) / 100, omr: Math.round(v.omr * 100) / 100 }));
}

export function aggregateToYearly(hourlyData: HourlyDataPoint[], voltageLevel: string): AggregatedTariffPoint[] {
  const yearMap = new Map<string, { kwh: number; omr: number }>();
  for (const d of hourlyData) {
    const ts = new Date(d.timestamp);
    const key = ts.getFullYear().toString();
    if (!yearMap.has(key)) yearMap.set(key, { kwh: 0, omr: 0 });
    const entry = yearMap.get(key)!;
    entry.kwh += d.kwh;
    entry.omr += d.kwh * effectiveRateOmrPerKwh(ts, voltageLevel);
  }
  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label, kwh: Math.round(v.kwh * 100) / 100, omr: Math.round(v.omr * 100) / 100 }));
}

export function aggregateToHourly(hourlyData: HourlyDataPoint[], voltageLevel: string): AggregatedTariffPoint[] {
  // For hourly, just return a sampled subset (last 168 hours = 1 week) to avoid chart overload
  const lastWeek = hourlyData.slice(-168);
  return lastWeek.map(d => {
    const ts = new Date(d.timestamp);
    return {
      label: d.timestamp.substring(5, 16).replace('T', ' '),
      kwh: Math.round(d.kwh * 100) / 100,
      omr: Math.round(d.kwh * effectiveRateOmrPerKwh(ts, voltageLevel) * 100) / 100,
    };
  });
}
