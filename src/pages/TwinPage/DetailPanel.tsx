import { type FC } from 'react';
import { type AssetGraph, type Provenance, type ScenarioKind, type StateSnapshot, LEVEL_LABEL, PROVENANCE_LABEL, SCENARIO_LABEL, SCENARIO_LEVEL, STATUS_LABEL } from '@/features/spatial-twin/model';
import { ancestry } from '@/features/spatial-twin/generate';
import type { PvBessFocus } from '@/pages/PvBessPage/PvBessPage';

// Everything we believe about one node, and why. Every number carries its basis.

interface Props {
  graph: AssetGraph;
  snapshot: StateSnapshot;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onScenario: (kind: ScenarioKind, targetId: string) => void;
  onClearScenario: () => void;
  onOpenAnalytics: (focus: PvBessFocus) => void;
}

const PROV_DOT: Record<Provenance, string> = {
  MEASURED: 'bg-emerald-500',
  DERIVED: 'bg-slate-400',
  ESTIMATED: 'bg-sky-400',
  SIMULATED: 'bg-fuchsia-500',
  UNAVAILABLE: 'border border-slate-400 bg-transparent',
};

export const ProvChip: FC<{ prov: Provenance; title?: string }> = ({ prov, title }) => (
  <span role="note" tabIndex={0} aria-label={title ?? PROVENANCE_LABEL[prov]} title={title ?? PROVENANCE_LABEL[prov]}
    className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
    <span className={`h-1.5 w-1.5 rounded-full ${PROV_DOT[prov]}`} aria-hidden />
    {PROVENANCE_LABEL[prov]}
  </span>
);

const fmtVal = (v: number, unit: string) => {
  const s = Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return unit ? `${s} ${unit}` : s;
};

const DetailPanel: FC<Props> = ({ graph, snapshot, selectedId, onSelect, onScenario, onClearScenario, onOpenAnalytics }) => {
  if (!selectedId || !graph.nodes[selectedId]) {
    return (
      <div className="card-surface p-5 text-sm text-slate-500 dark:text-slate-400">
        <p className="font-medium text-slate-900 dark:text-white">Nothing selected</p>
        <p className="mt-2">Click an array, an inverter or the battery container on the plan, or a box in the wiring view.</p>
      </div>
    );
  }
  const node = graph.nodes[selectedId];
  const state = snapshot.nodes[selectedId];
  const chain = ancestry(graph, selectedId);
  const scenarios = (Object.keys(SCENARIO_LEVEL) as ScenarioKind[]).filter((k) => SCENARIO_LEVEL[k] === node.level);
  const scenarioHere = snapshot.scenario?.targetId === selectedId;
  const analyticsFocus: PvBessFocus = node.domain === 'bess' ? 'bess' : node.level === 'inverter' ? 'inverters' : 'pv';
  const stands = node.standsFor.modules ?? node.standsFor.cells ?? 0;
  const standsWord = node.domain === 'pv' ? 'modules' : 'cells';

  return (
    <div className="card-surface space-y-4 p-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{LEVEL_LABEL[node.level]}</p>
        <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">{node.id}</p>
        <nav aria-label="Belongs to" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          {chain.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>›</span>}
              {id === selectedId ? (
                <span className="text-slate-700 dark:text-slate-200">{graph.nodes[id].label}</span>
              ) : (
                <button type="button" onClick={() => onSelect(id)} className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{graph.nodes[id].label}</button>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="rounded-lg border border-slate-200/70 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{STATUS_LABEL[state.status]}</p>
          <ProvChip prov={state.statusProvenance} />
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{state.statusBasis}</p>
        {state.statusSourceId && (
          <button type="button" onClick={() => onSelect(state.statusSourceId as string)} className="mt-1.5 text-xs font-medium text-slate-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-slate-200">
            Go to the measured node →
          </button>
        )}
      </div>

      {stands > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Stands for <span className="font-medium text-slate-700 dark:text-slate-200">{stands.toLocaleString()} {standsWord}</span>. None is measured on its own{node.domain === 'bess' && graph.config.bess?.cellTelemetry ? '; the BMS reports cells, but no cell-level feed is connected' : ''}.
        </p>
      )}

      <dl className="space-y-2.5">
        {state.metrics.map((m) => (
          <div key={m.key} className="border-t border-slate-200/60 pt-2.5 dark:border-white/5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{m.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{fmtVal(m.value, m.unit)}</dd>
            </div>
            <div className="mt-1 flex items-start gap-2">
              <ProvChip prov={m.provenance} />
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{m.basis}</p>
            </div>
          </div>
        ))}
      </dl>

      <div className="space-y-2 border-t border-slate-200/60 pt-3 dark:border-white/5">
        {scenarios.map((k) => (
          scenarioHere && snapshot.scenario?.kind === k ? (
            <button key={k} type="button" onClick={onClearScenario} className="w-full rounded-lg border border-fuchsia-400/60 px-3 py-2 text-left text-xs font-medium text-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-fuchsia-300">
              Clear the simulated {SCENARIO_LABEL[k].toLowerCase()}
            </button>
          ) : (
            <button key={k} type="button" onClick={() => onScenario(k, selectedId)} className="w-full rounded-lg border border-slate-200/70 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:text-slate-200">
              Simulate: {SCENARIO_LABEL[k].toLowerCase()} here
            </button>
          )
        ))}
        <button type="button" onClick={() => onOpenAnalytics(analyticsFocus)} className="w-full rounded-lg bg-primary px-3 py-2 text-left text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900">
          See the {node.domain === 'bess' ? 'battery' : node.level === 'inverter' ? 'inverter' : 'yearly'} numbers →
        </button>
      </div>
    </div>
  );
};

export default DetailPanel;
