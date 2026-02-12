import type { FC } from 'react';
import { buildingDetails } from '../data/mockPortfolioData';
import AnomalyPanel from './AnomalyPanel';

interface BuildingPageProps {
  buildingId: string;
  onBack: () => void;
  onNavigateToEquipment: (equipmentId: string) => void;
}

const BuildingPage: FC<BuildingPageProps> = ({ buildingId, onBack, onNavigateToEquipment }) => {
  const detail = buildingDetails[buildingId];

  if (!detail) {
    return (
      <section className="flex h-64 items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Building not found.</p>
      </section>
    );
  }

  const { building, aggregateKPIs, equipment, anomaly } = detail;

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
      <AnomalyPanel data={anomaly} title="Building Anomaly Detection" />
    </section>
  );
};

export default BuildingPage;
