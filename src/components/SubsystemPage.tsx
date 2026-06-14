import type { FC } from 'react';
import { equipmentDetails } from '../data/mockPortfolioData';
import type { LeafRoute, NavSite, NavSubsystem } from '../lib/portfolioNav';
import Breadcrumb, { type Crumb } from './Breadcrumb';

interface SubsystemPageProps {
  crumbs: Crumb[];
  site: NavSite;
  subsystem: NavSubsystem;
  onBack: () => void;
  onNavigateToEquipment: (equipId: string, route: LeafRoute) => void;
}

const statusPill: Record<string, string> = {
  running: 'bg-emerald-400/20 text-emerald-500',
  off: 'bg-slate-400/20 text-slate-400',
  warning: 'bg-red-400/20 text-red-400',
};
const statusDot: Record<string, string> = { running: 'bg-emerald-400', off: 'bg-slate-400', warning: 'bg-red-400' };
const statusLabel: Record<string, string> = { running: 'Running', off: 'Off', warning: 'Warning' };

const SubsystemPage: FC<SubsystemPageProps> = ({ crumbs, site, subsystem, onBack, onNavigateToEquipment }) => (
  <section className="space-y-6">
    <Breadcrumb crumbs={crumbs} />

    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{subsystem.label}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{site.name} · {subsystem.equipment.length} {subsystem.equipment.length === 1 ? 'unit' : 'units'}</p>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subsystem.equipment.map((eq) => {
        const detail = equipmentDetails[eq.id]?.equipment;
        const isWarning = eq.status === 'warning';
        return (
          <button
            key={eq.id}
            type="button"
            onClick={() => onNavigateToEquipment(eq.id, eq.route)}
            className={`card-surface flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl ${isWarning ? 'border-red-400/30' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-white">{eq.name}</span>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${statusPill[eq.status]}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot[eq.status]}`} />
                  {statusLabel[eq.status]}
                </span>
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
            {detail && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white">{detail.primaryValue}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{detail.primaryUnit}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  </section>
);

export default SubsystemPage;
