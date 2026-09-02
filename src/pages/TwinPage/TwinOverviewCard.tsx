import { type FC, useMemo } from 'react';
import { pvBessData } from '@/data/pvBessData';
import { generateGraph } from '@/features/spatial-twin/generate';
import { attachReference } from '@/features/spatial-twin/bind';
import { DEFAULT_PRESET } from '@/features/spatial-twin/presets';
import { PROVENANCE_LABEL, type Provenance } from '@/features/spatial-twin/model';
import { paintFor } from '@/features/spatial-twin/paint';
import PhysicalMap from './PhysicalMap';
import { FillDefs } from './fills';

// The twin on the Overview: the default plant drawn with the reference records
// attached, so the drawing is coloured and the legend has something to explain.
// Any click on the plan opens the full page — this card is a door, not a tool.

const LEGEND: Provenance[] = ['MEASURED', 'DERIVED', 'SIMULATED', 'UNAVAILABLE'];

const TwinOverviewCard: FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const graph = useMemo(() => generateGraph(DEFAULT_PRESET.config), []);
  const snapshot = useMemo(() => attachReference(graph, pvBessData), [graph]);
  const c = graph.counts;
  const dcKw = graph.nodes.PV.nameplate.dcKw ?? 0;
  const bessKwh = graph.nodes.BESS?.nameplate.energyKwh;

  return (
    <div className="card-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Digital twin</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            Describe a solar and storage plant and see it drawn: where each piece sits, what feeds what, and how sure we are about every surface.
            This one is the {DEFAULT_PRESET.label.toLowerCase()} preset with the reference plant's inverter records attached.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900"
        >
          Open the digital twin →
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-hidden rounded-lg border border-slate-200/70 dark:border-white/10">
          <svg width="0" height="0" aria-hidden className="absolute"><FillDefs prefix="legend" unit={5} /></svg>
          <PhysicalMap graph={graph} snapshot={snapshot} overlay="status" selectedId={null} focusId={null} onSelect={onOpen} onFocus={onOpen} />
        </div>
        <div className="flex flex-col justify-between gap-4">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            {[
              ['Solar', `${dcKw.toLocaleString()} kW`],
              ['Strings', c.strings.toLocaleString()],
              ['Modules', c.modules.toLocaleString()],
              ...(bessKwh ? [['Battery', `${bessKwh.toLocaleString()} kWh`]] : []),
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10.5px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300" aria-label="How to read the drawing">
            {LEGEND.map((prov) => {
              const p = paintFor('legend', prov === 'UNAVAILABLE' ? 'no_data' : 'ok', prov, 'certainty');
              return (
                <li key={prov} className="flex items-center gap-2">
                  <svg width="26" height="14" aria-hidden><rect x="1" y="1" width="24" height="12" rx="2" fill={p.fill} stroke={p.stroke} strokeDasharray={p.strokeDasharray} /></svg>
                  <span>{PROVENANCE_LABEL[prov]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TwinOverviewCard;
