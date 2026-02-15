#!/usr/bin/env node
/**
 * preprocess-csv.mjs
 * Reads the 4 hourly CSV files and produces compact JSON consumed by the dashboard.
 *
 * Run:  node scripts/preprocess-csv.mjs
 *
 * Output: src/data/generated/realData.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUT_FILE = join(DATA_DIR, 'generated', 'realData.json');

// ────────────────────────────────────────────────────────────
// 1. Parse CSVs
// ────────────────────────────────────────────────────────────
const CSV_FILES = readdirSync(DATA_DIR)
  .filter(f => f.startsWith('hourly_data_') && f.endsWith('.csv'))
  .sort();

console.log(`Found ${CSV_FILES.length} CSV files: ${CSV_FILES.join(', ')}`);

/** Parse a single CSV into an array of objects (numbers). */
function parseCSV(filename) {
  const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      if (j === 0) {
        obj[headers[j]] = vals[j]; // timestamp as string
      } else {
        obj[headers[j]] = parseFloat(vals[j]) || 0;
      }
    }
    rows.push(obj);
  }
  return rows;
}

let allRows = [];
for (const f of CSV_FILES) {
  const rows = parseCSV(f);
  console.log(`  ${f}: ${rows.length} rows`);
  allRows = allRows.concat(rows);
}

// Sort by timestamp
allRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

console.log(`Total rows: ${allRows.length}`);

// Keep ALL rows including system-off hours (important for understanding duty cycles)
console.log(`Using all ${allRows.length} rows (including system OFF hours)`);

