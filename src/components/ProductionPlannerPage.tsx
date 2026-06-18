import { type FC, useMemo, useState } from 'react';
import { productionData } from '../data/productionData';
import {
  planAll, STRATEGIES, STRATEGY_LABEL, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type Strategy, type SkuParam, type LineParam, type Econ, type StrategyResult,
} from '../lib/productionModel';

// ── design tokens (frontend-design): navy ink + teal accent (brand) +
//    molten-amber for run-time/energy (the extruder's heat), signal trio for fit.
const LANE_COLORS = ['bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500'];
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

const ProductionPlannerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { meta, model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('pilot');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : model.skus;
  const line: LineParam = dataset === 'demo' ? DEMO_LINE : {
    machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw,
    nMachines: model.line.nMachines, machineNames: model.line.machineNames,
  };
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;

  const [demands, setDemands] = useState<Record<string, number>>({});
  const [days, setDays] = useState(365);
  const [hoursPerDay, setHoursPerDay] = useState(24);
  const [machines, setMachines] = useState(model.line.nMachines || 1);
  const [selected, setSelected] = useState<Strategy>('balanced');

  const chooseDataset = (ds: 'pilot' | 'demo') => {
    setDataset(ds);
    setMachines((ds === 'demo' ? DEMO_LINE.nMachines : model.line.nMachines) || 1);
    setDemands({}); setSelected('balanced');
  };

  const plans = useMemo(
    () => planAll(skus, demands, days, machines, line, econ, hoursPerDay),
    [skus, demands, days, machines, line, econ, hoursPerDay]);
  const plan = plans[selected];
  const colorFor = (id: string) => LANE_COLORS[skus.findIndex((s) => s.id === id) % LANE_COLORS.length];
  const setDemand = (id: string, v: string) => setDemands((d) => ({ ...d, [id]: Math.max(0, Math.round(Number(v) || 0)) }));

  // bottleneck = busiest machine
  const bottleneck = plan.lanes.reduce((a, l) => (l.loadH > a.loadH ? l : a), plan.lanes[0]);
  const capH = plan.capacityPerMachineH;
  const field = 'w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white';

  return (
    <section className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Production Planner</h2>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', 'Pilot · 2'], ['demo', 'Full plant · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => chooseDataset(ds)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${dataset === ds ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── VERDICT — the decision, first ─────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${plan.fits ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-rose-300/60 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${plan.fits ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {plan.fits ? '✓ This plan fits' : '✗ This plan misses the deadline'}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {STRATEGY_LABEL[selected]} — finishes in <span className="font-mono">{num(plan.daysNeeded, 1)}</span> days
              <span className="text-base font-normal text-slate-500"> of your {num(days)}</span>
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {plan.fits
                ? `${num(days - plan.daysNeeded, 1)} days to spare. `
                : `Short by ${num(plan.daysNeeded - days, 1)} days — add a machine, add hours/day, or extend the deadline. `}
              Bottleneck: <span className="font-medium">{bottleneck.name}</span> at <span className="font-mono">{Math.round(plan.utilization * 100)}%</span>.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total cost</p>
            <p className="font-mono text-3xl font-semibold text-slate-900 dark:text-white">{num(plan.totalOmr)}<span className="ml-1 text-sm font-normal text-slate-500">OMR</span></p>
            {selected !== 'balanced' && plans.balanced.totalOmr < plan.totalOmr && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Balanced is {num(plan.totalOmr - plans.balanced.totalOmr)} OMR cheaper →</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 1 · ORDER ────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">1 · Your order</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skus.map((s) => (
            <label key={s.id} className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{s.name}</span>
              <input type="number" min={0} value={demands[s.id] ?? s.demand} onChange={(e) => setDemand(s.id, e.target.value)} className={`mt-1 ${field}`} />
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 border-t border-slate-200/60 pt-3 sm:grid-cols-3 dark:border-white/10">
          <label className="block"><span className="text-xs font-medium text-slate-600 dark:text-slate-300">Deadline (days)</span><input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Math.round(Number(e.target.value) || 1)))} className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600 dark:text-slate-300">Hours run / day</span><input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 ${field}`} /></label>
          <label className="block"><span className="text-xs font-medium text-slate-600 dark:text-slate-300">Machines</span><input type="number" min={1} max={6} value={machines} onChange={(e) => setMachines(Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 ${field}`} /></label>
        </div>
      </div>

      {/* ── 2 · DECISION — compare the three, lower is better ─────── */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">2 · Compare strategies <span className="font-normal normal-case text-slate-400">· lower is better · click to choose</span></h3>
        </div>
        <div className="mt-4 grid grid-cols-[140px_repeat(3,1fr)] gap-x-3 gap-y-2 text-sm">
          {/* header row */}
          <div />
          {STRATEGIES.map((st) => (
            <button key={st} type="button" onClick={() => setSelected(st)} className={`rounded-lg px-2 py-2 text-center transition ${selected === st ? 'bg-accent/10 ring-1 ring-accent' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">{STRATEGY_LABEL[st]}</span>
              {st === 'balanced' && <span className="text-[0.6rem] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Recommended</span>}
            </button>
          ))}
          {([
            ['Cost', (r: StrategyResult) => r.totalOmr, 'OMR'],
            ['Finish', (r: StrategyResult) => r.daysNeeded, 'days'],
            ['Stock held', (r: StrategyResult) => r.inventoryUnits, 'units'],
            ['Changeovers', (r: StrategyResult) => r.changeovers, ''],
          ] as const).map(([label, get, unit]) => {
            const vals = STRATEGIES.map((st) => get(plans[st]));
            const max = Math.max(...vals, 1); const best = Math.min(...vals);
            return (
              <CompareRow key={label} label={label} unit={unit}
                cells={STRATEGIES.map((st) => ({ v: get(plans[st]), max, isBest: get(plans[st]) === best, active: selected === st }))} />
            );
          })}
        </div>
      </div>

      {/* ── 3 · THE PLAN — timeline you can read against the deadline ── */}
      <div className="card-surface overflow-hidden p-0">
        <div className="border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">3 · The plan — {STRATEGY_LABEL[selected]}</h3>
        </div>
        <div className="space-y-4 p-5">
          {/* lanes scaled to the deadline; bars that pass the dashed line don't fit */}
          <div className="space-y-2.5">
            {plan.lanes.map((lane) => {
              const over = lane.loadH > capH;
              return (
                <div key={lane.machine} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{lane.name}</span>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
                    <div className="flex h-full">
                      {lane.products.map((pr) => (
                        <div key={pr.id} className={`flex h-full items-center ${colorFor(pr.id)} px-2`} style={{ width: `${Math.min((pr.hours / capH) * 100, 100)}%` }}>
                          <span className="truncate text-[10px] font-semibold text-white">{pr.id}</span>
                        </div>
                      ))}
                    </div>
                    {over && <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-rose-500 px-1 text-[10px] font-semibold text-white">over</span>}
                  </div>
                  <span className={`w-20 shrink-0 text-right font-mono text-xs ${over ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{num(lane.loadH)} h</span>
                </div>
              );
            })}
            {/* deadline marker */}
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="w-24 shrink-0" />
              <span className="flex-1 text-right">▲ deadline = {num(capH)} h ({num(days)} days × {hoursPerDay} h)</span>
              <span className="w-20 shrink-0" />
            </div>
          </div>

          {/* outcomes — only what drives a decision */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Run-time" value={`${num(plan.makespanDays, 1)} d`} sub={`${num(plan.makespanH)} h busiest`} accent="amber" />
            <Stat label="Stock held" value={num(plan.inventoryUnits)} sub={`~${num(plan.daysOfStock, 0)} days demand`} />
            <Stat label="Scrap" value={`${num(plan.scrapKg)} kg`} sub="expected reject" />
            <Stat label="Energy" value={`${num(plan.energyKwh)} kWh`} sub={`≈ ${num(plan.energyOmr)} OMR`} accent="amber" />
          </div>

          {/* per product — what to actually run */}
          <div className="grid gap-2 sm:grid-cols-2">
            {plan.perSku.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
                <span className={`h-7 w-1 shrink-0 rounded-full ${colorFor(p.id)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{p.name}</p>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{num(p.runs)}×{num(p.batch)} units · {plan.lanes[p.machine]?.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{meta.note} Computed live from the line's measured rates; the exact optimiser runs server-side.</p>
    </section>
  );
};

const CompareRow: FC<{ label: string; unit: string; cells: { v: number; max: number; isBest: boolean; active: boolean }[] }> = ({ label, unit, cells }) => (
  <>
    <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">{label}{unit && <span className="ml-1 text-slate-300 dark:text-slate-600">({unit})</span>}</div>
    {cells.map((c, i) => (
      <div key={i} className={`rounded-lg px-2 py-1.5 ${c.active ? 'bg-accent/5' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="mr-2 h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className={`h-full rounded-full ${c.isBest ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/25'}`} style={{ width: `${(c.v / c.max) * 100}%` }} />
          </div>
          <span className={`font-mono text-xs tabular-nums ${c.isBest ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>{num(c.v, label === 'Finish' ? 1 : 0)}</span>
        </div>
      </div>
    ))}
  </>
);

const Stat: FC<{ label: string; value: string; sub: string; accent?: 'amber' }> = ({ label, value, sub, accent }) => (
  <div className="rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-0.5 font-mono text-lg font-semibold ${accent === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{value}</p>
    <p className="text-[10px] text-slate-400">{sub}</p>
  </div>
);

export default ProductionPlannerPage;
