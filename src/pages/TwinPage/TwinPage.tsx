import { type FC, useCallback, useMemo, useState } from 'react';
import { pvBessData } from '@/data/pvBessData';
import Breadcrumb, { type Crumb } from '@/shared/Breadcrumb';
import ScenarioBanner from '@/shared/ScenarioBanner';
import { type Provenance, type ScenarioKind, type StateSnapshot, type TwinConfig, PROVENANCE_LABEL, SCENARIO_LABEL } from '@/features/spatial-twin/model';
import { generateGraph, validateConfig } from '@/features/spatial-twin/generate';
import { applyScenario, attachReference, emptyState } from '@/features/spatial-twin/bind';
import { expandTo } from '@/features/spatial-twin/layout';
import { DEFAULT_PRESET, type Preset } from '@/features/spatial-twin/presets';
import type { PvBessFocus } from '@/pages/PvBessPage/PvBessPage';
import Configurator from './Configurator';
import PhysicalMap from './PhysicalMap';
import ElectricalTree from './ElectricalTree';
import DetailPanel from './DetailPanel';
import { FillDefs } from './fills';
import { paintFor, type Overlay } from '@/features/spatial-twin/paint';

// ─────────────────────────────────────────────────────────────────────────────
// Digital twin of a described plant.
//
// A visitor says what they have — arrays, inverters, strings, containers — and
// gets a plan, the wiring, and a place to click. Every painted surface also says
// how sure we are: solid means measured there, a hatch means worked out from a
// measurement somewhere else, dots mean estimated from a reference plant, a
// cross-hatch means we made it up for the demo, an outline means we know nothing.
// That legend is the product. The drawing is only how you read it.
// ─────────────────────────────────────────────────────────────────────────────

type View = 'physical' | 'electrical';

interface Props {
  crumbs: Crumb[];
  onOpenAnalytics: (focus: PvBessFocus) => void;
}

const LEGEND: { prov: Provenance; hint: string }[] = [
  { prov: 'MEASURED', hint: 'A sensor at this exact point reported it.' },
  { prov: 'DERIVED', hint: 'Carried from a measurement above or below it, or summed from parts.' },
  { prov: 'ESTIMATED', hint: 'Scaled from another plant’s record. Not this site.' },
  { prov: 'SIMULATED', hint: 'Injected for the demonstration. Never mixed with a record.' },
  { prov: 'UNAVAILABLE', hint: 'Nothing reports here.' },
];

