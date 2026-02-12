import { type FC, useState, useEffect, useRef, useCallback } from 'react';
import { buildingDetails, buildings, buildingAnomalyByResolution } from '../data/mockPortfolioData';
import AnomalyPanel from './AnomalyPanel';
import type { TimeResolution } from '../types/portfolio';

interface BuildingPageProps {
  buildingId: string;
  onBack: () => void;
  onNavigateToEquipment: (equipmentId: string) => void;
  onNavigateToBuilding: (buildingId: string) => void;
}

const BuildingPage: FC<BuildingPageProps> = ({ buildingId, onBack, onNavigateToEquipment, onNavigateToBuilding }) => {
  const [buildingDropdownOpen, setBuildingDropdownOpen] = useState(false);
  const [equipmentDropdownOpen, setEquipmentDropdownOpen] = useState(false);
  const [anomalyResolution, setAnomalyResolution] = useState<TimeResolution>('weekly');
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
        <p className="mb-1 text-xs text-accent">
          <button type="button" onClick={onBack} className="hover:underline">Portfolio</button>
          <span className="mx-1 text-slate-500">&gt;</span>
          <span className="text-slate-500 dark:text-slate-400">{building.name}</span>
        </p>
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

      {/* ── Aggregate KPI Cards ───────────────────────────────── */}
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
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Chiller Plant Equipment</h3>
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
      </div>

      {/* ── Anomaly Panel ─────────────────────────────────────── */}
      <AnomalyPanel
        data={buildingAnomalyByResolution[anomalyResolution]}
        title="Building Anomaly Detection"
        resolution={anomalyResolution}
        onResolutionChange={setAnomalyResolution}
      />
    </section>
  );
};

export default BuildingPage;
