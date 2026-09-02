import { type FC } from 'react';
import { type Provenance, PROVENANCE_LABEL } from '@/features/spatial-twin/model';
import { paintFor } from '@/features/spatial-twin/paint';

// Pieces shared by the monitor page and its Overview card.

const LEGEND: { prov: Provenance; hint: string }[] = [
  { prov: 'MEASURED', hint: 'A sensor at this exact point reported it.' },
  { prov: 'DERIVED', hint: 'Carried from a measurement above or below it, or summed from parts.' },
  { prov: 'SIMULATED', hint: 'A scenario. Never mixed with a record.' },
  { prov: 'UNAVAILABLE', hint: 'Nothing reports here.' },
];

export const Legend: FC = () => (
  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300" aria-label="How to read the drawing">
    {LEGEND.map((l) => {
      const p = paintFor('legend', l.prov === 'UNAVAILABLE' ? 'no_data' : 'ok', l.prov, 'certainty');
      return (
        <li key={l.prov} className="flex items-center gap-2" title={l.hint}>
          <svg width="26" height="14" aria-hidden><rect x="1" y="1" width="24" height="12" rx="2" fill={p.fill} stroke={p.stroke} strokeDasharray={p.strokeDasharray} /></svg>
          <span>{PROVENANCE_LABEL[l.prov]}</span>
        </li>
      );
    })}
  </ul>
);

export const HourStat: FC<{ label: string; value: string; sub: string; prov: Provenance }> = ({ label, value, sub, prov }) => (
  <div className="card-surface p-4">
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[10.5px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
      <span className="text-[10.5px] text-slate-500 dark:text-slate-400">{PROVENANCE_LABEL[prov]}</span>
    </div>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
  </div>
);
