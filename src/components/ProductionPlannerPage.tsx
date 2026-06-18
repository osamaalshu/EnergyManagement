import { type FC } from 'react';
import { productionData } from '../data/productionData';
import type { Quantity, ValueKind } from '../types/production';

const KIND_STYLE: Record<ValueKind, string> = {
  measured: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  calculated: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  inferred: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  assumed: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};
const KindBadge: FC<{ kind: ValueKind }> = ({ kind }) => (
  <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${KIND_STYLE[kind]}`}>{kind}</span>
);
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
const Q: FC<{ q: Quantity; d?: number }> = ({ q, d = 0 }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{num(q.value, d)}</span>
    <span className="text-xs text-slate-500 dark:text-slate-400">{q.unit}</span>
    <KindBadge kind={q.kind} />
  </span>
);

const LANE_COLORS = ['bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500'];

const ProductionPlannerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { meta, skus, line, configuration: cfg, savings, desValidation: des } = productionData;
  const capacity = line.baseline.capacity_hours;
  const colorFor = (id: string) => LANE_COLORS[skus.findIndex((s) => s.sku_id === id) % LANE_COLORS.length];

  // calibration headline
  const med = cfg?.production_hours_median ?? 0;
  const eff = cfg?.production_hours_effective ?? 0;
  const underPct = med > 0 ? ((eff / med - 1) * 100) : 0;

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
            <p className="text-sm text-slate-500 dark:text-slate-400">{meta.site} · {meta.facility} · Line {meta.lineId}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pilot · demo
        </span>
      </div>

      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-semibold">Decision support, not control.</span> {meta.note}
      </div>

      {/* ── HERO: best configuration (Phase 2c) ───────────────────── */}
      {cfg && (
        <div className="card-surface overflow-hidden p-0">
          <div className="border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 dark:border-white/10 dark:from-white/5 dark:to-white/0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recommended configuration — run all products</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              How many campaigns each product runs, and on which machine, in what order — to finish in the least time with the fewest changeovers.
            </p>
          </div>

          <div className="space-y-5 p-6">
            {/* Machine lanes */}
            <div className="space-y-3">
              {Object.entries(cfg.per_machine).map(([m, lane]) => {
                const pct = Math.max((lane.load_h / capacity) * 100, 2);
                return (
                  <div key={m} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">{lane.name}</span>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5">
                      <div className={`flex h-full items-center rounded-lg ${lane.sequence.length ? colorFor(lane.sequence[0]) : ''} px-3`} style={{ width: `${pct}%` }}>
                        <span className="truncate text-xs font-semibold text-white">{lane.sequence.join(' → ') || 'idle'}</span>
                      </div>
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{num(lane.load_h)} h · {((lane.load_h / capacity) * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="w-24 shrink-0" />
                <span className="flex-1">0 h{' '}<span className="float-right">capacity {num(capacity)} h / machine</span></span>
                <span className="w-28 shrink-0" />
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Makespan', `${num(cfg.makespan_h)} h`, 'time to clear all products'],
                ['Changeovers', `${num(cfg.total_changeover_h)} h`, 'product switches'],
                ['Machines', `${cfg.n_machines}`, 'in parallel (01 & 03)'],
                ['Plan cost', `${num(cfg.costs_omr.total)} OMR/yr`, 'setup + holding + fixed'],
              ].map(([label, val, sub]) => (
                <div key={label} className="card-surface p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{val}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* Lot-sizing per product */}
            <div className="grid gap-3 sm:grid-cols-2">
              {skus.map((s) => (
                <div key={s.sku_id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
                  <span className={`h-8 w-1.5 shrink-0 rounded-full ${colorFor(s.sku_id)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {cfg.runs_by_sku[s.sku_id]} campaigns × {num(cfg.batch_by_sku[s.sku_id])} units · {cfg.per_machine[String(cfg.assignment[s.sku_id])]?.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Calibration insight (honesty as engagement) ───────────── */}
      {cfg && (
        <div className="card-surface p-5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Why our hours are realistic</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Planning on the <em>median</em> line rate hides the slow runs. Run-time = batch ÷ rate, and slow runs cost disproportionately — so we plan on the rate the line actually achieves on average.
          </p>
          <div className="mt-4 space-y-2">
            {[
              ['Median rate (optimistic)', med, 'bg-slate-300 dark:bg-white/20'],
              ['Effective rate (what we plan on)', eff, 'bg-accent'],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="flex items-center gap-3">
                <span className="w-56 shrink-0 text-sm text-slate-600 dark:text-slate-300">{label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-white/5">
                  <div className={`h-full rounded ${cls}`} style={{ width: `${((val as number) / eff) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{num(val as number)} h</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
            Median planning would understate run-time by ~{underPct.toFixed(0)}% — enough to blow a delivery promise.
          </p>
        </div>
      )}

      {/* Value-label legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">Every number below is labelled:</span>
        {(['measured', 'calculated', 'inferred', 'assumed'] as ValueKind[]).map((k) => <KindBadge key={k} kind={k} />)}
      </div>

      {/* ── Detail: lot-sizing economics (baseline vs optimal) ────── */}
      <div className="card-surface p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Lot-sizing economics (current vs optimal)</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">The inventory ↔ changeover trade-off, at the same output.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Plan</th><th className="px-4 py-2 text-right">Runs</th><th className="px-4 py-2 text-right">Setup</th><th className="px-4 py-2 text-right">Holding</th><th className="px-4 py-2 text-right">Total OMR/yr</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {[{ k: 'Current', s: line.baseline }, { k: 'Optimal', s: line.optimal }].map(({ k, s }) => (
                <tr key={k}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{k}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Object.values(s.runs_by_sku).reduce((x, y) => x + y, 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(s.setup_cost_omr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(s.holding_cost_omr)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{num(s.total_cost_omr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">Saving: {num(savings.totalOmr)} OMR/yr</span>
          <span className="text-slate-500 dark:text-slate-400"> — small here (slack capacity); the lever grows with more products.</span>
          <KindBadge kind="inferred" />
        </p>
      </div>

      {/* DES validation */}
      <div className="card-surface p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Discrete-event validation (SimPy)</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{des.dependence}; {des.reps.toLocaleString()} replications.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Makespan P10/50/90', `${num(des.makespan_h_p10_p50_p90[0])} / ${num(des.makespan_h_p10_p50_p90[1])} / ${num(des.makespan_h_p10_p50_p90[2])} h`],
            ['Scrap P10/50/90', `${num(des.scrap_kg_p10_p50_p90[0])} / ${num(des.scrap_kg_p10_p50_p90[1])} / ${num(des.scrap_kg_p10_p50_p90[2])} kg`],
            ['Utilization', `${(des.median_utilization * 100).toFixed(0)}%`],
            ['Replications', num(des.reps)],
          ].map(([label, val]) => (
            <div key={label} className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-SKU */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">By product — current vs optimal</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {skus.map((s) => (
            <div key={s.sku_id} className="card-surface p-5">
              <p className="font-medium text-slate-900 dark:text-white">{s.name}</p>
              <p className="text-xs text-slate-400">{s.sku_id}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Current batch / runs</p>
                  <p className="mt-1"><Q q={s.baseline.batch_size} /> · {num(s.baseline.runs_per_year.value)} runs</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Optimal batch / runs</p>
                  <p className="mt-1"><Q q={s.optimal.batch_size} /> · {num(s.optimal.runs_per_year.value)} runs</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Energy (proxy)</p>
                  <p className="mt-1"><Q q={s.optimal.energy_kwh} /></p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Scrap P10–P90</p>
                  <p className="mt-1 tabular-nums text-slate-700 dark:text-slate-300">{num(s.scrap_kg_bounds_p10_p50_p90[0])}–{num(s.scrap_kg_bounds_p10_p50_p90[2])} kg</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductionPlannerPage;
