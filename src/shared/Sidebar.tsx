import { type FC, useMemo, useState } from 'react';
import { navSites, type LeafRoute } from '@/lib/portfolioNav';

export type ActivePage = 'dashboard' | 'portfolio' | 'building' | 'subsystem' | 'equipment' | 'tariff' | 'compressor' | 'pvbess' | 'analyse' | 'production' | 'scrap' | 'plant' | 'delivery';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activePage: ActivePage;
  selectedSiteId: string | null;
  selectedSubsystemId: string | null;
  selectedEquipmentId: string | null;
  onOverview: () => void;
  onPortfolio: () => void;
  onSite: (siteId: string) => void;
  onSubsystem: (siteId: string, subId: string) => void;
  onEquip: (equipId: string, route: LeafRoute) => void;
  onAnalyse: () => void;
  onProduction: () => void;
  onScrap: () => void;
  onPlant: () => void;
  onDelivery: () => void;
}

// "Analyse" is a live workspace; the rest are upcoming.
const SOON_BEFORE = ['Detect'];
const SOON_AFTER = ['Optimise', 'Account Settings', 'Apps Market'];

const Chevron: FC<{ open: boolean }> = ({ open }) => (
  <svg className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
  </svg>
);

const statusDot: Record<string, string> = { running: 'bg-emerald-400', off: 'bg-slate-400', warning: 'bg-red-400' };

