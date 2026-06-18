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

const ProductionPlannerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { meta, skus, line, savings, desValidation: des } = productionData;
  const b = line.baseline;
  const o = line.optimal;
  const util = (s: { production_hours: number; capacity_hours: number }) =>
    `${((s.production_hours / s.capacity_hours) * 100).toFixed(0)}%`;

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

      {/* Value-label legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">Every number is labelled:</span>
        {(['measured', 'calculated', 'inferred', 'assumed'] as ValueKind[]).map((k) => <KindBadge key={k} kind={k} />)}
      </div>

      {/* Line plan — baseline vs optimal */}
      <div className="card-surface p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Whole-line plan (CP-SAT)</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Annual plan across all SKUs sharing the line. Production hours are fixed by demand; the decision is how many campaigns each SKU runs.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Plan</th><th className="px-4 py-2 text-right">Runs</th><th className="px-4 py-2 text-right">Hours / capacity</th><th className="px-4 py-2 text-right">Setup</th><th className="px-4 py-2 text-right">Holding</th><th className="px-4 py-2 text-right">Total OMR/yr</th><th className="px-4 py-2">Feasible</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {[{ k: 'Current (baseline)', s: b }, { k: 'Optimised', s: o }].map(({ k, s }) => (
                <tr key={k}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{k}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Object.values(s.runs_by_sku).reduce((x, y) => x + y, 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(s.total_hours)} / {num(s.capacity_hours)} ({util(s)})</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(s.setup_cost_omr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{num(s.holding_cost_omr)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{num(s.total_cost_omr)}</td>
                  <td className="px-4 py-2.5">{s.feasible
                    ? <span className="text-emerald-500">✓ feasible</span>
                    : <span className="text-red-400">✗ over capacity</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">Saving: {num(savings.totalOmr)} OMR/yr</span>
          <span className="text-slate-500 dark:text-slate-400"> ({num(savings.decisionOmr)} on the decision-dependent part)</span>
          <KindBadge kind="inferred" />
        </p>
        <p className="mt-1 text-xs text-slate-400">{o.note}</p>
      </div>

      {/* DES validation */}
      <div className="card-surface p-5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Discrete-event validation (SimPy)</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{des.dependence}; {des.reps.toLocaleString()} replications.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Makespan P10/50/90', `${num(des.makespan_h_p10_p50_p90[0])} / ${num(des.makespan_h_p10_p50_p90[1])} / ${num(des.makespan_h_p10_p50_p90[2])} h`],
            ['Analytical hours', `${num(des.analytical_total_hours)} h`],
            ['Scrap P10/50/90', `${num(des.scrap_kg_p10_p50_p90[0])} / ${num(des.scrap_kg_p10_p50_p90[1])} / ${num(des.scrap_kg_p10_p50_p90[2])} kg`],
            ['Utilization', `${(des.median_utilization * 100).toFixed(0)}%`],
          ].map(([label, val]) => (
            <div key={label} className="card-surface p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{val}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Note: the median makespan runs above the analytical hours because the closed-form uses the <em>median</em> line rate; production time scales as batch ÷ rate, and rate variability inflates it. Treat hours as a band, not a point.
        </p>
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
