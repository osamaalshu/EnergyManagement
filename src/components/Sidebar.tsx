import type { FC } from 'react';

export type NavigationKey =
  | 'dashboard'
  | 'savings'
  | 'detect'
  | 'analyse'
  | 'optimise'
  | 'account'
  | 'apps';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activePage: 'dashboard' | 'savings';
  onNavigate: (key: NavigationKey) => void;
}

const navItems: Array<{ key: NavigationKey; label: string; actionable?: boolean }> = [
  { key: 'dashboard', label: 'Dashboards', actionable: true },
  { key: 'savings', label: 'Savings', actionable: true },
  { key: 'detect', label: 'Detect' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'optimise', label: 'Optimise' },
  { key: 'account', label: 'Account Settings' },
  { key: 'apps', label: 'Apps Market' },
];

const Sidebar: FC<SidebarProps> = ({ open, onClose, activePage, onNavigate }) => {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/5 bg-surface p-6 shadow-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Energy</p>
          <p className="text-lg font-semibold text-white">Control Center</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive =
              (item.key === 'dashboard' && activePage === 'dashboard') ||
              (item.key === 'savings' && activePage === 'savings');
            const actionable = Boolean(item.actionable);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => (actionable ? onNavigate(item.key) : undefined)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                  isActive
                    ? 'bg-accent/20 text-white'
                    : actionable
                      ? 'text-slate-300 hover:bg-white/5'
                      : 'text-slate-500 cursor-default'
                }`}
                disabled={!actionable}
              >
                <span>{item.label}</span>
                {!actionable && <span className="text-[0.65rem] uppercase tracking-wider text-slate-500">Soon</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
