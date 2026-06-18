import { type FC, useMemo, useState } from 'react';
import { productionData } from '../data/productionData';
import {
  scheduleOrders, monteCarloOrders, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type SkuParam, type LineParam, type Econ, type Order, type OrderSchedule, type OrderItem,
} from '../lib/productionModel';

const OTIF_TARGET = 95;
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
let _uid = 0;
const genOrders = (skus: SkuParam[], horizon: number): Order[] =>
  skus.map((s, i) => ({ id: `o${++_uid}`, productId: s.id, qty: Math.round((s.demand * horizon) / 365), dueDay: Math.max(2, Math.round(((i + 1) / skus.length) * horizon)) }));
const pctl = (sorted: number[], q: number) => sorted.length ? sorted[Math.floor((q / 100) * (sorted.length - 1))] : 0;

const DeliveryViewPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('pilot');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const products = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, s])), [skus]);
  const line: LineParam = dataset === 'demo' ? DEMO_LINE : {
    machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw,
    nMachines: model.line.nMachines, machineNames: model.line.machineNames,
  };
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;
  const machines = 1, hoursPerDay = 16;

  const [range, setRange] = useState(30);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<OrderItem | null>(null);
  const [preview, setPreview] = useState<{ title: string; affected: Set<string>; otif: number } | null>(null);
  const orders = useMemo(() => genOrders(skus, 30), [skus]);

  const sched = (mode: 'grouped' | 'due', m = machines, h = hoursPerDay) =>
    scheduleOrders(orders, products, 30, m, line, econ, h, 3, 0.5, 10, mode);
  const smart = useMemo(() => sched('grouped'), [orders, products, machines]);
  const mc = useMemo(() => monteCarloOrders(smart, hoursPerDay), [smart]);
  const smartSamples = useMemo(() => [...mc.samplesDays].sort((a, b) => a - b), [mc]);
  const curSamples = useMemo(() => { const c = sched('due'); return [...monteCarloOrders(c, hoursPerDay).samplesDays].sort((a, b) => a - b); }, [orders, products]);

  const bottleneck = smart.lanes.reduce((a, l) => (l.loadH > a.loadH ? l : a), smart.lanes[0]);
  const medReject = useMemo(() => { const r = skus.map((s) => s.meanRejection).sort((a, b) => a - b); return r[Math.floor(r.length / 2)]; }, [skus]);
  const rootCause = (it: OrderItem): string => {
    const p = products[it.productId];
    if (it.machineName === bottleneck?.name && (!it.onTime || (mc.onTimeProb[it.orderId] ?? 1) < 0.95)) return `${it.machineName} capacity`;
    if (p && p.meanRejection >= medReject * 1.25) return `High scrap · ${it.name}`;
    if (it.setupType === 'family') return 'Changeover cluster';
    return 'Sequence / due date';
  };

  // rows within the date range, enriched
  const rows = useMemo(() => smart.items
    .filter((it) => it.dueDay <= range)
    .map((it) => ({ it, conf: mc.onTimeProb[it.orderId] ?? 1, cause: rootCause(it), kg: it.qty * (products[it.productId]?.kgPerUnit ?? 0) }))
    .sort((a, b) => (b.it.lateDays - a.it.lateDays) || (a.conf - b.conf)), [smart, mc, range]);
  const atRisk = rows.filter((r) => !r.it.onTime || r.conf < 0.95);
  const shown = (q.trim() ? rows : (showAll ? rows : atRisk)).filter((r) => r.it.name.toLowerCase().includes(q.toLowerCase()));

  const otif = rows.length ? Math.round((rows.filter((r) => r.it.onTime).length / rows.length) * 100) : 100;
  const atRiskKg = atRisk.reduce((a, r) => a + r.kg, 0);
  const atRiskOmr = atRisk.reduce((a, r) => a + r.kg * econ.materialOmrPerKg, 0);
  const worstLate = rows.reduce((a, r) => Math.max(a, r.it.lateDays), 0);

  // recommendations — heuristic, quantified by re-simulation
  const recs = useMemo(() => {
    const baseOn = smart.onTime; const tot = smart.total || 1;
    const onSet = (s: OrderSchedule) => new Set(s.items.filter((i) => i.onTime).map((i) => i.orderId));
    const baseSet = onSet(smart);
    const cand = [
      { title: 'Run earliest-due-date first', desc: 'Prioritise urgent orders over family grouping on the line.', s: sched('due'), cost: 'more changeovers' },
      { title: 'Add 2 h/day overtime', desc: 'Extend the shift across the horizon.', s: sched('grouped', machines, Math.min(24, hoursPerDay + 2)), cost: 'overtime + energy' },
    ].map((c) => {
      const fixed = [...onSet(c.s)].filter((id) => !baseSet.has(id));
      const otifNew = Math.round((c.s.onTime / tot) * 100);
      return { ...c, affected: new Set(fixed), dOtif: otifNew - Math.round((baseOn / tot) * 100), fixed: fixed.length, otifNew };
    }).filter((c) => c.dOtif > 0).sort((a, b) => b.dOtif - a.dOtif).slice(0, 3);
    return cand;
  }, [smart, orders, products, machines]);

  const lateStyle = (it: OrderItem) => it.onTime ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const confStyle = (c: number) => c >= 0.95 ? 'text-emerald-600 dark:text-emerald-400' : c >= 0.7 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const maxDay = Math.max(pctl(curSamples, 95), range, 1);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Delivery View</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Will we hit our delivery commitments — and what should we change today?</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {[7, 14, 30].map((d) => (<button key={d} type="button" onClick={() => setRange(d)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${range === d ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{d}d</button>))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', `Pilot · ${model.skus.length}`], ['demo', 'Illustrative · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => { setDataset(ds); setShowAll(false); setQ(''); setDrill(null); setPreview(null); }} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${dataset === ds ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Top strip — Delivery at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`rounded-2xl border p-4 ${otif >= OTIF_TARGET ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-rose-300/60 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">OTIF forecast</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-slate-900 dark:text-white">{otif}%</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">target {OTIF_TARGET}%</p>
        </div>
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Orders at risk</p><p className="mt-1 font-mono text-3xl font-semibold text-slate-900 dark:text-white">{atRisk.length}</p><p className="text-xs text-slate-500 dark:text-slate-400">{num(atRiskKg / 1000, 1)} t · {num(atRiskOmr)} OMR</p></div>
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Worst lateness</p><p className="mt-1 font-mono text-3xl font-semibold text-rose-600 dark:text-rose-400">{num(worstLate, 1)} d</p><p className="text-xs text-slate-500 dark:text-slate-400">vs due date</p></div>
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Finish window (P80)</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">day {num(pctl(smartSamples, 50), 1)}–{num(pctl(smartSamples, 80), 1)}</p><p className="text-xs text-slate-500 dark:text-slate-400">P50–P80</p></div>
      </div>

      {preview && (
        <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm">
          <span className="text-slate-700 dark:text-slate-200">Previewing <span className="font-semibold">{preview.title}</span> → OTIF {otif}% → <span className="font-semibold text-emerald-600 dark:text-emerald-400">{preview.otif}%</span>, fixes {preview.affected.size} order{preview.affected.size === 1 ? '' : 's'} (highlighted).</span>
          <button type="button" onClick={() => setPreview(null)} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white">clear</button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left — orders at risk */}
        <div className="card-surface overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{q.trim() ? 'Search results' : showAll ? 'All orders' : 'Orders at risk'} <span className="font-normal normal-case text-slate-400">· next {range} days</span></h3>
            <div className="flex items-center gap-3">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…" className="rounded-lg border border-slate-200/70 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-slate-200" />
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-accent">{showAll ? 'at-risk only' : 'show all'}</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
                <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Due</th><th className="px-4 py-2 text-right">Finish</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Confidence</th><th className="px-4 py-2">Root cause</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
                {shown.map(({ it, conf, cause }) => (
                  <tr key={it.orderId} onClick={() => setDrill(it)} className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5 ${preview?.affected.has(it.orderId) ? 'bg-accent/10' : ''}`}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{it.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{num(it.qty)}</td>
                    <td className="px-4 py-2 text-right font-mono">{it.dueDay}</td>
                    <td className="px-4 py-2 text-right font-mono">{num(it.finishDay, 1)}</td>
                    <td className={`px-4 py-2 font-medium ${lateStyle(it)}`}>{it.onTime ? 'on time' : `late ${num(it.lateDays, 1)} d`}</td>
                    <td className={`px-4 py-2 text-right font-mono ${confStyle(conf)}`}>{Math.round(conf * 100)}%</td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{cause}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-emerald-600 dark:text-emerald-400">✓ No orders at risk in this window.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — recommended changes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recommended changes</h3>
          {recs.length === 0 && <div className="card-surface p-4 text-sm text-slate-500 dark:text-slate-400">Plan is on track — no changes needed.</div>}
          {recs.map((r) => (
            <button key={r.title} type="button" onClick={() => setPreview({ title: r.title, affected: r.affected, otif: r.otifNew })}
              className={`card-surface w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${preview?.title === r.title ? 'ring-2 ring-accent' : ''}`}>
              <p className="font-semibold text-slate-900 dark:text-white">{r.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>
              <p className="mt-2 text-sm"><span className="font-semibold text-emerald-600 dark:text-emerald-400">OTIF +{r.dOtif}%</span> · fixes {r.fixed} order{r.fixed === 1 ? '' : 's'} <span className="text-slate-400">· cost: {r.cost}</span></p>
            </button>
          ))}
        </div>
      </div>

      {/* Footer — finish-date band: current vs this plan */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Finish window — current way vs this plan</h3>
        <div className="mt-4 space-y-3">
          {[{ label: 'Current way', s: curSamples, color: 'bg-slate-400' }, { label: 'This plan', s: smartSamples, color: 'bg-accent' }].map(({ label, s, color }) => {
            const p50 = pctl(s, 50), p80 = pctl(s, 80);
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                <div className="relative h-6 flex-1 rounded bg-slate-100 dark:bg-white/5">
                  <div className={`absolute h-full rounded ${color} opacity-70`} style={{ left: `${(p50 / maxDay) * 100}%`, width: `${((p80 - p50) / maxDay) * 100}%` }} />
                  <span className="absolute -top-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300" style={{ left: `calc(${(p50 / maxDay) * 100}% + 2px)` }}>{num(p50, 1)}</span>
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-xs text-slate-500 dark:text-slate-400">P80 day {num(p80, 1)}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-400">Bands span P50→P80 finish day. This plan finishes <span className="font-semibold text-emerald-600 dark:text-emerald-400">{num(pctl(curSamples, 80) - pctl(smartSamples, 80), 1)} days earlier</span> at P80.</p>
        </div>
      </div>

      {/* Drill-down */}
      {drill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)} role="presentation">
          <div className="card-surface max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><h3 className="text-lg font-semibold text-slate-900 dark:text-white">{drill.name}</h3><button onClick={() => setDrill(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button></div>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <p>Qty <span className="font-mono">{num(drill.qty)}</span> · due day <span className="font-mono">{drill.dueDay}</span> · finishes day <span className="font-mono">{num(drill.finishDay, 1)}</span></p>
              <p>On <span className="font-medium">{drill.machineName}</span>, position {drill.seq} · run-time <span className="font-mono">{num(drill.runtimeH, 1)} h</span> · changeover before {drill.setupType === 'none' ? 'none' : `${drill.setupType} +${drill.setupBeforeH}h`}</p>
              <p>Expected scrap <span className="font-mono">{num(drill.qty * (products[drill.productId]?.kgPerUnit ?? 0) * (products[drill.productId]?.meanRejection ?? 0))} kg</span> ({((products[drill.productId]?.meanRejection ?? 0) * 100).toFixed(1)}% reject)</p>
              <p className={`font-medium ${lateStyle(drill)}`}>{drill.onTime ? '✓ projected on time' : `⚠ projected late ${num(drill.lateDays, 1)} days`} · confidence {Math.round((mc.onTimeProb[drill.orderId] ?? 1) * 100)}%</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">Why flagged: <span className="font-medium">{rootCause(drill)}</span> — {drill.onTime ? 'within window but low confidence under rate variability.' : 'projected finish is past the due date for this order.'}</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">OTIF, confidence and finish windows from the production simulation (rate variability bootstrapped), using 16 h/day on Machine 01. Pilot view uses measured line EXT-01 product rates from the Al Hilal / Nizwa pilot; Illustrative view uses synthetic demo products. Real order-book integration plugs in next.</p>
    </section>
  );
};

export default DeliveryViewPage;