const Sidebar: FC<SidebarProps> = ({
  open, onClose, activePage,
  selectedSiteId, selectedSubsystemId, selectedEquipmentId,
  onOverview, onPortfolio, onSite, onSubsystem, onEquip, onAnalyse, onProduction, onScrap, onPlant, onDelivery,
}) => {
  const translateClass = open ? 'translate-x-0' : '-translate-x-full';
  const desktopTranslate = open ? 'lg:translate-x-0' : 'lg:-translate-x-full';

  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [analyseOpen, setAnalyseOpen] = useState(true);

  // Merge user toggles with the active path so you always see where you are.
  const visibleExpandedSites = useMemo(() => {
    const next = new Set(expandedSites);
    if (selectedSiteId) next.add(selectedSiteId);
    return next;
  }, [expandedSites, selectedSiteId]);
  const visibleExpandedSubs = useMemo(() => {
    const next = new Set(expandedSubs);
    if (selectedSiteId && selectedSubsystemId) next.add(`${selectedSiteId}:${selectedSubsystemId}`);
    return next;
  }, [expandedSubs, selectedSiteId, selectedSubsystemId]);

  const toggleSite = (id: string) => setExpandedSites((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleSub = (key: string) => setExpandedSubs((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const onSitePage = activePage === 'building' || activePage === 'subsystem' || activePage === 'equipment' || activePage === 'compressor';

  const rowBase = 'flex w-full items-center gap-2 rounded-lg py-2 pr-2 text-left text-sm transition';
  const activeRow = 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white font-medium';
  const idleRow = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5';

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col border-r border-slate-200/70 bg-white/90 p-6 text-slate-900 shadow-card backdrop-blur-md transition-transform duration-300 dark:border-white/5 dark:bg-surface dark:text-white ${translateClass} ${desktopTranslate}`}
      >
        <div className="mb-6 flex flex-col items-center">
          <img src="/logo-light.png" alt="Enerlytics" className="h-20 w-auto object-contain dark:hidden" />
          <img src="/logo-dark.png" alt="Enerlytics" className="hidden h-20 w-auto rounded-lg object-contain mix-blend-lighten dark:block" />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {/* Overview */}
          <button type="button" onClick={onOverview} className={`${rowBase} px-3 ${activePage === 'dashboard' ? activeRow : idleRow}`}>
            <span>Overview</span>
          </button>

          {/* Portfolio → Sites → Subsystems → Equipment */}
          <button type="button" onClick={onPortfolio} className={`${rowBase} px-3 ${activePage === 'portfolio' ? activeRow : idleRow}`}>
            <span>Portfolio</span>
          </button>

          <div className="space-y-0.5 pb-2">
            {navSites.map((site) => {
              const siteOpen = visibleExpandedSites.has(site.id);
              const siteActive = onSitePage && selectedSiteId === site.id;
              const siteWarnings = site.subsystems.reduce((n, s) => n + s.warnings, 0);
              return (
                <div key={site.id}>
                  <div className={`${rowBase} pl-3 ${siteActive && !selectedSubsystemId ? activeRow : idleRow}`}>
                    <button type="button" onClick={() => toggleSite(site.id)} aria-label="Expand" className="flex h-5 w-5 items-center justify-center">
                      <Chevron open={siteOpen} />
                    </button>
                    <button type="button" onClick={() => onSite(site.id)} className="flex flex-1 items-center justify-between gap-2 truncate">
                      <span className="truncate">{site.name}</span>
                      {siteWarnings > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />}
                    </button>
                  </div>

                  {siteOpen && site.subsystems.map((sub) => {
                    const key = `${site.id}:${sub.id}`;
                    const subOpen = visibleExpandedSubs.has(key);
                    const subActive = siteActive && selectedSubsystemId === sub.id;
                    return (
                      <div key={key}>
                        <div className={`${rowBase} pl-8 ${subActive && !selectedEquipmentId ? activeRow : idleRow}`}>
                          <button type="button" onClick={() => toggleSub(key)} aria-label="Expand" className="flex h-5 w-5 items-center justify-center">
                            <Chevron open={subOpen} />
                          </button>
                          <button type="button" onClick={() => onSubsystem(site.id, sub.id)} className="flex flex-1 items-center justify-between gap-2 truncate">
                            <span className="truncate">{sub.label}</span>
                            <span className="shrink-0 text-xs text-slate-400">{sub.equipment.length}</span>
                          </button>
                        </div>

                        {subOpen && sub.equipment.map((eq) => {
                          const eqActive = selectedEquipmentId === eq.id && onSitePage;
                          return (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => onEquip(eq.id, eq.route)}
                              className={`${rowBase} pl-[3.25rem] ${eqActive ? activeRow : idleRow}`}
                            >
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[eq.status]}`} />
                              <span className="truncate">{eq.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Workspaces — Analyse is live; the rest are upcoming */}
          <div className="space-y-1 border-t border-slate-200/70 pt-2 dark:border-white/5">
            {SOON_BEFORE.map((label) => (
              <div key={label} className={`${rowBase} cursor-default px-3 text-slate-400`} aria-disabled="true">
                <span>{label}</span>
                <span className="ml-auto text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Soon</span>
              </div>
            ))}

            <div>
              <div className={`${rowBase} pl-3 ${['analyse', 'production', 'scrap', 'delivery'].includes(activePage) ? activeRow : idleRow}`}>
                <button type="button" onClick={() => setAnalyseOpen((o) => !o)} aria-label="Expand" className="flex h-5 w-5 items-center justify-center">
                  <Chevron open={analyseOpen} />
                </button>
                <button type="button" onClick={onAnalyse} className="flex flex-1 items-center justify-between gap-2">
                  <span>Analyse</span>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">New</span>
                </button>
              </div>
              {analyseOpen && (
                <>
                  <button type="button" onClick={onDelivery} className={`${rowBase} pl-8 ${activePage === 'delivery' ? activeRow : idleRow}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="truncate">Delivery View</span>
                  </button>
                  <button type="button" onClick={onProduction} className={`${rowBase} pl-8 ${activePage === 'production' ? activeRow : idleRow}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="truncate">Production Planner</span>
                  </button>
                  <button type="button" onClick={onScrap} className={`${rowBase} pl-8 ${activePage === 'scrap' ? activeRow : idleRow}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <span className="truncate">Scrap Focus</span>
                  </button>
                  <div className={`${rowBase} cursor-default pl-8 text-slate-400`} aria-disabled="true">
                    <span className="text-xs">More coming soon</span>
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={onPlant} className={`${rowBase} px-3 ${activePage === 'plant' ? activeRow : idleRow}`}>
              <span>Validation Lab</span>
            </button>

            {SOON_AFTER.map((label) => (
              <div key={label} className={`${rowBase} cursor-default px-3 text-slate-400`} aria-disabled="true">
                <span>{label}</span>
                <span className="ml-auto text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Soon</span>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
