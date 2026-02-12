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
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200/70 bg-white/90 p-6 text-slate-900 shadow-card transition-transform duration-300 dark:border-white/5 dark:bg-surface dark:text-white ${translateClass} ${desktopTranslate}`}
      >
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Energy</p>
          <p className="text-lg font-semibold">Control Center</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive =
              (item.key === 'dashboard' && activePage === 'dashboard') ||
              (item.key === 'portfolio' && (activePage === 'portfolio' || activePage === 'building' || activePage === 'equipment'));
            const actionable = Boolean(item.actionable);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => (actionable ? onNavigate(item.key) : undefined)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                  isActive
                    ? 'bg-accent/20 text-slate-900 dark:text-white'
                    : actionable
                      ? 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                      : 'cursor-default text-slate-400'
                }`}
                disabled={!actionable}
              >
                <span>{item.label}</span>
                {!actionable && <span className="text-[0.65rem] uppercase tracking-wider text-slate-400">Soon</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
