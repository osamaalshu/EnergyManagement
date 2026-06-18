import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { productionData } from '../data/productionData';
import {
  scheduleOrders, DEMO_SKUS, DEMO_ECON, DEMO_LINE, type SkuParam, type Econ, type Order,
} from '../lib/productionModel';

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Other: 'bg-slate-400',
};
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

const ScrapAnalyzerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('demo');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;
  const line = dataset === 'demo' ? DEMO_LINE : { machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw, nMachines: model.line.nMachines, machineNames: model.line.machineNames };

  const [famFilter, setFamFilter] = useState('All');
  const [machineFilter, setMachineFilter] = useState('All');
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<string | null>(null);

  const a = useMemo(() => {
    const products = Object.fromEntries(skus.map((s) => [s.id, s]));
    // dominant machine per product, from the family-grouped schedule
    const orders: Order[] = skus.map((s) => ({ id: s.id, productId: s.id, qty: s.demand, dueDay: 30 }));
    const sch = scheduleOrders(orders, products, 365, line.nMachines, line, econ, 24, 3, 0.5, 10, 'grouped');
    const machineOf: Record<string, string> = {}; sch.items.forEach((it) => { machineOf[it.orderId] = it.machineName; });

    const rejects = skus.map((s) => s.meanRejection).sort((x, y) => x - y);
    const benchmark = rejects[Math.floor(0.25 * (rejects.length - 1))]; // best-demonstrated (P25)

    const base = skus.map((s) => {
      const scrapKg = s.demand * s.kgPerUnit * s.meanRejection;
      const gap = Math.max(0, s.meanRejection - benchmark);
      const saving = gap * s.demand * s.kgPerUnit * econ.materialOmrPerKg;
      return { id: s.id, name: s.name, family: s.family, machine: machineOf[s.id] ?? '—', reject: s.meanRejection * 100, target: benchmark * 100, demand: s.demand, kgPerUnit: s.kgPerUnit, scrapKg, scrapOmr: scrapKg * econ.materialOmrPerKg, saving };
    }).sort((x, y) => y.scrapKg - x.scrapKg);

    const totalKg = base.reduce((s, r) => s + r.scrapKg, 0) || 1;
    let cum = 0;
    const rows = base.map((r) => { cum += r.scrapKg; return { ...r, cumPct: (cum / totalKg) * 100 }; });
    const to80 = rows.findIndex((r) => r.cumPct >= 80) + 1;
    const totalOmr = rows.reduce((s, r) => s + r.scrapOmr, 0);
    const recoverable = rows.reduce((s, r) => s + r.saving, 0);
    const machines = [...new Set(rows.map((r) => r.machine))];
    return { rows, totalKg, totalOmr, recoverable, to80, benchmark: benchmark * 100, maxKg: rows[0]?.scrapKg || 1, machines };
  }, [skus, econ, line]);

  const top10 = a.rows.slice(0, 10);
  const recs = a.rows.filter((r) => r.saving > 0).sort((x, y) => y.saving - x.saving).slice(0, 5);
  const driver = (r: typeof a.rows[number]) =>
    r.reject >= a.benchmark * 1.6 ? 'high variability' : r.demand > 25000 ? 'high-runner volume' : 'process tuning';
  const tableRows = (q.trim() ? a.rows : top10).filter((r) => (famFilter === 'All' || r.family === famFilter) && (machineFilter === 'All' || r.machine === machineFilter) && r.name.toLowerCase().includes(q.toLowerCase()));
  const drillRow = a.rows.find((r) => r.id === drill);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Scrap Focus</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Which products are worth attacking first — and what you'd save.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', 'Pilot · 2'], ['demo', 'Full catalog · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => { setDataset(ds); setFamFilter('All'); setMachineFilter('All'); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${dataset === ds ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Top bar — loss summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Annual scrap</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(a.totalKg)} kg</p><p className="text-xs text-slate-500 dark:text-slate-400">≈ {num(a.totalOmr)} OMR</p></div>
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Concentration</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">Top {a.to80}</p><p className="text-xs text-slate-500 dark:text-slate-400">= 80% of the loss</p></div>
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-[11px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">Recoverable</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(a.recoverable)} OMR</p><p className="text-xs text-slate-500 dark:text-slate-400">if each hits your best rate ({a.benchmark.toFixed(1)}%)</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Pareto */}
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Worst offenders</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={top10} margin={{ top: 8, right: 36, left: 0, bottom: 36 }}>
                <XAxis dataKey="id" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} angle={-45} textAnchor="end" height={46} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
                <YAxis yAxisId="l" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={34} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number, n: string) => n === 'cumPct' ? [`${v.toFixed(0)}%`, 'cumulative'] : [`${num(v)} kg`, 'scrap']} />
                <Bar yAxisId="l" dataKey="scrapKg" radius={[2, 2, 0, 0]}>{top10.map((r, i) => (<Cell key={i} fill={`rgba(244,63,94,${0.35 + 0.6 * (r.scrapKg / a.maxKg)})`} />))}</Bar>
                <Line yAxisId="r" type="monotone" dataKey="cumPct" stroke="#1A365D" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Top 10 SKUs by annual scrap (darker = worse); navy line = cumulative share. Focus range: SKUs 1–{a.to80} ({80}% of loss).</p>
        </div>

        {/* Focus recommendations */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Focus here first — biggest recoverable savings</h3>
          {recs.map((r) => (
            <button key={r.id} type="button" onClick={() => setDrill(r.id)} className="card-surface w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{r.name} <span className="text-xs font-normal text-slate-400">· {r.machine}</span></span>
                <span className="shrink-0 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">save {num(r.saving)} OMR</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {num(r.scrapOmr)} OMR scrap/yr ({((r.scrapOmr / a.totalOmr) * 100).toFixed(0)}% of total). Reject {r.reject.toFixed(1)}% → {r.target.toFixed(1)}% (your best) frees {num(r.saving / econ.materialOmrPerKg)} kg.
              </p>
              <span className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[0.6rem] font-semibold uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">likely: {driver(r)}</span>
            </button>
          ))}
          {recs.length === 0 && <div className="card-surface p-4 text-sm text-slate-500 dark:text-slate-400">All products are already near your best reject rate.</div>}
        </div>
      </div>

      {/* Investigator table */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{q.trim() ? 'Search results' : 'Top 10 — investigate'}</h3>
          <div className="flex flex-wrap gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…" className="rounded-lg border border-slate-200/70 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-slate-200" />
            <select value={famFilter} onChange={(e) => setFamFilter(e.target.value)} className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"><option>All</option>{[...new Set(skus.map((s) => s.family))].map((f) => <option key={f}>{f}</option>)}</select>
            <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"><option>All</option>{a.machines.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Family</th><th className="px-4 py-2">Machine</th><th className="px-4 py-2 text-right">Reject %</th><th className="px-4 py-2 text-right">Demand/yr</th><th className="px-4 py-2 text-right">Scrap kg</th><th className="px-4 py-2 text-right">Scrap OMR</th><th className="px-4 py-2 text-right">Cum %</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {tableRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-1.5 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-1.5"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[r.family] ?? 'bg-slate-400'}`} />{r.family}</span></td>
                  <td className="px-4 py-1.5 text-xs">{r.machine}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.reject.toFixed(1)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{num(r.demand)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{num(r.scrapKg)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{num(r.scrapOmr)}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-slate-400">{r.cumPct.toFixed(0)}%</td>
                  <td className="px-4 py-1.5 text-right"><button type="button" onClick={() => setDrill(r.id)} className="text-xs text-accent">details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">Scrap = demand × kg/unit × each product's own measured reject rate. "Best rate" benchmark = the 25th-percentile reject across your catalogue. Machine from the schedule; shift / material-batch / trend attribution unlocks once MES + historical data connect.</p>

      {/* Drill-down */}
      {drillRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)} role="presentation">
          <div className="card-surface max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><h3 className="text-lg font-semibold text-slate-900 dark:text-white">{drillRow.name}</h3><button onClick={() => setDrill(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button></div>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <p>Family {drillRow.family} · runs on <span className="font-medium">{drillRow.machine}</span> · demand <span className="font-mono">{num(drillRow.demand)}</span>/yr</p>
              <p>Reject <span className="font-mono">{drillRow.reject.toFixed(1)}%</span> vs best <span className="font-mono">{drillRow.target.toFixed(1)}%</span> → annual scrap <span className="font-mono">{num(drillRow.scrapKg)} kg ≈ {num(drillRow.scrapOmr)} OMR</span></p>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">Close the gap → save {num(drillRow.saving)} OMR/yr ({num(drillRow.saving / econ.materialOmrPerKg)} kg)</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">Likely lever: <span className="font-medium">{driver(drillRow)}</span>. To pinpoint it, connect shift / material-batch / changeover logs — then this panel shows the by-shift and by-batch breakdown.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ScrapAnalyzerPage;
