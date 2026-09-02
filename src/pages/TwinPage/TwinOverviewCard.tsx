import { type FC, useMemo, useState } from 'react';
import { pvBessData } from '@/data/pvBessData';
import { generateGraph } from '@/features/spatial-twin/generate';
import { attachReference } from '@/features/spatial-twin/bind';
import { DEFAULT_PRESET } from '@/features/spatial-twin/presets';
import { hourFacts, withHour } from '@/features/spatial-twin/replay';
import PhysicalMap from './PhysicalMap';
import HourScrubber from './HourScrubber';
import { FillDefs } from './fills';
import { HourStat, Legend } from './monitorParts';

// The monitor on the Overview: the plant drawn at one hour of the recorded
// day, with the same scrubber as the full page. Any click on the plan opens
// the full monitor — this card is a door, not a tool.

const fmt0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

const TwinOverviewCard: FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const [hour, setHour] = useState(12);
  const graph = useMemo(() => generateGraph(DEFAULT_PRESET.config), []);
  const base = useMemo(() => attachReference(graph, pvBessData), [graph]);
  const snapshot = useMemo(() => withHour(base, pvBessData, hour), [base, hour]);
  const facts = useMemo(() => hourFacts(pvBessData, hour), [hour]);
  const hours = useMemo(() => pvBessData.dispatch.day.hourly.map((h) => h.hour), []);
  const c = graph.counts;
  const batteryWord = facts.batteryKw > 0 ? 'discharging' : facts.batteryKw < 0 ? 'charging' : 'idle';

  return (
    <div className="card-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Solar + storage</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            {fmt0(graph.nodes.PV.nameplate.dcKw ?? 0)} kW of solar across {c.inverters} inverters, with a {fmt0(graph.nodes.BESS?.nameplate.energyKwh ?? 0)} kWh battery. One recorded day, hour by hour.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900"
        >
          Open the monitor →
        </button>
      </div>

      <div className="mt-4">
        <HourScrubber hours={hours} index={facts.index} onChange={setHour} caption={facts.bandLabel} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="overflow-hidden rounded-lg border border-slate-200/70 dark:border-white/10" style={{ background: 'var(--twin-ground)' }}>
          <svg width="0" height="0" aria-hidden className="absolute"><FillDefs prefix="legend" unit={5} /></svg>
          <PhysicalMap graph={graph} snapshot={snapshot} overlay="status" selectedId={null} focusId={null} onSelect={onOpen} onFocus={onOpen} brightness={facts.pvFraction} charge={facts.socFraction} maxHeight={400} />
        </div>
        <div className="flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <HourStat label="Solar" value={`${fmt0(facts.pvKw)} kW`} sub={`${Math.round(facts.pvFraction * 100)} % of capacity`} prov="DERIVED" />
            <HourStat label="Battery" value={`${fmt0(facts.socPct)} %`} sub={facts.batteryKw === 0 ? 'Idle' : `${batteryWord} at ${fmt0(Math.abs(facts.batteryKw))} kW`} prov="SIMULATED" />
          </div>
          <Legend />
        </div>
      </div>
    </div>
  );
};

export default TwinOverviewCard;
