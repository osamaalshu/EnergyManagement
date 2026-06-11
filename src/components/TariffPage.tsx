import { type FC, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Bar,
  BarChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { tariffHourlyData } from '../data/mockPortfolioData';
import {
  crtVoltages,
  getOptionTotals,
  decompositionMeta,
  decompositionMonths,
  TARIFF_OPTION_LABELS,
  tariffParity,
} from '../data/enrichedPortfolioData';
import {
  calculateMonthlyDetailedBills,
  aggregateToDaily,
  aggregateToWeekly,
  aggregateToMonthly,
  aggregateToYearly,
  type MonthlyBill,
} from '../lib/tariffEngine';
import TimeResolutionSelector from './TimeResolutionSelector';
import ExportExcelButton from './ExportExcelButton';
import ConsumptionHeatmap from './ConsumptionHeatmap';
import type { CrtVoltage, TimeResolution } from '../types/portfolio';
import type { TariffHourlyDataPoint } from '../types/portfolio';

/** Normalize timestamp to YYYY-MM-DD for comparison (handles "YYYY-MM-DD HH:mm:ss" or ISO) */
function getDatePart(ts: string): string {
  return ts.substring(0, 10).replace('T', ' ').trim().substring(0, 10);
}

function getDataBounds(data: TariffHourlyDataPoint[]): { minDate: string; maxDate: string } | null {
  if (!data.length) return null;
  const dates = data.map((d) => getDatePart(d.timestamp));
  return { minDate: dates.reduce((a, b) => (a < b ? a : b)), maxDate: dates.reduce((a, b) => (a > b ? a : b)) };
}

/** Default range: full timeline */
function getFullRange(data: TariffHourlyDataPoint[]): { start: string; end: string } | null {
  const bounds = getDataBounds(data);
  if (!bounds) return null;
  return { start: bounds.minDate, end: bounds.maxDate };
}

function filterByDateRange(data: TariffHourlyDataPoint[], start: string, end: string): TariffHourlyDataPoint[] {
  return data.filter((d) => {
    const date = getDatePart(d.timestamp);
    return date >= start && date <= end;
  });
}

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 11 } as const;

const CAPACITY_COLORS = {
  cpr: '#38bdf8',  // sky-400
  ncpr: '#818cf8', // indigo-400
  cgr: '#f472b6',  // pink-400
};

interface TariffPageProps {
  onBack: () => void;
}

