import { type FC, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { productionData } from '@/data/productionData';
import { COOLING_DEFAULTS, estimateCoolingEnergy } from '@/features/production-planning/coolingEnergy';

const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
const round = (v: number, d = 0) => {
  const factor = 10 ** d;
  return Math.round(v * factor) / factor;
};
const STATE_BG: Record<string, string> = { run: 'bg-accent', setup: 'bg-amber-500', idle: 'bg-slate-300 dark:bg-white/20', down: 'bg-rose-500' };

const PlantTelemetryPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const pl = productionData.plant;
  const series = useMemo(() => pl
    ? Object.values(pl.trace.reduce((acc, row) => { (acc[row.hour] ??= { hour: Math.round(row.hour), kw: 0 }).kw += row.kw; return acc; }, {} as Record<number, { hour: number; kw: number }>))
    : [], [pl]);

  const Header = (
    <div className="flex items-center gap-4">
      <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Plant Telemetry</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">A simulated digital twin of the line — what the sensors will stream.</p>
      </div>
    </div>
  );

  if (!pl) {
    return <section className="space-y-6">{Header}<div className="card-surface p-8 text-center text-sm text-slate-500 dark:text-slate-400">No plant run available — run the plant engine to generate telemetry.</div></section>;
  }

  const r = pl.real, i = pl.ideal, e = r.energy_by_state_kwh, tot = r.energy_kwh || 1;
  const runHours = r.hours_by_state?.run ?? (r.makespan_h * r.utilization_run);
  const cooling = estimateCoolingEnergy({ runHours });
  const energyPerUnitInclCooling = r.units > 0 ? round((r.energy_kwh + cooling.coolingKwh) / r.units, 3) : 0;
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {Header}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> SIMULATED</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          ['Availability', `${Math.round(r.availability * 100)}%`],
          ['Downtime', `${num(r.downtime_h)} h`],
          ['Run utilization', `${Math.round(r.utilization_run * 100)}%`],
          ['Makespan', `${num(r.makespan_h)} h`],
          ['Energy', `${num(r.energy_kwh)} kWh`],
          ['Energy/unit (machine)', `${r.kwh_per_unit} kWh`],
          ['Energy/unit (incl. cooling, est.)', `${energyPerUnitInclCooling} kWh`],
        ].map(([label, val]) => (
          <div key={label} className="card-surface p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">{val}</p>
            {label === 'Energy/unit (machine)' && <p className="mt-1 text-[11px] text-slate-400">machine energy is simulated; cooling is an estimated placeholder (chiller physics) until metered.</p>}
          </div>
        ))}
      </div>

      {/* Power-over-time */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Power draw over the run</h3>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 14 }}>
              <XAxis dataKey="hour" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} label={{ value: 'hour', position: 'insideBottom', offset: -6, fill: 'var(--muted-text)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={32} label={{ value: 'kW', angle: -90, position: 'insideLeft', fill: 'var(--muted-text)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number) => [`${num(v)} kW`, 'power']} labelFormatter={(l) => `hour ${l}`} />
              <Area type="stepAfter" dataKey="kw" stroke="#1A365D" fill="#1A365D" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Power is emitted from machine state (run / setup / idle / down) with stochastic breakdowns — not noise on a flat line.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cooling estimate placeholder */}
        <div className="card-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cooling - estimated (placeholder)</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              ESTIMATED
            </span>
          </div>
          <p className="mt-3 font-mono text-sm text-slate-700 dark:text-slate-200">{'Q=flow*cp*dT -> /COP'}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Assumed params: flow {COOLING_DEFAULTS.flowLps} L/s · dT {COOLING_DEFAULTS.deltaTC}C · COP {COOLING_DEFAULTS.cop.toFixed(1)}, air-cooled.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ['thermalKw', `${num(cooling.thermalKw, 1)} kW`],
              ['coolingKw', `${num(cooling.coolingKw, 1)} kW`],
              ['coolingKwh', `${num(cooling.coolingKwh, 0)} kWh`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 p-3 dark:border-white/10">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-400">
            Energy/unit (incl. cooling, est.) = {energyPerUnitInclCooling} kWh/unit.
            Total energy: machine + cooling = {num(r.energy_kwh)} + {num(cooling.coolingKwh)} kWh.
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            becomes measured from MC01 chilled-water supply/return + flow when sensors land (COP calibrated with a temporary chiller-input meter).
          </p>
        </div>

        {/* Energy by state */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Energy by machine state</h3>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">
            {(['run', 'setup', 'idle', 'down'] as const).map((s) => (<div key={s} className={STATE_BG[s]} style={{ width: `${((e[s] || 0) / tot) * 100}%` }} title={`${s}: ${num(e[s] || 0)} kWh`} />))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {(['run', 'setup', 'idle', 'down'] as const).map((s) => (<span key={s} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${STATE_BG[s]}`} />{s} <span className="font-mono">{num(e[s] || 0)}</span> kWh</span>))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Setup, idle and down-time energy is paid-for but makes no product — the waste to attack.</p>
        </div>

        {/* Validation: ideal vs realistic */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Validation — ideal vs realistic</h3>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="py-1">Metric</th><th className="py-1 text-right">Ideal</th><th className="py-1 text-right">With faults</th></tr></thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {[
                ['Availability', `${Math.round(i.availability * 100)}%`, `${Math.round(r.availability * 100)}%`],
                ['Makespan (h)', num(i.makespan_h), num(r.makespan_h)],
                ['Downtime (h)', num(i.downtime_h), num(r.downtime_h)],
                ['Energy / unit', `${i.kwh_per_unit}`, `${r.kwh_per_unit}`],
              ].map(([m, a, b]) => (<tr key={m} className="border-t border-slate-100 dark:border-white/5"><td className="py-1.5">{m}</td><td className="py-1.5 text-right font-mono text-slate-400">{a}</td><td className="py-1.5 text-right font-mono font-semibold">{b}</td></tr>))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-400">Breakdowns (MTBF/MTTR) are modelled. Calibrate them to the client's downtime log and this matches the historical records — closing the validation loop.</p>
        </div>
      </div>

      <p className="text-xs text-slate-400">Generated by the SimPy plant-state engine. Wire the line's sensors and this becomes the live trace; the modelled parameters calibrate to reality and the "simulated" tag drops.</p>
    </section>
  );
};

export default PlantTelemetryPage;
