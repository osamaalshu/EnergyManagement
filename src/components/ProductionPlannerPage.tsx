import { type FC, useMemo, useState } from 'react';
import { productionData } from '../data/productionData';
import {
  planAll, STRATEGIES, STRATEGY_LABEL, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type Strategy, type SkuParam, type LineParam, type Econ,
} from '../lib/productionModel';

const LANE_COLORS = ['bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500'];
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

const STRATEGY_BLURB: Record<Strategy, string> = {
  mto: 'Small, frequent runs. Least stock on hand, but the most changeovers.',
  balanced: 'The economic sweet spot — lowest total cost.',
  mts: 'Few large runs. Fewest changeovers, but you carry more stock.',
};

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
    setDemands({});
    setSelected('balanced');
  };

  const plans = useMemo(
    () => planAll(skus, demands, days, machines, line, econ, hoursPerDay),
    [skus, demands, days, machines, line, econ, hoursPerDay]);
  const plan = plans[selected];
  const colorFor = (id: string) => LANE_COLORS[skus.findIndex((s) => s.id === id) % LANE_COLORS.length];

  const setDemand = (id: string, v: string) =>
    setDemands((d) => ({ ...d, [id]: Math.max(0, Math.round(Number(v) || 0)) }));

  const field = 'w-full rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white';

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Production Planner</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Enter what you need to make — see the best way to run it.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pilot · demo
        </span>
      </div>

      {/* ── INPUTS ───────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">1 · What do you need to produce?</h3>
          <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
            {([['pilot', 'Pilot · 2 products'], ['demo', 'Full operation · 12 (demo)']] as const).map(([ds, label]) => (
              <button key={ds} type="button" onClick={() => chooseDataset(ds)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${dataset === ds ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skus.map((s) => (
            <label key={s.id} className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
              <div className="mt-1 flex items-center gap-2">
                <input type="number" min={0} value={demands[s.id] ?? s.demand} onChange={(e) => setDemand(s.id, e.target.value)} className={field} />
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">units</span>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 border-t border-slate-200/60 pt-4 sm:grid-cols-3 dark:border-white/10">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Time available</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Math.round(Number(e.target.value) || 1)))} className={field} />
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">days</span>
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hours run per day</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={field} />
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">h/day</span>
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Machines available</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={1} max={6} value={machines} onChange={(e) => setMachines(Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={field} />
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">in parallel</span>
            </div>
          </label>
        </div>
      </div>

      {/* ── STRATEGY COMPARISON ──────────────────────────────────── */}
      <div>
        <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">2 · Pick a strategy</h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Make-to-order keeps stock low; make-to-stock cuts changeovers. Balanced is the cheapest overall.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {STRATEGIES.map((st) => {
            const r = plans[st];
            const active = st === selected;
            const recommended = st === 'balanced';
            return (
              <button key={st} type="button" onClick={() => setSelected(st)}
                className={`card-surface p-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${active ? 'ring-2 ring-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{STRATEGY_LABEL[st]}</span>
                  {recommended && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Recommended</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{STRATEGY_BLURB[st]}</p>
                <div className="mt-4 space-y-1.5 text-sm">
                  <Row label="Total cost" value={`${num(r.totalOmr)} OMR`} strong />
                  <Row label="Run-time" value={`${num(r.makespanDays, 1)} days`} />
                  <Row label="Changeovers" value={`${num(r.changeovers)}`} />
                  <Row label="Stock held" value={`${num(r.inventoryUnits)} units`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SELECTED PLAN ────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden p-0">
        <div className="border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 dark:border-white/10 dark:from-white/5 dark:to-white/0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">3 · Your plan — {STRATEGY_LABEL[selected]}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Finishes in <strong>{num(plan.makespanDays, 1)} days</strong> ({num(plan.makespanH)} h of run-time across {machines} machine{machines > 1 ? 's' : ''}).</p>
        </div>
        <div className="space-y-5 p-6">
          {/* does it fit in the time available? */}
          <div className={`rounded-xl px-4 py-3 text-sm ${plan.fits ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200'}`}>
            <span className="font-semibold">Run-time: {num(plan.makespanH)} h on the busiest machine</span> · {num(plan.totalMachineH)} machine-hours total.
            At {hoursPerDay} h/day → <strong>{num(plan.daysNeeded, 1)} days</strong>; you have {num(days)} →{' '}
            {plan.fits
              ? `fits, ${num(days - plan.daysNeeded, 1)} days to spare`
              : `short by ${num(plan.daysNeeded - days, 1)} days — add machines, hours, or time`}.
            {' '}Busiest machine {Math.round(plan.utilization * 100)}% utilised.
          </div>

          {/* machine lanes */}
          <div className="space-y-3">
            {plan.lanes.map((lane) => {
              const pct = plan.makespanH ? Math.max((lane.loadH / plan.makespanH) * 100, 2) : 0;
              return (
                <div key={lane.machine} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{lane.name}</span>
                  <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5">
                    <div className="flex h-full">
                      {lane.products.map((pr) => (
                        <div key={pr.id} className={`flex h-full items-center ${colorFor(pr.id)} px-2`} style={{ width: `${(pr.hours / plan.makespanH) * 100}%` }}>
                          <span className="truncate text-[11px] font-semibold text-white">{pr.id}</span>
                        </div>
                      ))}
                    </div>
                    {pct < 2 && <span className="absolute inset-0 flex items-center pl-3 text-xs text-slate-400">idle</span>}
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{num(lane.loadH)} h</span>
                </div>
              );
            })}
          </div>

          {/* outcomes in plain language */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total cost" value={`${num(plan.totalOmr)} OMR`} sub="energy + stock + scrap" />
            <Stat label="Stock held" value={`${num(plan.inventoryUnits)} units`} sub={`~${num(plan.daysOfStock, 0)} days of demand`} />
            <Stat label="Scrap" value={`${num(plan.scrapKg)} kg`} sub="expected reject" />
            <Stat label="Energy" value={`${num(plan.energyKwh)} kWh`} sub={`≈ ${num(plan.energyOmr)} OMR`} />
          </div>

          {/* per-product */}
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.perSku.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
                <span className={`h-8 w-1.5 shrink-0 rounded-full ${colorFor(p.id)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {num(p.runs)} run{p.runs > 1 ? 's' : ''} × {num(p.batch)} units · on {plan.lanes[p.machine]?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {meta.note} Recomputed live in your browser from the line's measured rates; the exact optimiser runs server-side.
      </p>
    </section>
  );
};

const Row: FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className={strong ? 'font-semibold text-slate-900 dark:text-white' : 'tabular-nums text-slate-700 dark:text-slate-300'}>{value}</span>
  </div>
);

const Stat: FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="card-surface p-4">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
    <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
  </div>
);

export default ProductionPlannerPage;
