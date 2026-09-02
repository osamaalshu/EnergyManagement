import { type FC, useCallback, useMemo, useState } from 'react';
import { pvBessData } from '@/data/pvBessData';
import Breadcrumb, { type Crumb } from '@/shared/Breadcrumb';
import ScenarioBanner from '@/shared/ScenarioBanner';
import { DataFreshness } from '@/shared/Provenance';
import { type ScenarioKind, SCENARIO_LABEL } from '@/features/spatial-twin/model';
import { generateGraph } from '@/features/spatial-twin/generate';
import { applyScenario, attachReference } from '@/features/spatial-twin/bind';
import { expandTo } from '@/features/spatial-twin/layout';
import { DEFAULT_PRESET } from '@/features/spatial-twin/presets';
import { hourFacts, withHour } from '@/features/spatial-twin/replay';
import type { Overlay } from '@/features/spatial-twin/paint';
import type { PvBessFocus } from '@/pages/PvBessPage/PvBessPage';
import PhysicalMap from './PhysicalMap';
import ElectricalTree from './ElectricalTree';
import DetailPanel from './DetailPanel';
import HourScrubber from './HourScrubber';
import { FillDefs } from './fills';
import { HourStat, Legend } from './monitorParts';

// ─────────────────────────────────────────────────────────────────────────────
// Solar + storage monitor.
//
// The plant our records describe, drawn as a plan and as its wiring, with one
// recorded day replayed hour by hour. Every painted surface also says how sure
// we are: solid = measured there, hatch = worked out from a measurement
// elsewhere, cross-hatch = a scenario, outline = nothing reports. Click anything
// to see what we know about it and how we know it.
// ─────────────────────────────────────────────────────────────────────────────

type View = 'physical' | 'electrical';

interface Props {
  crumbs: Crumb[];
  onOpenAnalytics: (focus: PvBessFocus) => void;
}

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

const fmt0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

