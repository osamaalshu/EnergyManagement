import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { productionData } from '../data/productionData';
import { DEMO_SKUS, DEMO_ECON, type SkuParam, type Econ } from '../lib/productionModel';

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Other: 'bg-slate-400',
};
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

const ScrapAnalyzerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('demo');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;

  const data = useMemo(() => {
    const rows = skus.map((s) => {
      const scrapKg = s.demand * s.kgPerUnit * s.meanRejection;
      return { id: s.id, name: s.name, family: s.family, rejectPct: s.meanRejection * 100, kgPerUnit: s.kgPerUnit, demand: s.demand, scrapKg, scrapOmr: scrapKg * econ.materialOmrPerKg };
    }).sort((a, b) => b.scrapKg - a.scrapKg);
    const total = rows.reduce((a, r) => a + r.scrapKg, 0) || 1;
    let cum = 0;
    const withCum = rows.map((r) => { cum += r.scrapKg; return { ...r, cumPct: (cum / total) * 100 }; });
    const to80 = withCum.findIndex((r) => r.cumPct >= 80) + 1;
    return { rows: withCum, totalKg: total, totalOmr: total * econ.materialOmrPerKg, maxKg: rows[0]?.scrapKg || 1, to80 };
  }, [skus, econ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Scrap Analyzer</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Which products waste the most material — each on its own measured reject rate.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', 'Pilot · 2'], ['demo', 'Full catalog · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => setDataset(ds)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${dataset === ds ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Headline */}
      <div className="rounded-2xl border border-rose-300/60 bg-rose-50 p-5 dark:border-rose-500/20 dark:bg-rose-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">Annual scrap across the catalog</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white"><span className="font-mono">{num(data.totalKg)}</span> kg ≈ <span className="font-mono">{num(data.totalOmr)}</span> OMR</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Your top <span className="font-mono font-semibold">{data.to80}</span> product{data.to80 === 1 ? '' : 's'} account for <span className="font-semibold">80%</span> of it — fix those first.</p>
      </div>

      {/* Pareto */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Worst offenders (Pareto)</h3>
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.rows} margin={{ top: 8, right: 40, left: 0, bottom: 40 }}>
              <XAxis dataKey="id" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} angle={-45} textAnchor="end" height={50} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
              <YAxis yAxisId="l" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} label={{ value: 'scrap kg', angle: -90, position: 'insideLeft', fill: 'var(--muted-text)', fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number, n: string) => n === 'cumPct' ? [`${v.toFixed(0)}%`, 'cumulative'] : [`${num(v)} kg`, 'scrap']} />
              <Bar yAxisId="l" dataKey="scrapKg" radius={[2, 2, 0, 0]}>{data.rows.map((r, i) => (<Cell key={i} fill={`rgba(244,63,94,${0.35 + 0.6 * (r.scrapKg / data.maxKg)})`} />))}</Bar>
              <Line yAxisId="r" type="monotone" dataKey="cumPct" stroke="#1A365D" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Bars = annual scrap per product (darker = worse); navy line = cumulative share. The classic few-products-most-scrap curve.</p>
      </div>

      {/* Heatmap grid */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Catalog heatmap — scrap intensity</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {data.rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200/60 p-3 dark:border-white/10" style={{ background: `rgba(244,63,94,${0.06 + 0.55 * (r.scrapKg / data.maxKg)})` }}>
              <div className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[r.family] ?? 'bg-slate-400'}`} /><span className="truncate text-xs font-medium text-slate-900 dark:text-white">{r.name}</span></div>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">{num(r.scrapKg)} kg</p>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{r.rejectPct.toFixed(1)}% reject</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden p-0">
        <div className="border-b border-slate-200/60 px-5 py-3 dark:border-white/10"><h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Per-product scrap</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Family</th><th className="px-4 py-2 text-right">Reject %</th><th className="px-4 py-2 text-right">kg/unit</th><th className="px-4 py-2 text-right">Demand/yr</th><th className="px-4 py-2 text-right">Scrap kg</th><th className="px-4 py-2 text-right">Scrap OMR</th><th className="px-4 py-2 text-right">Cum %</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-1.5 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-1.5"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[r.family] ?? 'bg-slate-400'}`} />{r.family}</span></td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.rejectPct.toFixed(1)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.kgPerUnit}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{num(r.demand)}</td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums" style={{ background: `rgba(244,63,94,${0.06 + 0.5 * (r.scrapKg / data.maxKg)})` }}>{num(r.scrapKg)}</td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums">{num(r.scrapOmr)}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-slate-400">{r.cumPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">Scrap = demand × kg/unit × each product's own measured reject rate. Startup/changeover scrap is handled in the planner. Pilot data covers 2 SKUs; the full 94-SKU catalog plugs in here once their records load.</p>
    </section>
  );
};

export default ScrapAnalyzerPage;