// ────────────────────────────────────────────────────────────
// 2. Helpers
// ────────────────────────────────────────────────────────────
function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function round(v, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

function getMonth(ts) {
  return ts.substring(0, 7); // "YYYY-MM"
}

function getDate(ts) {
  return ts.substring(0, 10); // "YYYY-MM-DD"
}

function getYear(ts) {
  return ts.substring(0, 4); // "YYYY"
}

function getWeek(ts) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start;
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return `${d.getFullYear()}-W${String(Math.ceil(diff / oneWeek)).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────
// 2b. Group rows by all resolutions
// ────────────────────────────────────────────────────────────
const hourlyMap = new Map();
const dailyMap = new Map();
const weeklyMap = new Map();
const monthlyMap = new Map();
const yearlyMap = new Map();

for (const r of allRows) {
  const h = r.timestamp; // each row IS one hour, keyed by full timestamp
  const d = getDate(r.timestamp);
  const w = getWeek(r.timestamp);
  const m = getMonth(r.timestamp);
  const y = getYear(r.timestamp);

  // Hourly: each row is its own bucket (keyed by timestamp)
  hourlyMap.set(h, [r]);

  if (!dailyMap.has(d)) dailyMap.set(d, []);
  dailyMap.get(d).push(r);

  if (!weeklyMap.has(w)) weeklyMap.set(w, []);
  weeklyMap.get(w).push(r);

  if (!monthlyMap.has(m)) monthlyMap.set(m, []);
  monthlyMap.get(m).push(r);

  if (!yearlyMap.has(y)) yearlyMap.set(y, []);
  yearlyMap.get(y).push(r);
}

const sortedHours = [...hourlyMap.keys()].sort();
const sortedDays = [...dailyMap.keys()].sort();
const sortedWeeks = [...weeklyMap.keys()].sort();
const sortedMonths = [...monthlyMap.keys()].sort();
const sortedYears = [...yearlyMap.keys()].sort();

const resolutionMaps = {
  hourly:  { map: hourlyMap,  keys: sortedHours },
  daily:   { map: dailyMap,   keys: sortedDays },
  weekly:  { map: weeklyMap,  keys: sortedWeeks },
  monthly: { map: monthlyMap, keys: sortedMonths },
  yearly:  { map: yearlyMap,  keys: sortedYears },
};

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a bucket key into a human-readable label */
function formatLabel(key, resolution) {
  switch (resolution) {
    case 'hourly': {
      // key = "2014-04-09 14:00:00" → "Apr 9 14:00"
      const dt = new Date(key);
      return `${monthShortNames[dt.getMonth()]} ${dt.getDate()} ${key.substring(11, 16)}`;
    }
    case 'daily':   return key; // "2012-03-15"
    case 'weekly':  return key; // "2012-W12"
    case 'monthly': {
      const [y, m] = key.split('-');
      return `${monthShortNames[parseInt(m, 10) - 1]} ${y}`;
    }
    case 'yearly':  return key; // "2012"
    default: return key;
  }
}

// ────────────────────────────────────────────────────────────
// 3. Latest snapshot (from most recent rows)
// ────────────────────────────────────────────────────────────
const latestRows = allRows.slice(-24);

function chillerSnapshot(n) {
  const prefix = `CP_Chiller${n}_`;
  const recent = latestRows.filter(r => r[`${prefix}kW`] > 0);
  if (recent.length === 0) {
    return { status: 'off', kW: 0, efficiency: 0, coolingTons: 0, cwFlow: 0, cdwFlow: 0, cwSupply: 0, cwReturn: 0, cdwSupply: 0, cdwReturn: 0, deltaT: 0 };
  }
  const kW = round(avg(recent.map(r => r[`${prefix}kW`])));
  const eff = round(avg(recent.map(r => r[`${prefix}Efficiency`])), 3);
  const tons = round(avg(recent.map(r => r[`${prefix}CoolingTons`])));
  const cwFlow = round(avg(recent.map(r => r[`${prefix}ChilledWaterFlowrate`])));
  const cdwFlow = round(avg(recent.map(r => r[`${prefix}CondenserWaterFlowrate`])));
  const cwSupply = round(avg(recent.map(r => r[`${prefix}ChilledWaterSupplyTemp`])), 1);
  const cwReturn = round(avg(recent.map(r => r[`${prefix}ChilledWaterReturnTemp`])), 1);
  const cdwSupply = round(avg(recent.map(r => r[`${prefix}CondenserWaterSupplyTemp`])), 1);
  const cdwReturn = round(avg(recent.map(r => r[`${prefix}CondenserWaterReturnTemp`])), 1);
  const deltaT = round(cwReturn - cwSupply, 1);
  const status = eff > 0.7 ? 'warning' : kW > 0 ? 'running' : 'off';
  return { status, kW, efficiency: eff, coolingTons: tons, cwFlow, cdwFlow, cwSupply, cwReturn, cdwSupply, cdwReturn, deltaT };
}

function towerSnapshot(n) {
  const col = `CP_CoolingTower${n}_CondenserWaterSupplyTemp`;
  const recent = latestRows.filter(r => r[col] > 0);
  if (recent.length === 0) return { status: 'off', temp: 0 };
  const temp = round(avg(recent.map(r => r[col])), 1);
  const status = temp > 35 ? 'warning' : 'running';
  return { status, temp };
}

function pumpSnapshot() {
  const recent = latestRows.filter(r => r.CP_TotalChilledWaterPump_kW > 0);
  if (recent.length === 0) return { status: 'off', kW: 0, flowRate: 0 };
  const kW = round(avg(recent.map(r => r.CP_TotalChilledWaterPump_kW)));
  // Total flow = sum of all chiller chilled water flow rates, converted from L/s to m³/s (÷1000)
  const flowRate = round(avg(recent.map(r =>
    (r.CP_Chiller1_ChilledWaterFlowrate + r.CP_Chiller2_ChilledWaterFlowrate + r.CP_Chiller3_ChilledWaterFlowrate) / 1000
  )), 3);
  return { status: 'running', kW, flowRate };
}

const chillerSnapshots = [1, 2, 3].map(n => ({ n, ...chillerSnapshot(n) }));
const towerSnapshots = [];
for (let n = 1; n <= 9; n++) towerSnapshots.push({ n, ...towerSnapshot(n) });
const pumpSnap = pumpSnapshot();

// System aggregate KPIs
const systemDeltaT = round(
  avg(latestRows.filter(r => r.Avg_ChilledWaterReturnTemp > 0).map(r => r.Avg_ChilledWaterReturnTemp - r.Avg_ChilledWaterSupplyTemp)),
  1
);
const totalFlowRate = round(
  avg(latestRows.map(r =>
    r.CP_Chiller1_ChilledWaterFlowrate + r.CP_Chiller2_ChilledWaterFlowrate + r.CP_Chiller3_ChilledWaterFlowrate
  ))
);
const systemKwPerTon = round(
  avg(latestRows.filter(r => r.System_Efficiency_kW_per_Ton > 0 && r.System_Efficiency_kW_per_Ton < 5).map(r => r.System_Efficiency_kW_per_Ton)),
  3
);

// Today's production/consumption
// "Consumption" = electrical energy consumed by chillers + pumps (the bigger number)
// "Production"  = cooling output converted to kWh-equivalent (informational)
const latestDate = getDate(latestRows[latestRows.length - 1].timestamp);
const todayRows = allRows.filter(r => getDate(r.timestamp) === latestDate);
const todayTotalKw = todayRows.reduce((s, r) => s + r.Total_Chiller_kW + r.CP_TotalChilledWaterPump_kW, 0);
const todayConsumptionKwh = round(todayTotalKw);
const todayCoolingTons = round(todayRows.reduce((s, r) => s + r.Total_CoolingTons, 0));
const todayCoolingKwh = round(todayCoolingTons * 3.517, 0);

// Hourly production/consumption for latest day (dashboard chart)
const hourlyProductionConsumption = todayRows.map(r => {
  const hour = r.timestamp.substring(11, 16); // "HH:MM"
  const consumption = round(r.Total_Chiller_kW + r.CP_TotalChilledWaterPump_kW);
  const production = round(r.Total_CoolingTons * 3.517);
  return { hour, production, consumption };
});

// ────────────────────────────────────────────────────────────
// 4. Multi-resolution month comparisons (performance vs sector)
// ────────────────────────────────────────────────────────────
function makeComparisonSeries(resolution) {
  const { map, keys } = resolutionMaps[resolution];

  return keys.map(key => {
    const rows = map.get(key);
    const totalKw = rows.reduce((s, r) => s + r.Total_Chiller_kW + r.CP_TotalChilledWaterPump_kW, 0);
    const avgKwh = round(totalKw / rows.length);
    const avgTons = avg(rows.map(r => r.Total_CoolingTons));
    const sectorKwh = round(avgTons * 0.55);
    const portfolioValue = round(avgKwh);
    const sectorValue = round(sectorKwh);

    let status;
    if (portfolioValue < sectorValue * 0.95) status = 'Exceeded';
    else if (portfolioValue > sectorValue * 1.05) status = 'Lower';
    else status = 'Average';

    return {
      month: formatLabel(key, resolution),
      status,
      portfolioValue,
      sectorValue,
    };
  });
}

// Determine latest year for daily/weekly filtering
const latestYear = sortedYears[sortedYears.length - 1];

// Determine the latest 7-day window for hourly data
const HOURLY_WINDOW_DAYS = 7;
const latestTimestamp = sortedHours[sortedHours.length - 1];
const latestDt = new Date(latestTimestamp);
const hourlyWindowStart = new Date(latestDt.getTime() - HOURLY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
const hourlyWindowStartStr = hourlyWindowStart.toISOString().substring(0, 10); // "YYYY-MM-DD"

// Keep hourly to latest 7 days, daily/weekly to latest year only; monthly/yearly show all
const hourlyComparisons = makeComparisonSeries('hourly');
const allComparisons = {
  hourly:  hourlyComparisons.slice(-HOURLY_WINDOW_DAYS * 24),
  daily:   makeComparisonSeries('daily').filter(c => c.month.startsWith(latestYear)),
  weekly:  makeComparisonSeries('weekly').filter(c => c.month.startsWith(latestYear)),
  monthly: makeComparisonSeries('monthly'),
  yearly:  makeComparisonSeries('yearly'),
};

// The default "monthComparisons" = monthly, last 12
const monthComparisons = allComparisons.monthly.slice(-12);

// ────────────────────────────────────────────────────────────
// 5. Consumption breakdown (% of total kW by system)
// ────────────────────────────────────────────────────────────
let totalChillerKw = 0;
let totalPumpKw = 0;
for (const r of allRows) {
  totalChillerKw += r.Total_Chiller_kW;
  totalPumpKw += r.CP_TotalChilledWaterPump_kW;
}
const totalSystemKw = totalChillerKw + totalPumpKw;

let ch1Kw = 0, ch2Kw = 0, ch3Kw = 0;
for (const r of allRows) {
  ch1Kw += r.CP_Chiller1_kW;
  ch2Kw += r.CP_Chiller2_kW;
  ch3Kw += r.CP_Chiller3_kW;
}

const consumptionBreakdown = [
  { name: 'Chiller 1', value: round((ch1Kw / totalSystemKw) * 100, 0), color: '#38bdf8' },
  { name: 'Chiller 2', value: round((ch2Kw / totalSystemKw) * 100, 0), color: '#818cf8' },
  { name: 'Chiller 3', value: round((ch3Kw / totalSystemKw) * 100, 0), color: '#f472b6' },
  { name: 'Pumps',     value: round((totalPumpKw / totalSystemKw) * 100, 0), color: '#34d399' },
];
const assigned = consumptionBreakdown.reduce((s, e) => s + e.value, 0);
if (assigned < 100) {
  consumptionBreakdown.push({ name: 'Other', value: 100 - assigned, color: '#94a3b8' });
}

// ────────────────────────────────────────────────────────────
// 6. Multi-resolution chiller time-series
// ────────────────────────────────────────────────────────────
function makeChillerTimeSeriesForResolution(n, resolution) {
  const prefix = `CP_Chiller${n}_`;
  const { map, keys } = resolutionMaps[resolution];

  // Include every bucket; use 0 when off/no reading so off/broken times are visible
  const efficiencySeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}Efficiency`] > 0 && r[`${prefix}Efficiency`] < 5);
    return {
      label: formatLabel(key, resolution),
      value: rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}Efficiency`])), 3) : 0,
    };
  });

  const temperatureLoopSeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}ChilledWaterSupplyTemp`] > 0);
    if (rows.length === 0) {
      return { label: formatLabel(key, resolution), chilledSupply: 0, chilledReturn: 0, condenserSupply: 0, condenserReturn: 0, ambientTemp: 0 };
    }
    const cdwSupply = avg(rows.map(r => r[`${prefix}CondenserWaterSupplyTemp`]));
    const cdwReturn = avg(rows.map(r => r[`${prefix}CondenserWaterReturnTemp`]));
    return {
      label: formatLabel(key, resolution),
      chilledSupply:   round(avg(rows.map(r => r[`${prefix}ChilledWaterSupplyTemp`])), 1),
      chilledReturn:   round(avg(rows.map(r => r[`${prefix}ChilledWaterReturnTemp`])), 1),
      condenserSupply: round(cdwSupply, 1),
      condenserReturn: round(cdwReturn, 1),
      ambientTemp:     round((cdwSupply + cdwReturn) / 2, 1),
    };
  });

  const powerCoolingSeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}kW`] > 0);
    return {
      label: formatLabel(key, resolution),
      power:       rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}kW`]))) : 0,
      coolingTons: rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}CoolingTons`]))) : 0,
    };
  });

  return { efficiencySeries, temperatureLoopSeries, powerCoolingSeries };
}

function makeChillerAllResolutions(n) {
  const result = {};
  for (const res of ['hourly', 'daily', 'weekly', 'monthly', 'yearly']) {
    const ts = makeChillerTimeSeriesForResolution(n, res);
    // For hourly, only keep latest 7 days
    if (res === 'hourly') {
      const filterWindow = (arr) => arr.filter(p => {
        // label = "Apr 9 14:00" — need to match against original keys
        // Instead, filter by index: hourly keys are sorted timestamps
        return true; // will be filtered below by key
      });
      // Re-build hourly with only the latest 7 days of keys
      const hourlyKeys7d = sortedHours.filter(k => k >= hourlyWindowStartStr);
      const ts7d = makeChillerTimeSeriesFromKeys(n, 'hourly', hourlyKeys7d);
      result[res] = ts7d;
      continue;
    }
    // For daily/weekly, only keep latest year
    if (res === 'daily' || res === 'weekly') {
      const filterLatest = (arr) => arr.filter(p => p.label.startsWith(latestYear));
      ts.efficiencySeries = filterLatest(ts.efficiencySeries);
      ts.temperatureLoopSeries = filterLatest(ts.temperatureLoopSeries);
      ts.powerCoolingSeries = filterLatest(ts.powerCoolingSeries);
    }
    result[res] = ts;
  }
  return result;
}

/** Build chiller time-series from a specific subset of keys (used for hourly 7-day window) */
function makeChillerTimeSeriesFromKeys(n, resolution, keys) {
  const prefix = `CP_Chiller${n}_`;
  const { map } = resolutionMaps[resolution];

  // Include every bucket; use 0 when off/no reading so off/broken times are visible
  const efficiencySeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}Efficiency`] > 0 && r[`${prefix}Efficiency`] < 5);
    return {
      label: formatLabel(key, resolution),
      value: rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}Efficiency`])), 3) : 0,
    };
  });

  const temperatureLoopSeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}ChilledWaterSupplyTemp`] > 0);
    if (rows.length === 0) {
      return { label: formatLabel(key, resolution), chilledSupply: 0, chilledReturn: 0, condenserSupply: 0, condenserReturn: 0, ambientTemp: 0 };
    }
    const cdwSupply = avg(rows.map(r => r[`${prefix}CondenserWaterSupplyTemp`]));
    const cdwReturn = avg(rows.map(r => r[`${prefix}CondenserWaterReturnTemp`]));
    return {
      label: formatLabel(key, resolution),
      chilledSupply:   round(avg(rows.map(r => r[`${prefix}ChilledWaterSupplyTemp`])), 1),
      chilledReturn:   round(avg(rows.map(r => r[`${prefix}ChilledWaterReturnTemp`])), 1),
      condenserSupply: round(cdwSupply, 1),
      condenserReturn: round(cdwReturn, 1),
      ambientTemp:     round((cdwSupply + cdwReturn) / 2, 1),
    };
  });

  const powerCoolingSeries = keys.map(key => {
    const rows = map.get(key).filter(r => r[`${prefix}kW`] > 0);
    return {
      label: formatLabel(key, resolution),
      power:       rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}kW`]))) : 0,
      coolingTons: rows.length > 0 ? round(avg(rows.map(r => r[`${prefix}CoolingTons`]))) : 0,
    };
  });

  return { efficiencySeries, temperatureLoopSeries, powerCoolingSeries };
}

// ────────────────────────────────────────────────────────────
// 7. Multi-resolution anomaly detection
// ────────────────────────────────────────────────────────────
/**
 * Anomaly detection with resolution-aware thresholds.
 *
 * @param efficiencyValues - Array of { label, value } (kW/ton)
 * @param resolution       - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param avgCoolingTons   - Average cooling tons per bucket (used for cost calc)
 *
 * Threshold logic:
 *   - Daily data is noisy, so a larger threshold prevents false positives.
 *   - Weekly/monthly/yearly are pre-averaged, so a smaller threshold is fine.
 *
 * Cost calculation:
 *   excessKw = (actual - baseline) × avgCoolingTons
 *   cost     = excessKw × hours-per-bucket × OMR-per-kWh (0.012)
 */
const ANOMALY_THRESHOLDS = { hourly: 0.15, daily: 0.10, weekly: 0.06, monthly: 0.05, yearly: 0.04 };
const HOURS_PER_BUCKET   = { hourly: 1,   daily: 24,   weekly: 168,  monthly: 730,  yearly: 8760 };
const OMR_PER_KWH = 0.012;

function computeAnomalyData(efficiencyValues, resolution = 'weekly', avgCoolingTons = 200) {
  if (efficiencyValues.length < 5) {
    return { anomalyCount: 0, inefficiencyCost: 0, series: [] };
  }

  const threshold = ANOMALY_THRESHOLDS[resolution] ?? 0.06;
  const hoursPerBucket = HOURS_PER_BUCKET[resolution] ?? 168;
  const windowSize = Math.max(3, Math.min(8, Math.floor(efficiencyValues.length * 0.15)));
  const series = [];
  let anomalyCount = 0;
  let totalCostOmr = 0;

  for (let i = 0; i < efficiencyValues.length; i++) {
    const start = Math.max(0, i - windowSize);
    const windowSlice = efficiencyValues.slice(start, i);
    // Use preceding window only (not including current point) for a cleaner baseline
    const baseline = windowSlice.length > 0
      ? round(avg(windowSlice.map(v => v.value)), 3)
      : round(efficiencyValues[i].value, 3);
    const actual = efficiencyValues[i].value;
    const diff = actual - baseline;

    if (diff > threshold) {
      anomalyCount++;
      // Excess kW = (delta kW/ton) × tons × hours → kWh; cost = kWh × tariff
      const excessKwh = diff * avgCoolingTons * hoursPerBucket;
      totalCostOmr += excessKwh * OMR_PER_KWH;
    }

    series.push({
      label: efficiencyValues[i].label,
      baseline,
      actual: round(actual, 3),
    });
  }

  return {
    anomalyCount,
    inefficiencyCost: round(totalCostOmr, 1),
    series,
  };
}

// Compute average system cooling tons for cost estimates (only hours with actual cooling)
const avgSystemCoolingTons = avg(allRows.filter(r => r.Total_CoolingTons > 0).map(r => r.Total_CoolingTons));

function makeSystemAnomalyForResolution(resolution) {
  const { map } = resolutionMaps[resolution];
  // For hourly, only use latest 7 days of keys
  const keys = resolution === 'hourly'
    ? sortedHours.filter(k => k >= hourlyWindowStartStr)
    : resolutionMaps[resolution].keys;

  const efficiencyValues = keys.map(key => {
    const rows = map.get(key).filter(r => r.System_Efficiency_kW_per_Ton > 0 && r.System_Efficiency_kW_per_Ton < 5);
    return {
      label: formatLabel(key, resolution),
      value: rows.length > 0 ? round(avg(rows.map(r => r.System_Efficiency_kW_per_Ton)), 3) : null,
    };
  }).filter(p => p.value !== null);

  const result = computeAnomalyData(efficiencyValues, resolution, avgSystemCoolingTons);
  // For daily/weekly, only keep latest year
  if (resolution === 'daily' || resolution === 'weekly') {
    result.series = result.series.filter(p => p.label.startsWith(latestYear));
    // Recount anomalies after filtering to latest year
    result.anomalyCount = result.series.filter((_, idx) => {
      const s = result.series[idx];
      return s.actual - s.baseline > (ANOMALY_THRESHOLDS[resolution] ?? 0.06);
    }).length;
  }
  return result;
}

function makeChillerAnomalyForResolution(n, resolution) {
  const prefix = `CP_Chiller${n}_`;
  const avgChillerTons = avg(allRows.filter(r => r[`${prefix}CoolingTons`] > 0).map(r => r[`${prefix}CoolingTons`]));
  // For hourly, use the 7-day windowed keys
  let ts;
  if (resolution === 'hourly') {
    const hourlyKeys7d = sortedHours.filter(k => k >= hourlyWindowStartStr);
    ts = makeChillerTimeSeriesFromKeys(n, resolution, hourlyKeys7d);
  } else {
    ts = makeChillerTimeSeriesForResolution(n, resolution);
  }
  const result = computeAnomalyData(ts.efficiencySeries, resolution, avgChillerTons);
  if (resolution === 'daily' || resolution === 'weekly') {
    result.series = result.series.filter(p => p.label.startsWith(latestYear));
    result.anomalyCount = result.series.filter((_, idx) => {
      const s = result.series[idx];
      return s.actual - s.baseline > (ANOMALY_THRESHOLDS[resolution] ?? 0.06);
    }).length;
  }
  return result;
}

// Build all anomaly resolutions
const ALL_RESOLUTIONS = ['hourly', 'daily', 'weekly', 'monthly', 'yearly'];
const buildingAnomalyByResolution = {};
const portfolioAnomalyByResolution = {};
for (const res of ALL_RESOLUTIONS) {
  buildingAnomalyByResolution[res] = makeSystemAnomalyForResolution(res);
  portfolioAnomalyByResolution[res] = { ...buildingAnomalyByResolution[res] };
}

const chillerAnomaliesByResolution = {};
for (const n of [1, 2, 3]) {
  chillerAnomaliesByResolution[n] = {};
  for (const res of ALL_RESOLUTIONS) {
    chillerAnomaliesByResolution[n][res] = makeChillerAnomalyForResolution(n, res);
  }
}

// Default anomaly (weekly) for backward compatibility
const buildingAnomaly = buildingAnomalyByResolution.weekly;
const portfolioAnomaly = portfolioAnomalyByResolution.weekly;

// ────────────────────────────────────────────────────────────
// 8. Generate warnings from real data
// ────────────────────────────────────────────────────────────
const warnings = [];
const notifications = [];
const lastTimestamp = latestRows[latestRows.length - 1].timestamp;

for (const cs of chillerSnapshots) {
  if (cs.status === 'warning') {
    warnings.push({
      id: `w-ch${cs.n}`,
      severity: 'critical',
      message: `Chiller ${cs.n} efficiency degraded — kW/ton at ${cs.efficiency} (threshold: 0.70)`,
      timestamp: lastTimestamp.replace(' ', 'T'),
      buildingId: 'CP1',
      equipmentId: `CP1-chiller-${cs.n}`,
    });
  }
}

for (const ts of towerSnapshots) {
  if (ts.status === 'warning') {
    warnings.push({
      id: `w-tw${ts.n}`,
      severity: 'warning',
      message: `Cooling Tower ${ts.n} condenser supply temp ${ts.temp}°C (above 35°C limit)`,
      timestamp: lastTimestamp.replace(' ', 'T'),
      buildingId: 'CP1',
      equipmentId: `CP1-tower-${ts.n}`,
    });
  }
}

const last48 = allRows.slice(-48);
const offHours = last48.filter(r => r.Total_CoolingTons === 0 && r.Total_Chiller_kW === 0).length;
if (offHours > 4) {
  warnings.push({
    id: 'w-off',
    severity: 'info',
    message: `System OFF detected for ${offHours} hours in last 48 hours — scheduled maintenance?`,
    timestamp: lastTimestamp.replace(' ', 'T'),
    buildingId: 'CP1',
  });
}

notifications.push(
  { id: 'n1', title: `Data available through ${lastTimestamp.substring(0, 10)}`, read: false },
  { id: 'n2', title: `${allRows.length.toLocaleString()} hourly readings processed`, read: false },
  { id: 'n-tariff', title: 'New electricity tariff update — APSR Oman', read: false, externalUrl: 'https://apsr.om/pages/electricity-lb' },
);

if (buildingAnomaly.anomalyCount > 0) {
  notifications.push({
    id: 'n3',
    title: `${buildingAnomaly.anomalyCount} efficiency anomalies detected in system data`,
    read: false,
    buildingId: 'CP1',
  });
}

if (warnings.length === 0) {
  warnings.push({
    id: 'w-none',
    severity: 'info',
    message: 'All systems operating within normal parameters',
    timestamp: lastTimestamp.replace(' ', 'T'),
    buildingId: 'CP1',
  });
}

// ────────────────────────────────────────────────────────────
// 9. Portfolio score
// ────────────────────────────────────────────────────────────
const effForScore = avg(allRows.filter(r => r.System_Efficiency_kW_per_Ton > 0 && r.System_Efficiency_kW_per_Ton < 5).map(r => r.System_Efficiency_kW_per_Ton));
const score = Math.max(0, Math.min(100, round(100 - (effForScore - 0.3) * 120)));

const last12Months = sortedMonths.slice(-12);
const monthEfficiencies = last12Months.map(m => {
  const rows = monthlyMap.get(m).filter(r => r.System_Efficiency_kW_per_Ton > 0 && r.System_Efficiency_kW_per_Ton < 5);
  return rows.length > 0 ? avg(rows.map(r => r.System_Efficiency_kW_per_Ton)) : null;
}).filter(Boolean);
const bestMonthEff = Math.min(...monthEfficiencies);
const savingsPotential = round(((effForScore - bestMonthEff) / effForScore) * 100, 0);

// ────────────────────────────────────────────────────────────
// 10. Assemble output
// ────────────────────────────────────────────────────────────
const chillerTimeSeries = {};
for (const n of [1, 2, 3]) {
  chillerTimeSeries[n] = makeChillerAllResolutions(n);
}

const output = {
  // Meta
  dataRange: {
    from: allRows[0].timestamp,
    to: allRows[allRows.length - 1].timestamp,
    totalRows: allRows.length,
  },

  // Portfolio level
  portfolioMeta: {
    name: 'Chiller Plant',
    buildingCount: 1,
    score,
    savingsPotentialPercent: savingsPotential,
  },
  // Production = electrical input to the system (what the plant uses)
  // Consumption = cooling output in kWh equivalent (what the building consumes as cooling)
  // This ensures consumption > production for display purposes
  todaysProduction: { kWh: round(todayConsumptionKwh, 0), omr: round(todayConsumptionKwh * OMR_PER_KWH, 1) },
  todaysConsumption: { kWh: todayCoolingKwh, omr: round(todayCoolingKwh * OMR_PER_KWH, 1) },
  hourlyProductionConsumption,
  warnings,
  notifications,

  // Building
  building: {
    id: 'CP1',
    name: 'Chiller Plant 1',
    sector: 'Commercial',
    surfaceArea: 5000,
    normalizedConsumption: round(totalSystemKw / allRows.length / 5000 * 8760, 0),
    performanceBand: score >= 70 ? 'Exceeded' : score >= 40 ? 'Average' : 'Lower',
    category: 'Chiller Plant',
  },
  aggregateKPIs: {
    systemDeltaT,
    totalFlowRate,
    systemKwPerTon,
  },

  // Equipment snapshots
  chillerSnapshots,
  towerSnapshots,
  pumpSnapshot: pumpSnap,

  // Charts — multi-resolution
  monthComparisons,       // backward compat: monthly last 12
  comparisonsByResolution: allComparisons,
  consumptionBreakdown,
  chillerTimeSeries,      // { "1": { daily: {...}, weekly: {...}, monthly: {...}, yearly: {...} }, ... }

  // Anomaly — multi-resolution
  buildingAnomaly,        // backward compat: weekly
  portfolioAnomaly,       // backward compat: weekly
  buildingAnomalyByResolution,
  portfolioAnomalyByResolution,
  chillerAnomalies: {     // backward compat: weekly
    1: chillerAnomaliesByResolution[1].weekly,
    2: chillerAnomaliesByResolution[2].weekly,
    3: chillerAnomaliesByResolution[3].weekly,
  },
  chillerAnomaliesByResolution,
};

writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

const fileSizeKb = round(readFileSync(OUT_FILE).length / 1024, 1);
console.log(`\nWrote ${OUT_FILE}`);
console.log(`Output size: ${fileSizeKb} KB`);
console.log(`\nData range: ${output.dataRange.from} → ${output.dataRange.to}`);
console.log(`Total hours: ${output.dataRange.totalRows}`);
console.log(`System efficiency (avg): ${round(effForScore, 3)} kW/ton`);
console.log(`Score: ${score}/100, Savings potential: ${savingsPotential}%`);
console.log(`Warnings: ${warnings.length}, Anomalies: ${buildingAnomaly.anomalyCount}`);
console.log(`\nResolution sizes:`);
for (const res of ALL_RESOLUTIONS) {
  console.log(`  ${res}: comparisons=${allComparisons[res].length}, anomaly=${buildingAnomalyByResolution[res].series.length}`);
}
