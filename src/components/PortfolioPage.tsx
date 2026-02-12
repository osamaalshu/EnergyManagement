import { type FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  portfolioMeta,
  buildings,
  comparisonsByResolution,
  buildingConsumptionBreakdown,
  buildingDetails,
} from '../data/mockPortfolioData';
import { getBandColor, BAND_BG_CLASS, BAND_TEXT_CLASS } from '../lib/performanceBands';
import TimeResolutionSelector from './TimeResolutionSelector';
import type { PerformanceBand, TimeResolution } from '../types/portfolio';

/* ── Shared styles ─────────────────────────────────────────────── */
const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

/** Consistent section heading used across all widget cards */
const SectionTitle: FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
    {children}
  </h3>
);

/* ── Scatter helpers ───────────────────────────────────────────── */
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

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
interface PortfolioPageProps {
  onNavigateToBuilding: (id: string) => void;
}

const PortfolioPage: FC<PortfolioPageProps> = ({ onNavigateToBuilding }) => {
  const [buildingDropdownOpen, setBuildingDropdownOpen] = useState(false);
  const [comparisonResolution, setComparisonResolution] = useState<TimeResolution>('monthly');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setBuildingDropdownOpen(false), []);

  useEffect(() => {
    if (!buildingDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) closeDropdown();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDropdown(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [buildingDropdownOpen, closeDropdown]);

  const comparisonData = comparisonsByResolution[comparisonResolution];

  const scatterData = buildings.map((b) => ({
    ...b,
    x: b.surfaceArea,
    y: b.normalizedConsumption,
    z: 200,
  }));

  /* Compute a sector-average slope for the scatter chart diagonal baseline.
     slope = sector avg kWh / typical surface area → gives kWh per m². */
  const sectorSlopeKwhPerM2 = useMemo(() => {
    const yearly = comparisonsByResolution.yearly;
    if (yearly.length === 0 || buildings.length === 0) return undefined;
    const avgSector = yearly.reduce((sum, d) => sum + d.sectorValue, 0) / yearly.length;
    const avgArea = buildings.reduce((sum, b) => sum + b.surfaceArea, 0) / buildings.length;
    return avgArea > 0 ? avgSector / avgArea : undefined;
  }, []);

  /* Diagonal baseline data: two points from origin to max X */
  const baselineDiagonal = useMemo(() => {
    if (sectorSlopeKwhPerM2 === undefined) return [];
    const maxX = Math.max(...buildings.map(b => b.surfaceArea), 6000);
    return [
      { x: 0, y: 0, z: 0 },
      { x: maxX, y: Math.round(sectorSlopeKwhPerM2 * maxX), z: 0 },
    ];
  }, [sectorSlopeKwhPerM2]);

  /* ── Radar data (dynamic per building count) ───────────────── */
  const radarData = useMemo(() => {
    return [
      { metric: 'Efficiency', fullMark: 100 },
      { metric: 'Delta T', fullMark: 100 },
      { metric: 'Flow Rate', fullMark: 100 },
      { metric: 'Score', fullMark: 100 },
    ].map(d => {
      const result: Record<string, unknown> = { ...d };
      for (const b of buildings) {
        const detail = buildingDetails[b.id];
        if (!detail) continue;
        const kpis = detail.aggregateKPIs;
        switch (d.metric) {
          case 'Efficiency':
            result[b.name] = Math.max(0, Math.min(100, Math.round((1 - (kpis.systemKwPerTon - 0.3) / 0.7) * 100)));
            break;
          case 'Delta T':
            result[b.name] = Math.min(100, Math.round((kpis.systemDeltaT / 12) * 100));
            break;
          case 'Flow Rate':
            result[b.name] = Math.min(100, Math.round((kpis.totalFlowRate / 200) * 100));
            break;
          case 'Score':
            result[b.name] = portfolioMeta.score;
            break;
        }
      }
      return result;
    });
  }, []);

  const radarColors = ['#1A365D', '#82C91E', '#FAB005', '#64748B', '#334155', '#94a3b8'];

  return (
    <section className="space-y-8">
      {/* ── Page header with building quick-nav ────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Portfolio</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{portfolioMeta.name}</h2>
        </div>
        <div className="relative" ref={dropdownRef}>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Portfolio Summary (replaces redundant name card) */}
        <div className="card-surface flex flex-col gap-4 p-5">
          <SectionTitle>Portfolio Summary</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{portfolioMeta.buildingCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Buildings</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{portfolioMeta.score}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{portfolioMeta.savingsPotentialPercent}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Savings</p>
            </div>
          </div>
        </div>

        {/* Card 2: Energy Breakdown donut */}
        <div className="card-surface flex flex-col p-5">
          <SectionTitle>Energy Breakdown</SectionTitle>
          <div className="flex-1">
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

        {/* Card 3: Score ring */}
        <div className="card-surface flex flex-col items-center justify-center p-5">
          <SectionTitle>Portfolio Score</SectionTitle>
          <div className="relative mt-3 flex h-28 w-28 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--grid-stroke)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#82C91E"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(portfolioMeta.score / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
              />
            </svg>
            <span className="absolute text-2xl font-bold text-slate-900 dark:text-white">
              {portfolioMeta.score}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">out of 100</p>
        </div>
      </div>

      {/* ═══════════════ SECTION B: Performance vs Sector Average ═══════════════ */}
      <div className="card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Performance vs Sector Average</SectionTitle>
          <TimeResolutionSelector value={comparisonResolution} onChange={setComparisonResolution} />
        </div>

        {comparisonData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="month"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={comparisonData.length > 30 ? Math.floor(comparisonData.length / 10) : 0}
                  angle={comparisonData.length > 15 ? -45 : 0}
                  textAnchor={comparisonData.length > 15 ? 'end' : 'middle'}
                  height={comparisonData.length > 15 ? 65 : 30}
                />
                <YAxis tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} width={56} label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} iconType="square" iconSize={10} />
                <Bar dataKey="portfolioValue" name="Portfolio" fill="#1A365D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sectorValue" name="Sector Average" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
          </div>
        )}
      </div>

      {/* ═══════════════ SECTION C: Building Performance Map (Scatter) ═══════════════ */}
      <div className="card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Building Performance Map</SectionTitle>
          <div className="flex items-center gap-4">
            {(['Exceeded', 'Average', 'Lower'] as PerformanceBand[]).map((band) => (
              <span key={band} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: getBandColor(band) }} />
                {band}
              </span>
            ))}
          </div>
        </div>

        {scatterData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Surface Area"
                  unit=" m²"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  label={{ value: 'Surface Area (m²)', position: 'insideBottom', offset: -4, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Consumption"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[120, 120]} />
                {/* Diagonal sector-average baseline */}
                {baselineDiagonal.length > 0 && (
                  <Scatter
                    data={baselineDiagonal}
                    line={{ stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '6 4' }}
                    shape={(() => <circle r={0} />) as unknown as (props: unknown) => React.JSX.Element}
                    legendType="none"
                    isAnimationActive={false}
                  />
                )}
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

      {/* ═══════════════ SECTION D: Building-Level Performance ═══════════════ */}
      <div className="card-surface p-6">
        <SectionTitle>Overall Building Performance</SectionTitle>

        {/* KPI summary cards — dynamic grid based on count */}
        <div className={`mt-4 grid gap-4 ${
          buildings.length === 1
            ? 'max-w-md mx-auto'
            : buildings.length === 2
              ? 'md:grid-cols-2 max-w-3xl mx-auto'
              : 'md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {buildings.map((b) => {
            const detail = buildingDetails[b.id];
            if (!detail) return null;
            const { aggregateKPIs } = detail;
            const effColor = aggregateKPIs.systemKwPerTon <= 0.5
              ? 'text-emerald-400'
              : aggregateKPIs.systemKwPerTon <= 0.7
                ? 'text-yellow-400'
                : 'text-red-400';
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onNavigateToBuilding(b.id)}
                className="card-surface flex flex-col gap-3 p-5 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{b.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${BAND_BG_CLASS[b.performanceBand]} ${BAND_TEXT_CLASS[b.performanceBand]}`}>
                    {b.performanceBand}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Delta T</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{aggregateKPIs.systemDeltaT}<span className="text-xs font-normal text-slate-500">°C</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Flow</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{aggregateKPIs.totalFlowRate}<span className="text-xs font-normal text-slate-500"> L/s</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">kW/ton</p>
                    <p className={`text-lg font-semibold ${effColor}`}>{aggregateKPIs.systemKwPerTon}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{b.surfaceArea.toLocaleString()} m² · {b.sector}</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Performance Radar ───────────────────────────────── */}
        {buildings.length > 0 && (
          <div className="mx-auto mt-6 max-w-xl">
            <p className="mb-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
              Performance Radar
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="var(--grid-stroke)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: 'var(--muted-text)', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--muted-text)', fontSize: 10 }}
                    tickCount={5}
                  />
                  {buildings.map((b, i) => (
                    <Radar
                      key={b.id}
                      name={b.name}
                      dataKey={b.name}
                      stroke={radarColors[i % radarColors.length]}
                      fill={radarColors[i % radarColors.length]}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend
                    wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 12 }}
                    iconType="square"
                    iconSize={10}
                  />
                  <Tooltip contentStyle={tooltipStyles} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PortfolioPage;
