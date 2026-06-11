import { type FC, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { buildingDetails, buildings, copByResolution, baselineDeviationSeries, getPumpSpecificEnergySeries } from '../data/mockPortfolioData';
import {
  dataQuality,
  getPhysicsAnomaly,
  notApplicableRules,
  plantPhysics,
  QUALITY_STATUS_COLORS,
  QUALITY_STATUS_ORDER,
} from '../data/enrichedPortfolioData';
import AnomalyPanel from './AnomalyPanel';
import ChillerPlantSchematic from './ChillerPlantSchematic';
import ExportExcelButton from './ExportExcelButton';

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
  const [copResolution, setCopResolution] = useState<'daily' | 'monthly' | 'seasonal' | 'yearly'>('monthly');
  const [pumpResolution, setPumpResolution] = useState<'daily' | 'monthly' | 'yearly'>('daily');
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

  // Pump Specific Energy (kWh/m³) from real CSV data
  const pumpSpecificEnergy = useMemo(() => getPumpSpecificEnergySeries(pumpResolution), [pumpResolution]);

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
      <div className="group card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Coefficient of Performance (COP)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              COP = (Cooling Tons × 3.517) / kW &nbsp;&middot;&nbsp; Baseline: <span className="font-semibold text-accent">5.2</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportExcelButton data={(copByResolution[copResolution] ?? []) as unknown as Record<string, unknown>[]} fileName={`COP_${copResolution}`} />
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
        </div>
        {(() => {
          const data = copByResolution[copResolution] ?? [];
          if (data.length === 0) {
            return <p className="text-sm text-slate-500 dark:text-slate-400">No COP data available</p>;
          }
          return (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 80, left: 0, bottom: 4 }}>
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
                  <ReferenceLine y={5.2} stroke="#FAB005" strokeDasharray="4 4" label={{ value: 'Baseline 5.2', fill: '#FAB005', fontSize: 11, position: 'right' }} />
                  <Line type="monotone" dataKey="value" name="COP" stroke="#82C91E" strokeWidth={2} dot={data.length <= 40} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>

      {/* ── Specific Energy (Pump) ──────────────────────────────── */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Specific Energy (Pump)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              kWh/m³ &nbsp;&middot;&nbsp; Baseline: <span className="font-semibold text-accent">0.08</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportExcelButton data={pumpSpecificEnergy as unknown as Record<string, unknown>[]} fileName={`SpecificEnergy_Pump_${pumpResolution}`} />
            <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="Pump specific energy resolution">
              {(['daily', 'monthly', 'yearly'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={pumpResolution === r}
                  onClick={() => setPumpResolution(r)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    pumpResolution === r
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {pumpSpecificEnergy.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pumpSpecificEnergy} margin={{ top: 8, right: 80, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={pumpSpecificEnergy.length > 20 ? Math.floor(pumpSpecificEnergy.length / 15) : 0}
                  angle={pumpSpecificEnergy.length > 10 ? -45 : 0}
                  textAnchor={pumpSpecificEnergy.length > 10 ? 'end' : 'middle'}
                  height={pumpSpecificEnergy.length > 10 ? 60 : 30}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kWh/m³', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                  formatter={(v: number) => [`${v.toFixed(4)}`, 'kWh/m³']}
                />
                <ReferenceLine y={0.08} stroke="#FAB005" strokeDasharray="4 4" label={{ value: 'Baseline 0.08', fill: '#FAB005', fontSize: 11, position: 'right' }} />
                <Line type="monotone" dataKey="specificEnergy" name="Specific Energy" stroke="#38bdf8" strokeWidth={2} dot={pumpSpecificEnergy.length <= 40} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No pump data available</p>
        )}
      </div>

      {/* ── Baseline Deviation ─────────────────────────────────── */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Baseline Deviation (vs 2013)
          </h3>
          <ExportExcelButton data={baselineDeviationSeries as unknown as Record<string, unknown>[]} fileName="BaselineDeviation" />
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

      {/* ── Data Quality (physics-engine sensor validation) ──── */}
      {(() => {
        const total = Object.values(dataQuality.byStatus).reduce((s, v) => s + v, 0);
        const shares = QUALITY_STATUS_ORDER
          .map((st) => ({ status: st, count: dataQuality.byStatus[st] ?? 0 }))
          .filter((s) => s.count > 0);
        const topEpisodes = Object.entries(dataQuality.perChiller)
          .flatMap(([n, rep]) => rep.episodes.map((e) => ({ chiller: n, ...e })))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);
        const impossibleTotal = Object.values(dataQuality.perChiller).reduce((s, r) => s + (r.impossibleReadings ?? 0), 0);
        return (
          <div className="card-surface p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Data Quality</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Every reading is classified by the physics engine (COP bounds 0.5–12, min ΔT 1°C) and kept — never dropped.
              GOOD + low-ΔT readings feed the COP; impossible / inverted-ΔT readings can&apos;t yield a COP, so they&apos;re
              held out of the metric and flagged to investigate (faulty meter, or a chiller running abnormally).
            </p>

            {/* Status share bar */}
            <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Data quality status share">
              {shares.map((s) => (
                <div
                  key={s.status}
                  style={{ width: `${(s.count / total) * 100}%`, background: QUALITY_STATUS_COLORS[s.status] }}
                  title={`${s.status}: ${s.count.toLocaleString()} rows (${((s.count / total) * 100).toFixed(1)}%)`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {shares.map((s) => (
                <span key={s.status} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: QUALITY_STATUS_COLORS[s.status] }} />
                  {s.status} {((s.count / total) * 100).toFixed(1)}%
                </span>
              ))}
            </div>

            {/* Per-chiller summary */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(dataQuality.perChiller).map(([n, rep]) => {
                const goodPct = rep.totalRows > 0 ? (rep.goodForDiagnosis / rep.totalRows) * 100 : 0;
                return (
                  <div key={n} className="rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Chiller {n}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-emerald-500">{rep.goodForDiagnosis.toLocaleString()}</span> GOOD 2-hr intervals
                      ({goodPct.toFixed(1)}%) &middot; {rep.flaggedNotDiscarded.toLocaleString()} flagged
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Integrity flag — impossible readings are a signal, not noise */}
            {impossibleTotal > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="mt-px shrink-0 font-semibold text-red-400">⚠ Investigate:</span>
                <span>
                  <span className="font-semibold tabular-nums">{impossibleTotal.toLocaleString()}</span> impossible / inverted-ΔT readings
                  (e.g. return colder than supply). Kept and held out of the COP — but they point to a faulty meter or a chiller
                  running abnormally, and warrant a sensor + equipment check.
                </span>
              </div>
            )}

            {/* Top quality findings */}
            {topEpisodes.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Top quality findings</p>
                {topEpisodes.map((e, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${e.status === 'BAD' ? 'bg-red-400/15 text-red-400' : 'bg-amber-400/15 text-amber-500'}`}>Chiller {e.chiller}</span>
                    <span className="min-w-0 flex-1">{e.reason}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {e.count.toLocaleString()} intervals over {e.distinctDays} days
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Anomaly Panel (physics diagnostics) ───────────────── */}
      <AnomalyPanel
        data={getPhysicsAnomaly().data}
        findings={getPhysicsAnomaly().findings}
        title="Plant Physics Diagnostics"
        subtitle={`Monthly kW/ton from physics-validated readings (${plantPhysics.goodRows.toLocaleString()} 2-hr intervals, avg COP ${plantPhysics.avgCop}) vs the Gulf COP 4.5 benchmark. ${notApplicableRules.length} rules skipped for missing signals.`}
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
