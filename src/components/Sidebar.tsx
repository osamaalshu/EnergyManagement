import type { FC } from 'react';

export type NavigationKey =
  | 'dashboard'
  | 'portfolio'
  | 'detect'
  | 'analyse'
  | 'optimise'
  | 'account'
  | 'apps';

export type ActivePage = 'dashboard' | 'portfolio' | 'building' | 'equipment';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activePage: ActivePage;
  onNavigate: (key: NavigationKey) => void;
}

const navItems: Array<{ key: NavigationKey; label: string; actionable?: boolean }> = [
  { key: 'dashboard', label: 'Overview', actionable: true },
  { key: 'portfolio', label: 'Portfolio', actionable: true },
  { key: 'detect', label: 'Detect' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'optimise', label: 'Optimise' },
  { key: 'account', label: 'Account Settings' },
  { key: 'apps', label: 'Apps Market' },
];

const Sidebar: FC<SidebarProps> = ({ open, onClose, activePage, onNavigate }) => {
  const translateClass = open ? 'translate-x-0' : '-translate-x-full';
  const desktopTranslate = open ? 'lg:translate-x-0' : 'lg:-translate-x-full';

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200/70 bg-white/90 backdrop-blur-md text-slate-900 shadow-card transition-transform duration-300 dark:border-white/5 dark:bg-surface dark:text-white ${translateClass} ${desktopTranslate}`}
      >
        {/* ── Brand header ─────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-4">
          <div className="overflow-hidden rounded-2xl bg-[#F8FAFC] dark:bg-[#1A365D]">
            {/* Light mode logo */}
            <img 
              src="/logo-light.png" 
              alt="Enerlytics" 
              className="mx-auto h-24 w-auto object-contain dark:hidden" 
            />
            {/* Dark mode logo */}
            <img 
              src="/logo-dark.png" 
              alt="Enerlytics" 
              className="mx-auto hidden h-24 w-auto object-contain dark:block" 
            />
          </div>
          <div className="mt-3 border-b border-slate-200/60 dark:border-white/5" />
        </div>

        <nav className="space-y-1 px-4 pb-6">
          {navItems.map((item) => {
            const isActive =
              (item.key === 'dashboard' && activePage === 'dashboard') ||
              (item.key === 'portfolio' && (activePage === 'portfolio' || activePage === 'building' || activePage === 'equipment'));
            const actionable = Boolean(item.actionable);
            const sharedClass = `flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition font-medium`;

            if (!actionable) {
              return (
                <div
                  key={item.key}
                  className={`${sharedClass} cursor-default text-slate-400`}
                  aria-disabled="true"
                >
                  <span>{item.label}</span>
                  <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Soon</span>
                </div>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`${sharedClass} ${
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