const TwinPage: FC<Props> = ({ crumbs, onOpenAnalytics }) => {
  const [view, setView] = useState<View>('physical');
  const [overlay, setOverlay] = useState<Overlay>('status');
  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const [rawFocusId, setFocusId] = useState<string | null>(null);
  const [rawTreeRoot, setTreeRoot] = useState<'PV' | 'BESS'>('PV');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['PV', 'BESS']));
  const [scenario, setScenario] = useState<{ kind: ScenarioKind; targetId: string } | null>(null);
  const [hour, setHour] = useState(12);

  const graph = useMemo(() => generateGraph(DEFAULT_PRESET.config), []);
  const selectedId = rawSelectedId && graph.nodes[rawSelectedId] ? rawSelectedId : null;
  const focusId = rawFocusId && graph.nodes[rawFocusId] ? rawFocusId : null;
  const treeRoot = rawTreeRoot === 'BESS' && graph.nodes.BESS ? 'BESS' : 'PV';

  const base = useMemo(() => attachReference(graph, pvBessData), [graph]);
  const withScenario = useMemo(() => applyScenario(graph, base, scenario), [graph, base, scenario]);
  const snapshot = useMemo(() => withHour(withScenario, pvBessData, hour), [withScenario, hour]);
  const facts = useMemo(() => hourFacts(pvBessData, hour), [hour]);
  const hours = useMemo(() => pvBessData.dispatch.day.hourly.map((h) => h.hour), []);

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

  const c = graph.counts;
  const pvNode = graph.nodes.PV;
  const bessNode = graph.nodes.BESS;
  const day = pvBessData.dispatch.day;
  const batteryWord = facts.batteryKw > 0 ? 'discharging' : facts.batteryKw < 0 ? 'charging' : 'idle';

  return (
    <section className="space-y-6">
      <Breadcrumb crumbs={crumbs} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Solar + storage</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Solar + storage monitor</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            {fmt0(pvNode.nameplate.dcKw ?? 0)} kW of solar across {c.inverters} inverters and {c.strings} strings{bessNode ? `, with a ${fmt0(bessNode.nameplate.energyKwh ?? 0)} kWh battery` : ''}.
            One recorded day, hour by hour. Click anything to see what we know about it and how we know it.
          </p>
        </div>
        <DataFreshness meta={pvBessData.meta} />
      </div>

      {/* ── The hour ────────────────────────────────────────────── */}
      <div className="card-surface p-4">
        <HourScrubber hours={hours} index={facts.index} onChange={setHour} caption={`${facts.bandLabel} · ${facts.rateBz} Bz/kWh`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HourStat label="Solar" value={`${fmt0(facts.pvKw)} kW`} sub={`${Math.round(facts.pvFraction * 100)} % of capacity`} prov="DERIVED" />
        <HourStat label="Site load" value={`${fmt0(facts.loadKw)} kW`} sub="What the site is using" prov="MEASURED" />
        <HourStat label="From the grid" value={`${fmt0(facts.gridKw)} kW`} sub={facts.gridKw < facts.loadKw ? 'Solar and battery cover the rest' : 'Everything comes from the grid'} prov="SIMULATED" />
        <HourStat label="Battery" value={`${fmt0(facts.socPct)} %`} sub={facts.batteryKw === 0 ? 'Idle' : `${batteryWord} at ${fmt0(Math.abs(facts.batteryKw))} kW`} prov="SIMULATED" />
      </div>

      {scenario && (
        <ScenarioBanner text={`Scenario — a simulated ${SCENARIO_LABEL[scenario.kind].toLowerCase()} (${scenario.targetId}) is painted onto this plant. Clear it from the panel on the right.`} />
      )}

      {/* ── The plant ───────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card-surface min-w-0 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Seg label="View" value={view} onChange={(v) => setView(v as View)} options={[{ id: 'physical', label: 'Plan' }, { id: 'electrical', label: 'Wiring' }]} />
            <div className="flex flex-wrap items-center gap-3">
              {view === 'electrical' && bessNode && (
                <Seg label="System" value={treeRoot} onChange={(v) => setTreeRoot(v as 'PV' | 'BESS')} options={[{ id: 'PV', label: 'Solar' }, { id: 'BESS', label: 'Battery' }]} />
              )}
              <Seg label="Colour by" value={overlay} onChange={(v) => setOverlay(v as Overlay)} options={[{ id: 'status', label: 'Condition' }, { id: 'certainty', label: 'How sure' }]} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Rows dim with the hour's solar output; the battery racks fill with charge. Inverters carry a year of records; everything below them is worked out from those.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/70 dark:border-white/10" style={{ background: 'var(--twin-ground)' }}>
            <svg width="0" height="0" aria-hidden className="absolute"><FillDefs prefix="legend" unit={5} /></svg>
            {view === 'physical' ? (
              <PhysicalMap graph={graph} snapshot={snapshot} overlay={overlay} selectedId={selectedId} focusId={focusId} onSelect={select} onFocus={setFocusId} brightness={facts.pvFraction} charge={facts.socFraction} />
            ) : (
              <ElectricalTree graph={graph} snapshot={snapshot} overlay={overlay} rootId={treeRoot} expanded={expanded} selectedId={selectedId} onSelect={select} onToggle={toggle} />
            )}
          </div>
          <div className="mt-3"><Legend /></div>
        </div>

        <DetailPanel graph={graph} snapshot={snapshot} selectedId={selectedId} onSelect={select}
          onScenario={(kind, targetId) => setScenario({ kind, targetId })} onClearScenario={() => setScenario(null)} onOpenAnalytics={onOpenAnalytics} />
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        The day: solar is the measured shape from {pvBessData.pv.site.location} on {day.pvDate}, scaled to this plant; the site load is a measured chiller plant on {day.loadDate}; the battery is a scheduled scenario, not a real battery. Inverter records: {pvBessData.inverterFleet.source}. The plan is an engineering layout worked out from the plant's size, not a survey. Modules and cells are counted, never drawn as measured, because nothing reports on them one by one.
      </p>
    </section>
  );
};

export default TwinPage;
