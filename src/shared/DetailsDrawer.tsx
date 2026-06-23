import { useState, type FC, type ReactNode } from 'react';
export const DetailsDrawer: FC<{ title?: string; children: ReactNode; defaultOpen?: boolean }> = ({ title = 'Details & evidence', children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface overflow-hidden p-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</span>
        <span className="text-slate-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-6 border-t border-slate-200/60 p-5 dark:border-white/10">{children}</div>}
    </div>
  );
};
export default DetailsDrawer;
