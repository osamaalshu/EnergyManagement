import type { FC, ReactNode, SVGProps } from 'react';

import type { ActivePage } from './Sidebar';

interface TopBarProps {
  onToggleSidebar: () => void;
  isEditMode: boolean;
  onEditModeChange: (value: boolean) => void;
  activePage: ActivePage;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

const IconButton = ({ children }: { children: ReactNode }) => (
  <span className="flex items-center justify-center text-current">{children}</span>
);

const SunIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M17.99 17.99l1.79 1.79M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M17.99 6.01l1.79-1.79" />
  </svg>
);

const MoonIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

const TopBar: FC<TopBarProps> = ({
  onToggleSidebar,
  isEditMode,
  onEditModeChange,
  activePage,
  theme,
  onThemeToggle,
}) => {
  const toggleEditMode = () => onEditModeChange(!isEditMode);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-6 py-4 text-slate-900 backdrop-blur transition-colors duration-200 dark:border-white/5 dark:bg-surface-dark/95 dark:text-white">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-900 shadow-sm transition hover:border-slate-400 dark:border-white/10 dark:bg-card-dark dark:text-white"
          aria-label="Toggle sidebar"
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-6 bg-current" />
            <span className="block h-0.5 w-6 bg-current" />
            <span className="block h-0.5 w-6 bg-current" />
          </span>
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">MVP</p>
          <h1 className="text-xl font-semibold">Energy Management Dashboard</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onThemeToggle}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-white text-slate-700 shadow-sm transition hover:border-accent/50 dark:border-white/10 dark:bg-card-dark"
          aria-label="Toggle color theme"
        >
          <IconButton>{theme === 'dark' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}</IconButton>
        </button>
        <div className="rounded-full border border-slate-200/60 px-4 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-200">
          {activePage === 'dashboard' ? 'Dashboard'
            : activePage === 'savings' ? 'Savings'
            : activePage === 'portfolio' ? 'Portfolio'
            : activePage === 'building' ? 'Building'
            : activePage === 'equipment' ? 'Equipment'
            : 'Dashboard'}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">Edit mode</span>
          <button
            type="button"
            onClick={toggleEditMode}
            className={`relative inline-flex h-8 w-14 items-center rounded-full border px-1 transition ${
              isEditMode
                ? 'border-accent/60 bg-accent/30'
                : 'border-slate-200/70 bg-white dark:border-white/10 dark:bg-card-dark'
            } cursor-pointer`}
          >
            <span
              className={`h-6 w-6 rounded-full bg-white shadow transition ${
                isEditMode ? 'translate-x-6 bg-accent text-slate-900' : 'translate-x-0 dark:bg-slate-600'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
