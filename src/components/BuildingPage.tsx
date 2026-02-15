import { type FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { buildingDetails, buildings, buildingAnomalyByResolution, copByResolution, overallCop, baselineDeviationSeries } from '../data/mockPortfolioData';
import AnomalyPanel from './AnomalyPanel';
import ChillerPlantSchematic from './ChillerPlantSchematic';
import type { TimeResolution } from '../types/portfolio';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 11 } as const;

interface BuildingPageProps {
  buildingId: string;
  onBack: () => void;
  onNavigateToEquipment: (equipmentId: string) => void;
  onNavigateToBuilding: (buildingId: string) => void;
  onOpenSystemSummary?: () => void;
}

const BuildingPage: FC<BuildingPageProps> = ({ buildingId, onBack, onNavigateToEquipment, onNavigateToBuilding, onOpenSystemSummary }) => {
  const [buildingDropdownOpen, setBuildingDropdownOpen] = useState(false);
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [anomalyResolution, setAnomalyResolution] = useState<TimeResolution>('weekly');
  const [copResolution, setCopResolution] = useState<'daily' | 'monthly' | 'seasonal' | 'yearly'>('monthly');
  const [equipmentView, setEquipmentView] = useState<'schematic' | 'cards'>('schematic');
  const buildingDdRef = useRef<HTMLDivElement>(null);
  const equipmentDdRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => { setBuildingDropdownOpen(false); setEquipmentDropdownOpen(false); }, []);

  useEffect(() => {
    if (!buildingDropdownOpen && !equipmentDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buildingDropdownOpen && buildingDdRef.current && !buildingDdRef.current.contains(target)) setBuildingDropdownOpen(false);
      if (equipmentDropdownOpen && equipmentDdRef.current && !equipmentDdRef.current.contains(target)) setEquipmentDropdownOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [buildingDropdownOpen, equipmentDropdownOpen, closeAll]);

  const detail = buildingDetails[buildingId];

  if (!detail) {
    return (
      <section className="flex h-64 items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Building not found.</p>
      </section>
    );
  }

  const { building, aggregateKPIs, equipment } = detail;

  const statusColor: Record<string, string> = {
    running: 'bg-emerald-400',
    off: 'bg-slate-400',
    warning: 'bg-red-400',
  };

  const statusLabel: Record<string, string> = {
    running: 'Running',
    off: 'Off',
    warning: 'Warning',
  };

  return (
    <section className="space-y-8">
      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        {/* Breadcrumb hidden — navigation via back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Back to portfolio"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{building.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-accent/20 px-3 py-0.5 text-xs font-medium text-accent">
                  {building.sector}
                </span>
                <span className="rounded-full border border-slate-200/70 px-3 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-400">
                  {building.surfaceArea.toLocaleString()} m²
                </span>
              </div>
            </div>
          </div>

          {/* Quick-nav dropdowns */}
          <div className="flex items-center gap-2">
            {/* Switch building */}
            <div className="relative" ref={buildingDdRef}>
              <button
                type="button"
                onClick={() => { setBuildingDropdownOpen((p) => !p); setEquipmentDropdownOpen(false); }}
                className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent/50 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Switch Building
                <svg className={`h-3 w-3 text-slate-400 transition ${buildingDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {buildingDropdownOpen && (
                <div className="card-surface absolute right-0 z-50 mt-2 w-56 space-y-1 p-2 shadow-2xl">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => { onNavigateToBuilding(b.id); setBuildingDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-white/5 ${b.id === buildingId ? 'bg-accent/10 text-accent' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <span>{b.name}</span>
                      <span className="text-xs text-slate-400">{b.sector}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Go to equipment */}
            <div className="relative" ref={equipmentDdRef}>
              <button
                type="button"
                onClick={() => { setEquipmentDropdownOpen((p) => !p); setBuildingDropdownOpen(false); }}
                className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent/50 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Go to Equipment
                <svg className={`h-3 w-3 text-slate-400 transition ${equipmentDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {equipmentDropdownOpen && (
                <div className="card-surface absolute right-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto space-y-1 p-2 shadow-2xl">
                  {equipment.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => { onNavigateToEquipment(e.id); setEquipmentDropdownOpen(false); }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <span>{e.name}</span>
                      <span className={`text-xs ${e.status === 'warning' ? 'text-red-400' : e.status === 'running' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {e.primaryValue} {e.primaryUnit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Aggregate KPI Cards (last 24 hours) ────────────────── */}
      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Last 24 hours (hourly average)</p>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">System Delta T</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            {aggregateKPIs.systemDeltaT}
            <span className="ml-1 text-base font-normal text-slate-500">°C</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Avg Return − Supply</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Total Flow Rate</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            {aggregateKPIs.totalFlowRate}
            <span className="ml-1 text-base font-normal text-slate-500">L/s</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Combined chiller flow</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">System kW/ton</p>
          <p className={`mt-3 text-3xl font-semibold ${aggregateKPIs.systemKwPerTon <= 0.5 ? 'text-emerald-400' : aggregateKPIs.systemKwPerTon <= 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
            {aggregateKPIs.systemKwPerTon}
            <span className="ml-1 text-base font-normal text-slate-500">kW/ton</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Plant efficiency</p>
        </div>
      </div>

      {/* ── Equipment List ────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Chiller Plant Equipment</h3>
          <div
            className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10"
            role="radiogroup"
            aria-label="Equipment view"
          >
            {(['schematic', 'cards'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={equipmentView === v}
                onClick={() => setEquipmentView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  equipmentView === v
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {v === 'schematic' ? 'Schematic' : 'Cards'}
              </button>
            ))}
          </div>
        </div>

        {equipmentView === 'schematic' ? (
          <ChillerPlantSchematic
            equipment={equipment}
            onNavigateToEquipment={onNavigateToEquipment}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {equipment.map((equip) => {
              const isWarning = equip.status === 'warning';
              return (
                <button
                  key={equip.id}
                  type="button"
                  onClick={() => onNavigateToEquipment(equip.id)}
                  className={`card-surface flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl ${isWarning ? 'border-red-400/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-white">{equip.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${isWarning ? 'bg-red-400/20 text-red-400' : equip.status === 'running' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-slate-400/20 text-slate-400'}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor[equip.status]}`} />
                        {statusLabel[equip.status]}
                      </span>
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {equip.primaryValue}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{equip.primaryUnit}</span>
                    {equip.secondaryValue != null && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className={`text-lg font-semibold ${equip.secondaryValue > 0.7 ? 'text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {equip.secondaryValue}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">{equip.secondaryUnit}</span>
                      </>
                    )}
                  </div>

                  {isWarning && (
                    <p className="flex items-center gap-1 text-xs font-medium text-red-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {equip.type === 'chiller' ? 'Efficiency degraded' : 'Over temp'}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── COP (Coefficient of Performance) ───────────────────── */}
      <div className="card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Coefficient of Performance (COP)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              COP = (Cooling Tons × 3.517) / kW &nbsp;&middot;&nbsp; Overall: <span className="font-semibold text-accent">{overallCop}</span>
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="COP resolution">
            {(['daily', 'monthly', 'seasonal', 'yearly'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={copResolution === r}
                onClick={() => setCopResolution(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  copResolution === r
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const data = copByResolution[copResolution] ?? [];
          if (data.length === 0) {
            return <p className="text-sm text-slate-500 dark:text-slate-400">No COP data available</p>;
          }
          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis
                    dataKey="label"
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--grid-stroke)' }}
                    interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
                    angle={data.length > 10 ? -45 : 0}
                    textAnchor={data.length > 10 ? 'end' : 'middle'}
                    height={data.length > 10 ? 60 : 30}
                  />
                  <YAxis
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--grid-stroke)' }}
                    width={48}
                    label={{ value: 'COP', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyles}
                    labelStyle={{ color: 'var(--muted-text)' }}
                    formatter={(v: number) => [`${v.toFixed(2)}`, 'COP']}
                  />
                  <ReferenceLine y={overallCop} stroke="#FAB005" strokeDasharray="4 4" label={{ value: `Avg ${overallCop}`, fill: '#FAB005', fontSize: 11, position: 'right' }} />
                  <Line type="monotone" dataKey="value" name="COP" stroke="#82C91E" strokeWidth={2} dot={data.length <= 40} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      {/* ── Baseline Deviation ─────────────────────────────────── */}
      <div className="card-surface p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Baseline Deviation (vs 2013)
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            (Actual − Baseline) / Baseline &nbsp;&middot;&nbsp; Positive = worse than baseline, Negative = better
          </p>
        </div>
        {baselineDeviationSeries.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={baselineDeviationSeries} margin={{ top: 8, right: 24, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'Deviation %', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                  formatter={(v: number, name: string) => {
                    if (name === 'Deviation') return [`${v}%`, name];
                    return [`${v}`, name];
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted-text)" strokeWidth={1} />
                <Bar dataKey="deviationPercent" name="Deviation" radius={[3, 3, 0, 0]}>
                  {baselineDeviationSeries.map((entry, i) => (
                    <Cell
                      key={`bd-${i}`}
                      fill={entry.deviationPercent > 5 ? '#f87171' : entry.deviationPercent < -5 ? '#82C91E' : '#FAB005'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No baseline data available</p>
        )}
      </div>

      {/* ── Anomaly Panel ─────────────────────────────────────── */}
      <AnomalyPanel
        data={buildingAnomalyByResolution[anomalyResolution]}
        title="Building Anomaly Detection"
        resolution={anomalyResolution}
        onResolutionChange={setAnomalyResolution}
      />

      {/* ── System Summary Button ─────────────────────────────── */}
      {onOpenSystemSummary && (
        <div className="text-center">
          <button
            type="button"
            onClick={onOpenSystemSummary}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            System Summary Report
          </button>
        </div>
      )}
    </section>
  );
};

export default BuildingPage;
