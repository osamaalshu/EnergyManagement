import { type FC, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { tariffHourlyData } from '../data/mockPortfolioData';
import {
  calculateMonthlyDetailedBills,
  aggregateToHourly,
  aggregateToDaily,
  aggregateToWeekly,
  aggregateToMonthly,
  aggregateToYearly,
  type MonthlyBill,
} from '../lib/tariffEngine';
import TimeResolutionSelector from './TimeResolutionSelector';
import type { TimeResolution } from '../types/portfolio';
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

/** Default range: full calendar month of the latest date in the data */
function getLatestMonthRange(data: TariffHourlyDataPoint[]): { start: string; end: string } | null {
  const bounds = getDataBounds(data);
  if (!bounds) return null;
  const [y, m] = bounds.maxDate.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
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
  /** User-selected date range; null = use default (latest month) */
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  const dataBounds = useMemo(() => getDataBounds(tariffHourlyData ?? []), []);
  const defaultRange = useMemo(() => getLatestMonthRange(tariffHourlyData ?? []), []);
  const effectiveRange = dateRange ?? defaultRange;

  const filteredTariffData = useMemo(() => {
    if (!tariffHourlyData?.length || !effectiveRange) return tariffHourlyData ?? [];
    return filterByDateRange(tariffHourlyData, effectiveRange.start, effectiveRange.end);
  }, [effectiveRange]);

  // Compute monthly bills from filtered data
  const monthlyBills = useMemo<MonthlyBill[]>(() => {
    if (!filteredTariffData.length) return [];
    return calculateMonthlyDetailedBills(filteredTariffData, {
      voltageLevel: '11kV',
      includeCgr: true,
      dcMethod: 'top3_peakbands',
    });
  }, [filteredTariffData]);

  // Aggregated data for line chart (filtered range)
  const lineChartData = useMemo(() => {
    if (!filteredTariffData.length) return [];
    const vl = '11kV';
    switch (resolution) {
      case 'hourly':  return aggregateToHourly(filteredTariffData, vl);
      case 'daily':   return aggregateToDaily(filteredTariffData, vl);
      case 'weekly':  return aggregateToWeekly(filteredTariffData, vl);
      case 'monthly': return aggregateToMonthly(filteredTariffData, vl);
      case 'yearly':  return aggregateToYearly(filteredTariffData, vl);
      default:        return aggregateToMonthly(filteredTariffData, vl);
    }
  }, [resolution, filteredTariffData]);

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

  const formatOmr = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatKwh = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
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
      </div>

      {/* Date range filter — default: latest month */}
      {dataBounds && (
        <div className="card-surface flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">From</span>
              <input
                type="date"
                value={effectiveRange?.start ?? ''}
                min={dataBounds.minDate}
                max={dataBounds.maxDate}
                onChange={(e) => {
                  const start = e.target.value;
                  const currentEnd = dateRange?.end ?? defaultRange?.end ?? dataBounds.maxDate;
                  setDateRange({ start, end: currentEnd < start ? start : currentEnd });
                }}
                className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-card-dark dark:text-white"
                aria-label="Start date"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">To</span>
              <input
                type="date"
                value={effectiveRange?.end ?? ''}
                min={dataBounds.minDate}
                max={dataBounds.maxDate}
                onChange={(e) => {
                  const end = e.target.value;
                  const currentStart = dateRange?.start ?? defaultRange?.start ?? dataBounds.minDate;
                  setDateRange({ start: currentStart > end ? end : currentStart, end });
                }}
                className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-card-dark dark:text-white"
                aria-label="End date"
              />
            </label>
            <button
              type="button"
              onClick={() => setDateRange(null)}
              className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent dark:border-white/10 dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Reset to latest month"
            >
              Latest month
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing data from <strong className="text-slate-700 dark:text-slate-300">{effectiveRange?.start ?? '—'}</strong> to <strong className="text-slate-700 dark:text-slate-300">{effectiveRange?.end ?? '—'}</strong>
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {totals && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="card-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total kWh</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatKwh(totals.totalKwh)}</p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Energy Cost</p>
            <p className="mt-2 text-xl font-semibold text-emerald-500">{formatOmr(totals.totalEnergyCost)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Capacity Cost</p>
            <p className="mt-2 text-xl font-semibold text-sky-400">{formatOmr(totals.totalCapacityCost)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Supply + VAT</p>
            <p className="mt-2 text-xl font-semibold text-amber-400">{formatOmr(totals.totalSupply + totals.totalVat)} <span className="text-xs text-slate-500">OMR</span></p>
          </div>
          <div className="card-surface col-span-1 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Bill</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatOmr(totals.totalBill)} <span className="text-sm font-normal text-slate-500">OMR</span></p>
          </div>
        </div>
      )}

      {/* Chart 1: Effective Tariff Rate (OMR/kWh) over time */}
      <div className="card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Effective Tariff Rate</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">How much you pay per kWh over time (OMR/kWh)</p>
          </div>
          <TimeResolutionSelector value={resolution} onChange={setResolution} />
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
      <div className="card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Monthly Peak Power Demand — {selectedPeakYear}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Total capacity charges: <span className="font-semibold text-sky-400">{formatOmr(yearCapacityTotal)} OMR</span>
            </p>
          </div>
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
    </section>
  );
};

export default TariffPage;