const TariffPage: FC<TariffPageProps> = ({ onBack }) => {
  const [resolution, setResolution] = useState<TimeResolution>('monthly');
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [peakDemandYear, setPeakDemandYear] = useState<string>('');
  /** Connection voltage level (drives DUoS rates and Options 2/3 BST rates) */
  const [voltage, setVoltage] = useState<CrtVoltage>('11kV');
  /** User-selected date range; null = use default (latest month) */
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  const dataBounds = useMemo(() => getDataBounds(tariffHourlyData ?? []), []);
  const defaultRange = useMemo(() => getFullRange(tariffHourlyData ?? []), []);
  const effectiveRange = dateRange ?? defaultRange;

  const filteredTariffData = useMemo(() => {
    if (!tariffHourlyData?.length || !effectiveRange) return tariffHourlyData ?? [];
    return filterByDateRange(tariffHourlyData, effectiveRange.start, effectiveRange.end);
  }, [effectiveRange]);

  // Compute monthly bills from filtered data
  const monthlyBills = useMemo<MonthlyBill[]>(() => {
    if (!filteredTariffData.length) return [];
    return calculateMonthlyDetailedBills(filteredTariffData, {
      voltageLevel: voltage,
      includeCgr: true,
      dcMethod: 'top3_peakbands',
    });
  }, [filteredTariffData, voltage]);

  // Aggregated data for line chart (filtered range)
  const lineChartData = useMemo(() => {
    if (!filteredTariffData.length) return [];
    switch (resolution) {
      case 'daily':   return aggregateToDaily(filteredTariffData, voltage);
      case 'weekly':  return aggregateToWeekly(filteredTariffData, voltage);
      case 'monthly': return aggregateToMonthly(filteredTariffData, voltage);
      case 'yearly':  return aggregateToYearly(filteredTariffData, voltage);
      default:        return aggregateToMonthly(filteredTariffData, voltage);
    }
  }, [resolution, filteredTariffData, voltage]);

  // Option 1 vs 2 vs 3 comparison (full timeline, Python APSR CRT engine)
  const optionComparison = useMemo(() => {
    const totals = getOptionTotals(voltage);
    const entries = (['1', '2', '3'] as const)
      .filter((o) => totals[o])
      .map((o) => ({ option: o, ...totals[o] }));
    const cheapest = entries.length ? entries.reduce((a, b) => (b.totalOmr < a.totalOmr ? b : a)).option : null;
    return { entries, cheapest };
  }, [voltage]);

  // Available years for peak demand toggle
  const availableYears = useMemo(() => {
    const years = new Set(monthlyBills.map((b) => b.month.substring(0, 4)));
    return Array.from(years).sort();
  }, [monthlyBills]);

  // Default to latest year if not set
  const selectedPeakYear = peakDemandYear || (availableYears.length > 0 ? availableYears[availableYears.length - 1] : '');

  // Peak demand bar chart data (monthly, filtered by selected year)
  const peakDemandData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyBills
      .filter((bill) => bill.month.startsWith(selectedPeakYear))
      .map((bill) => {
        const m = bill.month.split('-')[1];
        return {
          month: monthNames[parseInt(m, 10) - 1],
          dcKw: Math.round(bill.dcKw),
          dncKw: Math.round(bill.dncKw),
          capacityOmr: Math.round(bill.capacityOmr * 100) / 100,
          capacityCprOmr: Math.round(bill.capacityCprOmr * 100) / 100,
          capacityNcprOmr: Math.round(bill.capacityNcprOmr * 100) / 100,
          capacityCgrOmr: Math.round(bill.capacityCgrOmr * 100) / 100,
        };
      });
  }, [monthlyBills, selectedPeakYear]);

  // Total capacity cost for selected year
  const yearCapacityTotal = useMemo(() => {
    return peakDemandData.reduce((s, d) => s + d.capacityOmr, 0);
  }, [peakDemandData]);

  // Summary totals
  const totals = useMemo(() => {
    if (monthlyBills.length === 0) return null;
    return {
      totalKwh: monthlyBills.reduce((s, b) => s + b.kwhTotal, 0),
      totalEnergyCost: monthlyBills.reduce((s, b) => s + b.touEnergyOmr, 0),
      totalCapacityCost: monthlyBills.reduce((s, b) => s + b.capacityOmr, 0),
      totalSupply: monthlyBills.reduce((s, b) => s + b.supplyOmr, 0),
      totalVat: monthlyBills.reduce((s, b) => s + b.vatOmr, 0),
      totalBill: monthlyBills.reduce((s, b) => s + b.totalBillOmr, 0),
    };
  }, [monthlyBills]);

  // Physics diagnostic estimate — a modeled subset of operational waste, kept
  // OUT of the financial decomposition and surfaced as a prioritisation signal.
  const physicsEstimate = useMemo(() => {
    if (!decompositionMonths.length) return null;
    const attributed = decompositionMonths.reduce((s, d) => s + d.physicsOmr, 0); // capped at operational
    const raw = decompositionMonths.reduce((s, d) => s + d.physicsRawOmr, 0); //     uncapped model
    const operational = decompositionMonths.reduce((s, d) => s + d.operationalOmr, 0);
    return {
      attributed,
      lo: Math.min(attributed, raw),
      hi: Math.max(attributed, raw),
      operational,
      shareOfOperational: operational > 0 ? (attributed / operational) * 100 : 0,
    };
  }, []);

  const formatOmr = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatKwh = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Back to overview"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Tariff Analysis</p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Tariff Structure</h2>
            </div>
          </div>

          {/* Voltage level selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Connection voltage</span>
            <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="Connection voltage level">
              {crtVoltages.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={voltage === v}
                  onClick={() => setVoltage(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    voltage === v
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI cards (larger) + Filter (minimal, dates aligned vertically) */}
      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <div className="card-surface flex flex-col items-center justify-center px-5 py-3.5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total kWh</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatKwh(totals.totalKwh)}</p>
          </div>
          <div className="card-surface flex flex-col items-center justify-center px-5 py-3.5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Energy Cost</p>
            <p className="mt-1 text-xl font-semibold text-emerald-500">{formatOmr(totals.totalEnergyCost)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface flex flex-col items-center justify-center px-5 py-3.5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Capacity Cost</p>
            <p className="mt-1 text-xl font-semibold text-sky-400">{formatOmr(totals.totalCapacityCost)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface flex flex-col items-center justify-center px-5 py-3.5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Supply + VAT</p>
            <p className="mt-1 text-xl font-semibold text-amber-400">{formatOmr(totals.totalSupply + totals.totalVat)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface flex flex-col items-center justify-center px-5 py-3.5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Bill</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatOmr(totals.totalBill)} <span className="text-xs font-normal text-slate-500">OMR</span></p>
          </div>

          {/* Filter card — minimal, dates in 2 columns (From | To) aligned vertically */}
          {dataBounds && (() => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const startDate = effectiveRange?.start ?? dataBounds.minDate;
            const endDate = effectiveRange?.end ?? dataBounds.maxDate;
            const startY = parseInt(startDate.substring(0, 4), 10);
            const startM = parseInt(startDate.substring(5, 7), 10);
            const endY = parseInt(endDate.substring(0, 4), 10);
            const endM = parseInt(endDate.substring(5, 7), 10);
            const minY = parseInt(dataBounds.minDate.substring(0, 4), 10);
            const maxY = parseInt(dataBounds.maxDate.substring(0, 4), 10);
            const years = Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);

            const setStart = (y: number, m: number) => {
              const s = `${y}-${String(m).padStart(2, '0')}-01`;
              const currentEnd = dateRange?.end ?? defaultRange?.end ?? dataBounds.maxDate;
              setDateRange({ start: s, end: currentEnd < s ? s : currentEnd });
            };
            const setEnd = (y: number, m: number) => {
              const lastDay = new Date(y, m, 0).getDate();
              const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
              const currentStart = dateRange?.start ?? defaultRange?.start ?? dataBounds.minDate;
              setDateRange({ start: currentStart > e ? e : currentStart, end: e });
            };

            const selectClass = 'w-full appearance-none rounded border border-slate-200/70 bg-white px-1.5 py-0.5 pr-5 text-[0.65rem] font-medium text-slate-700 outline-none transition hover:border-slate-400 focus:border-accent focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-card-dark dark:text-slate-200 cursor-pointer text-center';
            const chevron = <svg className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;

            return (
              <div className="card-surface flex min-w-0 flex-col items-center justify-center px-3 py-2">
                <div className="flex w-full items-center justify-center gap-2 text-center">
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Filter</span>
                  {dateRange !== null && (
                    <button type="button" onClick={() => setDateRange(null)} className="text-[0.55rem] font-medium text-accent hover:text-accent/80" aria-label="Reset">Reset</button>
                  )}
                </div>
                <div className="mt-1.5 grid w-full grid-cols-2 gap-x-2 gap-y-1">
                  <div className="relative"><select value={startM} onChange={(e) => setStart(startY, Number(e.target.value))} className={selectClass} aria-label="Start month">{months.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}</select>{chevron}</div>
                  <div className="relative"><select value={endM} onChange={(e) => setEnd(endY, Number(e.target.value))} className={selectClass} aria-label="End month">{months.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}</select>{chevron}</div>
                  <div className="relative"><select value={startY} onChange={(e) => setStart(Number(e.target.value), startM)} className={selectClass} aria-label="Start year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>{chevron}</div>
                  <div className="relative"><select value={endY} onChange={(e) => setEnd(Number(e.target.value), endM)} className={selectClass} aria-label="End year">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>{chevron}</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tariff option comparison (APSR CRT Options 1/2/3, Python engine) */}
      {optionComparison.entries.length > 0 && (
        <div className="card-surface p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tariff Option Comparison — {voltage}</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Full data range, computed by the APSR CRT engine (incl. capacity, supply &amp; 5% VAT).
                TS/Python parity: {tariffParity.pass ? 'verified' : 'FAILED'} (max diff {tariffParity.maxDiffPct}%).
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {optionComparison.entries.map((e) => {
              const isCheapest = e.option === optionComparison.cheapest;
              return (
                <div
                  key={e.option}
                  className={`rounded-xl border p-4 ${
                    isCheapest
                      ? 'border-emerald-400/60 bg-emerald-400/5'
                      : 'border-slate-200/70 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{TARIFF_OPTION_LABELS[e.option]}</p>
                    {isCheapest && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-500">
                        Cheapest
                      </span>
                    )}
                  </div>
                  <p className={`mt-3 text-2xl font-semibold ${isCheapest ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                    {formatOmr(e.totalOmr)} <span className="text-xs font-normal text-slate-500">OMR</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Energy charges: {formatOmr(e.energyOmr)} OMR &middot; {e.months} months
                  </p>
                  {!isCheapest && optionComparison.cheapest && (
                    <p className="mt-1 text-xs font-medium text-red-400">
                      +{formatOmr(e.totalOmr - optionComparison.entries.find((c) => c.option === optionComparison.cheapest)!.totalOmr)} OMR vs cheapest
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart 1: Effective Tariff Rate (OMR/kWh) over time */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Effective Tariff Rate</h3>
          <div className="flex items-center gap-2">
            <ExportExcelButton data={lineChartData as unknown as Record<string, unknown>[]} fileName={`EffectiveTariffRate_${resolution}`} />
            <TimeResolutionSelector value={resolution} onChange={setResolution} limitTo={['daily', 'weekly', 'monthly', 'yearly']} />
          </div>
        </div>
        {lineChartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={lineChartData.length > 30 ? Math.floor(lineChartData.length / 20) : 0}
                  angle={lineChartData.length > 15 ? -45 : 0}
                  textAnchor={lineChartData.length > 15 ? 'end' : 'middle'}
                  height={lineChartData.length > 15 ? 60 : 30}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={72}
                  label={{ value: 'OMR / kWh', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                  tickFormatter={(v: number) => v.toFixed(4)}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                  formatter={(value: number) => [`${value.toFixed(4)} OMR/kWh`, 'Rate']}
                />
                <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} />
                <Line
                  type="monotone"
                  dataKey="rateOmrPerKwh"
                  name="Effective Rate (OMR/kWh)"
                  stroke="#FAB005"
                  strokeWidth={2}
                  dot={lineChartData.length <= 50}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-80 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No tariff data available</p>
          </div>
        )}
      </div>

      {/* Chart 2: Peak Power Demand Bar Chart (monthly per year) */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Monthly Peak Power Demand — {selectedPeakYear}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Total capacity charges: <span className="font-semibold text-sky-400">{formatOmr(yearCapacityTotal)} OMR</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportExcelButton data={peakDemandData as unknown as Record<string, unknown>[]} fileName={`PeakDemand_${selectedPeakYear}`} />
          {/* Year toggle */}
          <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="Peak demand year">
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                role="radio"
                aria-checked={selectedPeakYear === yr}
                onClick={() => setPeakDemandYear(yr)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  selectedPeakYear === yr
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
          </div>
        </div>
        {peakDemandData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakDemandData} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="month"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kW', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload as (typeof peakDemandData)[number] | undefined;
                    if (!row) return null;
                    return (
                      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.75rem', padding: '10px 14px', fontSize: 12, lineHeight: 1.6 }}>
                        <p style={{ color: 'var(--muted-text)', marginBottom: 4, fontWeight: 600 }}>{label} {selectedPeakYear}</p>
                        <p style={{ color: CAPACITY_COLORS.cpr }}>Coincident Peak: <strong>{formatOmr(row.capacityCprOmr)} OMR</strong></p>
                        <p style={{ color: CAPACITY_COLORS.ncpr }}>Non-Coincident Peak: <strong>{formatOmr(row.capacityNcprOmr)} OMR</strong></p>
                        <p style={{ marginTop: 4, borderTop: '1px solid var(--tooltip-border)', paddingTop: 4, fontWeight: 700, fontSize: 13 }}>Total: {formatOmr(row.capacityOmr)} OMR</p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} />
                <Bar dataKey="dcKw" name="Coincident Peak" stackId="peak" fill={CAPACITY_COLORS.cpr} radius={[0, 0, 0, 0]} />
                <Bar dataKey="dncKw" name="Non-Coincident Peak" stackId="peak" fill={CAPACITY_COLORS.ncpr} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-80 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No peak demand data for {selectedPeakYear}</p>
          </div>
        )}
      </div>

      {/* Daily Consumption Heatmap (month × day, year toggle) — under Peak Demand */}
      <ConsumptionHeatmap />

      {/* Bill Breakdown Table */}
      <div className="card-surface overflow-hidden">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Monthly Bill Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-slate-200/70 bg-slate-50 dark:border-white/5 dark:bg-white/5">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Month</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">kWh</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Energy</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Capacity</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Supply</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">VAT</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Total (OMR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {monthlyBills.map((bill) => {
                const isExpanded = expandedBill === bill.month;
                return (
                  <tr key={bill.month} className="group">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => setExpandedBill(isExpanded ? null : bill.month)}
                        className="flex items-center gap-2 text-left hover:text-accent"
                        aria-label={`Toggle details for ${bill.month}`}
                      >
                        <svg className={`h-3 w-3 text-slate-400 transition ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {bill.month}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
                          <p>OP: {formatKwh(bill.kwhByBand.OP)} kWh &middot; {formatOmr(bill.energyCostByBand.OP)} OMR</p>
                          <p>NP: {formatKwh(bill.kwhByBand.NP)} kWh &middot; {formatOmr(bill.energyCostByBand.NP)} OMR</p>
                          <p>WDP: {formatKwh(bill.kwhByBand.WDP)} kWh &middot; {formatOmr(bill.energyCostByBand.WDP)} OMR</p>
                          <p>WEDP: {formatKwh(bill.kwhByBand.WEDP)} kWh &middot; {formatOmr(bill.energyCostByBand.WEDP)} OMR</p>
                          <p className="mt-1 border-t border-dashed border-slate-300 pt-1 dark:border-white/10">
                            DC: {Math.round(bill.dcKw)} kW &middot; DNC: {Math.round(bill.dncKw)} kW
                          </p>
                          <p>CPR: {formatOmr(bill.capacityCprOmr)} &middot; NCPR: {formatOmr(bill.capacityNcprOmr)} &middot; CGR: {formatOmr(bill.capacityCgrOmr)}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatKwh(bill.kwhTotal)}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{formatOmr(bill.touEnergyOmr)}</td>
                    <td className="px-4 py-3 text-right text-sky-400">{formatOmr(bill.capacityOmr)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatOmr(bill.supplyOmr)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatOmr(bill.vatOmr)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatOmr(bill.totalBillOmr)}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-white/5">
                  <td className="px-6 py-3 font-bold text-slate-900 dark:text-white">Total</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{formatKwh(totals.totalKwh)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-500">{formatOmr(totals.totalEnergyCost)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sky-400">{formatOmr(totals.totalCapacityCost)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-500">{formatOmr(totals.totalSupply)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-500">{formatOmr(totals.totalVat)}</td>
                  <td className="px-6 py-3 text-right text-lg font-bold text-slate-900 dark:text-white">{formatOmr(totals.totalBill)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bill Decomposition (Python engine: structural / operational / tariff-driven / physics) */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bill Decomposition</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {decompositionMeta.voltage} &middot; Option {decompositionMeta.option} (TOU) &middot; incl. 5% VAT (matches the monthly bill table). Reference = the same
              load run at the efficient target COP {decompositionMeta.targetCop.toFixed(2)} (the plant&apos;s demonstrated best).
              Structural = the efficient floor; Operational = the correctable gap to that COP. The two reconcile to the actual bill.
            </p>
          </div>
          <ExportExcelButton data={decompositionMonths as unknown as Record<string, unknown>[]} fileName="BillDecomposition" />
        </div>

        {decompositionMonths.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={decompositionMonths} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis
                    dataKey="label"
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--grid-stroke)' }}
                    interval={decompositionMonths.length > 18 ? 1 : 0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--grid-stroke)' }}
                    width={64}
                    label={{ value: 'OMR', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    labelStyle={{ color: 'var(--muted-text)' }}
                    formatter={(value: number, name: string) => [`${formatOmr(value)} OMR`, name]}
                  />
                  <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} />
                  <Bar dataKey="structuralOmr" name="Structural (efficient floor)" stackId="bill" fill="#38bdf8" />
                  <Bar dataKey="operationalOmr" name="Operational (correctable)" stackId="bill" fill="#f87171" radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {(() => {
              const effYr = decompositionMonths.reduce((s, d) => s + d.tariffDrivenOmr, 0);
              const saving = effYr < 0;
              return (
                <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-emerald-500">Tariff structure:</span>{' '}
                  on Option 1 (TOU) you {saving ? 'save' : 'pay a premium of'}{' '}
                  <span className="font-semibold tabular-nums">{formatOmr(Math.abs(effYr))} OMR</span>{' '}
                  over the period vs the flat Option 3 rate — {saving ? 'TOU is the right plan for this load.' : 'flat would be cheaper for this load.'}
                </p>
              );
            })()}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-t border-slate-200/70 bg-slate-50 dark:border-white/5 dark:bg-white/5">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Month</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total (OMR)</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Structural</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Operational</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Efficiency (COP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
                  {decompositionMonths.map((d) => (
                    <tr key={d.month}>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{d.label}</td>
                      <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{formatOmr(d.totalOmr)}</td>
                      <td className="px-4 py-2 text-right text-sky-400">{formatOmr(d.structuralOmr)} <span className="text-xs text-slate-500">({d.structuralPct}%)</span></td>
                      <td className="px-4 py-2 text-right text-red-400">{formatOmr(d.operationalOmr)} <span className="text-xs text-slate-500">({d.operationalPct}%)</span></td>
                      <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {d.actualCop > 0 ? `${d.actualCop.toFixed(2)} → ${d.targetCop.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No decomposition data — run npm run enrich</p>
          </div>
        )}
      </div>

      {/* Diagnostic estimate — physics attribution, kept separate from the billed decomposition */}
      {physicsEstimate && (
        <div className="card-surface p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Diagnostic estimate — chiller faults</h3>
            <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-violet-400">
              Modeled · est.
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
            Avoidable energy cost our physics engine attributes to diagnosed chiller faults (R-CH-01 low COP,
            R-CH-03 peak overconsumption), from physics-validated 2-hour intervals only. This is a <strong>subset of the
            Operational waste</strong> above — a prioritisation signal for where to act, <strong>not a separate or
            billed charge</strong>.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-violet-400/30 bg-violet-400/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Est. avoidable / yr</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-violet-400">
                ~{formatOmr(physicsEstimate.attributed)} <span className="text-xs font-normal text-slate-500">OMR</span>
              </p>
              <p className="mt-1 text-[0.7rem] tabular-nums text-slate-400">
                modeled range {formatOmr(physicsEstimate.lo)}–{formatOmr(physicsEstimate.hi)} OMR
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/70 p-4 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Share of operational</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {physicsEstimate.shareOfOperational.toFixed(0)}<span className="text-xs font-normal text-slate-500">%</span>
              </p>
              <p className="mt-1 text-[0.7rem] tabular-nums text-slate-400">of {formatOmr(physicsEstimate.operational)} OMR correctable</p>
            </div>
            <div className="rounded-xl border border-slate-200/70 p-4 dark:border-white/10">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Confidence basis</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-slate-600 dark:text-slate-300">
                Physics-validated 2-hour intervals · COP bounds [0.5–12] · fault benchmark COP 4.5. QA-failing intervals excluded.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TariffPage;