const Legend: FC = () => (
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

const Seg: FC<{ options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string }> = ({ options, value, onChange, label }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-slate-200/80 p-0.5 dark:border-white/10">
    {options.map((o) => (
      <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
        className={`rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${value === o.id ? 'bg-primary text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10.5px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
  </div>
);

const TwinPage: FC<Props> = ({ crumbs, onOpenAnalytics }) => {
  const [config, setConfig] = useState<TwinConfig>(DEFAULT_PRESET.config);
  const [presetId, setPresetId] = useState<Preset['id'] | null>(DEFAULT_PRESET.id);
  const [attached, setAttached] = useState(false);
  const [view, setView] = useState<View>('physical');
  const [overlay, setOverlay] = useState<Overlay>('status');
  // The draft is what the visitor is typing; the last valid draft is what gets drawn,
  // so an invalid keystroke never blanks the plan.
  const [validConfig, setValidConfig] = useState<TwinConfig>(DEFAULT_PRESET.config);
  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const [rawFocusId, setFocusId] = useState<string | null>(null);
  const [rawTreeRoot, setTreeRoot] = useState<'PV' | 'BESS'>('PV');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['PV', 'BESS']));
  const [rawScenario, setScenario] = useState<{ kind: ScenarioKind; targetId: string } | null>(null);

  const problems = useMemo(() => validateConfig(config), [config]);
  const graph = useMemo(() => generateGraph(validConfig), [validConfig]);
  // Ids are read through the current graph: a node that no longer exists simply reads as nothing.
  const selectedId = rawSelectedId && graph.nodes[rawSelectedId] ? rawSelectedId : null;
  const focusId = rawFocusId && graph.nodes[rawFocusId] ? rawFocusId : null;
  const scenario = rawScenario && graph.nodes[rawScenario.targetId] ? rawScenario : null;
  const treeRoot = rawTreeRoot === 'BESS' && graph.nodes.BESS ? 'BESS' : 'PV';

  const base: StateSnapshot = useMemo(() => (attached ? attachReference(graph, pvBessData) : emptyState(graph, pvBessData)), [graph, attached]);
  const snapshot = useMemo(() => applyScenario(graph, base, scenario), [graph, base, scenario]);

  const onChange = (cfg: TwinConfig) => {
    setConfig(cfg);
    setPresetId(null);
    if (validateConfig(cfg).length === 0) setValidConfig(cfg);
  };
  const onPreset = (p: Preset) => { setConfig(p.config); setValidConfig(p.config); setPresetId(p.id); setSelectedId(null); setFocusId(null); setScenario(null); };

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setExpanded((prev) => expandTo(graph, id, prev));
    const n = graph.nodes[id];
    if (n) setTreeRoot(n.domain === 'bess' ? 'BESS' : 'PV');
  }, [graph]);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const meta = pvBessData.meta;
  const c = graph.counts;
  const pvNode = graph.nodes.PV;
  const bessNode = graph.nodes.BESS;

  return (
    <section className="space-y-6">
      <Breadcrumb crumbs={crumbs} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Solar + storage</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Digital twin</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Describe a plant and see it drawn: where each piece sits, what feeds what, and how sure we are about every surface.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Stat label="Solar" value={`${(pvNode.nameplate.dcKw ?? 0).toLocaleString()} kW`} />
          <Stat label="Strings" value={c.strings.toLocaleString()} />
          <Stat label="Modules" value={c.modules.toLocaleString()} />
          {bessNode && <Stat label="Battery" value={`${(bessNode.nameplate.energyKwh ?? 0).toLocaleString()} kWh`} />}
        </div>
      </div>

      {scenario && (
        <ScenarioBanner text={`Scenario — a simulated ${SCENARIO_LABEL[scenario.kind].toLowerCase()} (${scenario.targetId}) is painted onto this plant. Clear it from the detail panel.`} />
      )}

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_296px]">
        <Configurator config={config} presetId={presetId} problems={problems} attached={attached} recordCount={pvBessData.inverterFleet.inverters.length} inverterCount={graph.counts.inverters} onChange={onChange} onPreset={onPreset} onAttach={setAttached} />

        <div className="card-surface min-w-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Seg label="View" value={view} onChange={(v) => setView(v as View)} options={[{ id: 'physical', label: 'Plan' }, { id: 'electrical', label: 'Connections' }]} />
            <div className="flex flex-wrap items-center gap-3">
              {view === 'electrical' && bessNode && (
                <Seg label="System" value={treeRoot} onChange={(v) => setTreeRoot(v as 'PV' | 'BESS')} options={[{ id: 'PV', label: 'Solar' }, { id: 'BESS', label: 'Battery' }]} />
              )}
              <Seg label="Paint by" value={overlay} onChange={(v) => setOverlay(v as Overlay)} options={[{ id: 'status', label: 'Condition' }, { id: 'certainty', label: 'Certainty' }]} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {attached ? `Records: ${snapshot.sourceLabel} · latest reading ${meta.asOf}` : 'No records attached. Nameplates come from your description; every condition is unknown.'}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/70 dark:border-white/10">
            <svg width="0" height="0" aria-hidden className="absolute"><FillDefs prefix="legend" unit={5} /></svg>
            {view === 'physical' ? (
              <PhysicalMap graph={graph} snapshot={snapshot} overlay={overlay} selectedId={selectedId} focusId={focusId} onSelect={select} onFocus={setFocusId} />
            ) : (
              <ElectricalTree graph={graph} snapshot={snapshot} overlay={overlay} rootId={treeRoot} expanded={expanded} selectedId={selectedId} onSelect={select} onToggle={toggle} />
            )}
          </div>
          <div className="mt-3"><Legend /></div>
        </div>

        <div className="lg:col-span-2 xl:col-span-1">
          <DetailPanel graph={graph} snapshot={snapshot} selectedId={selectedId} onSelect={select}
            onScenario={(kind, targetId) => setScenario({ kind, targetId })} onClearScenario={() => setScenario(null)} onOpenAnalytics={onOpenAnalytics} />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        The plan is an engineering layout worked out from your numbers, not a survey. Reference records: {pvBessData.inverterFleet.source}. Reference yield: {pvBessData.pv.site.name}. Modules and cells are counted, never drawn as measured objects, because nothing reports on them individually.
      </p>
    </section>
  );
};

export default TwinPage;
