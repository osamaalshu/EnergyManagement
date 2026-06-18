import { type FC, useEffect, useRef, useState } from 'react';

// A breadcrumb trail where each segment can carry a sibling switcher (the ▾):
// click a segment to go to that level, click the ▾ to jump sideways to a
// sibling (another building / subsystem / unit) without backing out.
export interface CrumbSibling {
  id: string;
  label: string;
  hint?: string;
  active?: boolean;
  onSelect: () => void;
}
export interface Crumb {
  key: string;
  label: string;
  onClick?: () => void;
  siblings?: CrumbSibling[];
}

const Switcher: FC<{ siblings: CrumbSibling[] }> = ({ siblings }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Switch"
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="card-surface absolute left-0 z-50 mt-2 max-h-72 w-60 overflow-y-auto space-y-0.5 p-2 shadow-2xl">
          {siblings.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { s.onSelect(); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-white/5 ${s.active ? 'bg-accent/10 text-accent' : 'text-slate-700 dark:text-slate-200'}`}
            >
              <span className="truncate">{s.label}</span>
              {s.hint && <span className="shrink-0 text-xs text-slate-400">{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Breadcrumb: FC<{ crumbs: Crumb[] }> = ({ crumbs }) => (
  <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
    {crumbs.map((c, i) => {
      const last = i === crumbs.length - 1;
      return (
        <span key={c.key} className="flex items-center gap-1">
          {c.onClick && !last ? (
            <button type="button" onClick={c.onClick} className="rounded px-1 font-medium text-slate-500 transition hover:text-accent dark:text-slate-400 dark:hover:text-white">
              {c.label}
            </button>
          ) : (
            <span className={`px-1 font-semibold ${last ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{c.label}</span>
          )}
          {c.siblings && c.siblings.length > 1 && <Switcher siblings={c.siblings} />}
          {!last && <span className="px-0.5 text-slate-300 dark:text-slate-600">/</span>}
        </span>
      );
    })}
  </nav>
);

export default Breadcrumb;
