import { type FC, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import {
  portfolioMeta,
  buildings,
  comparisonsByResolution,
  buildingConsumptionBreakdown,
  portfolioAnomalyByResolution,
} from '../data/mockPortfolioData';
import { BAND_COLORS, getBandColor, BAND_BG_CLASS, BAND_TEXT_CLASS } from '../lib/performanceBands';
import AnomalyPanel from './AnomalyPanel';
import TimeResolutionSelector from './TimeResolutionSelector';
import type { PerformanceBand, TimeResolution } from '../types/portfolio';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

interface PortfolioPageProps {
  onNavigateToBuilding: (id: string) => void;
}

// ── Custom scatter dot (clickable) ──────────────────────────────
interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: { id: string; performanceBand: PerformanceBand };
  onNavigateToBuilding: (id: string) => void;
}

const ClickableScatterDot: FC<CustomDotProps> = ({ cx = 0, cy = 0, payload, onNavigateToBuilding }) => {
  if (!payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill={getBandColor(payload.performanceBand)}
      stroke="#fff"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={() => onNavigateToBuilding(payload.id)}
    />
  );
};

// ── Custom scatter tooltip ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ScatterTooltipContent: FC<any> = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="card-surface space-y-1 p-3 text-sm shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-white">{d.name}</p>
      <p className="text-slate-600 dark:text-slate-400">{d.surfaceArea.toLocaleString()} m² · {d.normalizedConsumption} kWh/m²</p>
      <p className={BAND_TEXT_CLASS[d.performanceBand as PerformanceBand]}>{d.performanceBand}</p>
    </div>
  );
};

const PortfolioPage: FC<PortfolioPageProps> = ({ onNavigateToBuilding }) => {
  const [buildingDropdownOpen, setBuildingDropdownOpen] = useState(false);
  const [comparisonResolution, setComparisonResolution] = useState<TimeResolution>('monthly');
  const [anomalyResolution, setAnomalyResolution] = useState<TimeResolution>('weekly');

  const comparisonData = comparisonsByResolution[comparisonResolution];
  const anomalyData = portfolioAnomalyByResolution[anomalyResolution];

  const scatterData = buildings.map((b) => ({
    ...b,
    x: b.surfaceArea,
    y: b.normalizedConsumption,
    z: 200,
  }));

  return (
    <section className="space-y-8">
      {/* Page header with building quick-nav */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Portfolio</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{portfolioMeta.name}</h2>
        </div>
        {/* Building quick-nav dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBuildingDropdownOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent/50 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Go to Building
            <svg className={`h-4 w-4 text-slate-400 transition ${buildingDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {buildingDropdownOpen && (
            <div className="card-surface absolute right-0 z-50 mt-2 w-64 space-y-1 p-2 shadow-2xl">
              {buildings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { onNavigateToBuilding(b.id); setBuildingDropdownOpen(false); }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <span>{b.name}</span>
                  <span className="text-xs text-slate-400">{b.sector}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ SECTION A: Summary Cards ═══════════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Portfolio name */}
        <div className="card-surface flex flex-col justify-center p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Portfolio</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{portfolioMeta.name}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{portfolioMeta.buildingCount} Buildings</p>
        </div>

        {/* Card 2: Consumption donut */}
        <div className="card-surface p-5">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Energy Breakdown
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={buildingConsumptionBreakdown as unknown as Record<string, unknown>[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {buildingConsumptionBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyles} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {buildingConsumptionBreakdown.map((e) => (
              <span key={e.name} className="flex items-center gap-1 text-[0.65rem] text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
                {e.name}
              </span>
            ))}
          </div>
        </div>

        {/* Card 3: Score */}
        <div className="card-surface flex flex-col items-center justify-center p-5">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Portfolio Score
          </p>
          <div className="relative flex h-28 w-28 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--grid-stroke)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#34d399"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(portfolioMeta.score / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
              />
            </svg>
            <span className="absolute text-2xl font-bold text-slate-900 dark:text-white">
              {portfolioMeta.score}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">out of 100</p>
        </div>

        {/* Card 4: Savings potential */}
        <div className="card-surface flex flex-col justify-center p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Savings Potential
          </p>
          <p className="mt-2 text-4xl font-bold text-emerald-400">
            {portfolioMeta.savingsPotentialPercent}%
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            vs most similar efficient building
          </p>
        </div>
      </div>

      {/* ═══════════════ SECTION B: Performance Comparison ═══════════════ */}
      <div className="card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Performance vs Sector Average
          </h3>
          <div className="flex items-center gap-4">
            <TimeResolutionSelector value={comparisonResolution} onChange={setComparisonResolution} />
            {(['Exceeded', 'Average', 'Lower'] as PerformanceBand[]).map((band) => (
              <span key={band} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLORS[band] }} />
                {band}
              </span>
            ))}
          </div>
        </div>

        {comparisonData.length > 0 ? (
          <>
            {/* Status dots — hide when too many (daily) */}
            {comparisonData.length <= 30 && (
              <div className="mb-2 flex justify-between px-8">
                {comparisonData.map((mc, i) => (
                  <span
                    key={`${mc.month}-${i}`}
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: getBandColor(mc.status) }}
                    title={mc.status}
                  />
                ))}
              </div>
            )}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis
                    dataKey="month"
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--grid-stroke)' }}
                    interval={comparisonData.length > 30 ? Math.floor(comparisonData.length / 15) : 0}
                    angle={comparisonData.length > 20 ? -45 : 0}
                    textAnchor={comparisonData.length > 20 ? 'end' : 'middle'}
                    height={comparisonData.length > 20 ? 60 : 30}
                  />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} width={48} label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)' }} />
                  <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                  <Legend wrapperStyle={{ color: 'var(--muted-text)' }} />
                  <Bar dataKey="portfolioValue" name="Portfolio" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sectorValue" name="Sector Average" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION C: Scatter Plot ═══════════════ */}
      <div className="card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Building Performance Map
          </h3>
          <div className="flex items-center gap-4">
            {(['Exceeded', 'Average', 'Lower'] as PerformanceBand[]).map((band) => (
              <span key={band} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLORS[band] }} />
                {band}
              </span>
            ))}
          </div>
        </div>

        {scatterData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Surface Area"
                  unit=" m²"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  label={{ value: 'Surface Area (m²)', position: 'insideBottom', offset: -4, fill: 'var(--muted-text)' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Consumption"
                  unit=" kWh/m²"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kWh/m²', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)' }}
                />
                <ZAxis type="number" dataKey="z" range={[120, 120]} />
                <Tooltip content={<ScatterTooltipContent />} />
                <Scatter
                  data={scatterData}
                  shape={((props: unknown) => (
                    <ClickableScatterDot {...(props as CustomDotProps)} onNavigateToBuilding={onNavigateToBuilding} />
                  )) as (props: unknown) => React.JSX.Element}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No building data available</p>
          </div>
        )}

        {/* Building labels */}
        <div className="mt-4 flex flex-wrap gap-2">
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onNavigateToBuilding(b.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${BAND_BG_CLASS[b.performanceBand]} ${BAND_TEXT_CLASS[b.performanceBand]}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ SECTION D: Anomaly Detection ═══════════════ */}
      <AnomalyPanel
        data={anomalyData}
        title="Portfolio Anomaly Detection"
        resolution={anomalyResolution}
        onResolutionChange={setAnomalyResolution}
      />
    </section>
  );
};

export default PortfolioPage;
