import type { FC } from 'react';

interface TopBarProps {
  onToggleSidebar: () => void;
  isEditMode: boolean;
  onEditModeChange: (value: boolean) => void;
  activePage: 'dashboard' | 'savings';
}

const TopBar: FC<TopBarProps> = ({ onToggleSidebar, isEditMode, onEditModeChange, activePage }) => {
  const toggleEditMode = () => onEditModeChange(!isEditMode);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-surface-dark/95 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-card text-white hover:border-white/30"
          aria-label="Toggle sidebar"
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
            <span className="block h-0.5 w-6 bg-white" />
          </span>
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">MVP</p>
          <h1 className="text-xl font-semibold text-white">Energy Management Dashboard</h1>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300">
          {activePage === 'dashboard' ? 'Dashboard' : 'Savings'}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Edit mode</span>
          <button
            type="button"
            onClick={toggleEditMode}
            className={`relative inline-flex h-8 w-14 items-center rounded-full border border-white/10 px-1 transition ${
              isEditMode ? 'bg-accent/30' : 'bg-card'
            } ${activePage === 'dashboard' ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
            disabled={activePage !== 'dashboard'}
          >
            <span
              className={`h-6 w-6 rounded-full bg-white transition ${
                isEditMode ? 'translate-x-6 bg-accent' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
