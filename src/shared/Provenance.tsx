import { type FC } from 'react';
import type { DatasetMeta } from '@/types/portfolio';
import { isLiveDataset } from '@/lib/datasetFreshness';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtMonthYear(iso: string): string {
  if (!iso || iso.length < 7) return iso || '—';
  const y = iso.substring(0, 4);
  const m = parseInt(iso.substring(5, 7), 10);
  return `${MONTHS[m - 1] ?? '?'} ${y}`;
}
const fmtRange = (m: DatasetMeta) => `${fmtMonthYear(m.coverageStart)} – ${fmtMonthYear(m.asOf)}`;

const Chip: FC<{ dot: string; label: string; title: string }> = ({ dot, label, title }) => (
  // Keyboard-focusable + the full provenance in `aria-label` (not just `title`)
  // so screen-reader and keyboard users get the detail, not mouse-hover only.
  <span
    role="note"
    tabIndex={0}
    aria-label={title}
    title={title}
    className="inline-flex cursor-default select-none items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-light dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:focus-visible:ring-offset-surface-dark"
  >
    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
    {label}
  </span>
);

/**
 * One understated, global data-provenance indicator.
 *
 * Rule: demo data may look polished and representative, but it must never read
 * as live client data. The full dataset period is exposed on hover, not shouted
 * across every card.
 */
export const DataFreshness: FC<{ meta: DatasetMeta }> = ({ meta }) => {
  const range = fmtRange(meta);

  if (meta.mode === 'demo') {
    return <Chip dot="bg-amber-400" label="Demo data" title={`Demonstration build · sample dataset ${range} · not a live feed`} />;
  }
  if (meta.mode === 'historical') {
    return (
      <Chip
        dot="bg-slate-400"
        label={`Latest available · ${fmtMonthYear(meta.asOf)}`}
        title={`Historical dataset ${range} · not a live feed`}
      />
    );
  }
  // live
  if (isLiveDataset(meta)) {
    return <Chip dot="bg-emerald-400" label="Live" title={`Live feed · latest reading ${meta.asOf}`} />;
  }
  return <Chip dot="bg-amber-400" label={`As of ${fmtMonthYear(meta.asOf)}`} title={`Live feed paused · latest reading ${meta.asOf} (stale)`} />;
};

/**
 * One-line tariff-basis disclosure. `text` MUST come from `tariffBasis`
 * (derived from `enrichedData.meta`) — never hand-author the wording in a page.
 * Keeps a CRT bill from reading as a historical invoice.
 */
export const TariffBasis: FC<{ text: string; className?: string }> = ({ text, className }) => (
  <span role="note" className={`inline-flex items-start gap-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 ${className ?? ''}`}>
    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
    {text}
  </span>
);
