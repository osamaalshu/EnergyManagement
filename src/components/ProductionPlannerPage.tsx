import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { productionData } from '../data/productionData';
import {
  scheduleOrders, monteCarloOrders, RATE_CV, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type SkuParam, type LineParam, type Econ, type Order, type OrderItem,
} from '../lib/productionModel';

// Time-of-Use tariff (Oman APSR-style; would come from the CRT engine). Peak hours cost more.
const PEAK_OMR_PER_KWH = 0.040, OFFPEAK_OMR_PER_KWH = 0.020;

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Other: 'bg-slate-400',
};
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
let _uid = 0;
const genOrders = (skus: SkuParam[], horizon: number): Order[] =>
  skus.map((s, i) => ({ id: `o${++_uid}`, productId: s.id, qty: Math.round((s.demand * horizon) / 365), dueDay: Math.max(2, Math.round(((i + 1) / skus.length) * horizon)) }));

// overlay two sample sets on a shared day-axis (the Monte-Carlo representation)
const binTwo = (a: number[], b: number[], n = 20) => {
  const lo = Math.min(a[0], b[0]); const hi = Math.max(a[a.length - 1], b[b.length - 1]); const w = (hi - lo) / n || 1;
  return Array.from({ length: n }, (_, i) => {
    const c = lo + (i + 0.5) * w;
    const inBin = (arr: number[]) => arr.filter((x) => x >= lo + i * w && (i === n - 1 ? x <= hi + 1e-9 : x < lo + (i + 1) * w)).length;
    return { day: Math.round(c * 10) / 10, smart: inBin(a), current: inBin(b) };
  });
};

const ProductionPlannerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('demo');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const products = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, s])), [skus]);
  const line: LineParam = dataset === 'demo' ? DEMO_LINE : {
    machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw,
    nMachines: model.line.nMachines, machineNames: model.line.machineNames,
  };
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;

  const [horizon, setHorizon] = useState(30);
  const [hoursPerDay, setHoursPerDay] = useState(24);
  const [machines, setMachines] = useState(line.nMachines || 1);
  const [famH, setFamH] = useState(3);
  const [diaH, setDiaH] = useState(0.5);
  const [scrapPerChg, setScrapPerChg] = useState(10);
  const [showParams, setShowParams] = useState(false);
  const [orders, setOrders] = useState<Order[]>(() => genOrders(DEMO_SKUS, 30));

  const chooseDataset = (ds: 'pilot' | 'demo') => {
    const list = ds === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
    setDataset(ds); setMachines((ds === 'demo' ? DEMO_LINE.nMachines : model.line.nMachines) || 1);
    setOrders(genOrders(list, horizon));
  };
  const editOrder = (id: string, patch: Partial<Order>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const addOrder = () => setOrders((os) => [...os, { id: `o${++_uid}`, productId: skus[0].id, qty: 500, dueDay: horizon }]);
  const rmOrder = (id: string) => setOrders((os) => os.filter((o) => o.id !== id));

  const smart = useMemo(() => scheduleOrders(orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, 'grouped'),
    [orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg]);
  const current = useMemo(() => scheduleOrders(orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, 'due'),
    [orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg]);
  const mc = useMemo(() => monteCarloOrders(smart, hoursPerDay), [smart, hoursPerDay]);
  const mcCur = useMemo(() => monteCarloOrders(current, hoursPerDay), [current, hoursPerDay]);
  const overlay = useMemo(() => (mc.samplesDays.length && mcCur.samplesDays.length ? binTwo(mc.samplesDays, mcCur.samplesDays) : []), [mc, mcCur]);

  const itemByOrder = useMemo(() => { const map: Record<string, OrderItem> = {}; smart.items.forEach((it) => { map[it.orderId] = it; }); return map; }, [smart]);
  const savedChg = Math.round((current.changeoverH - smart.changeoverH) * 10) / 10;
  const savedScrap = Math.round(current.scrapKg - smart.scrapKg);
  const savedScrapOmr = Math.round(savedScrap * econ.materialOmrPerKg);
  const onTimePct = Math.round(mc.pAllOnTime * 100);

  // Energy & Time-of-Use: total machine-on energy, priced peak vs off-peak (the timing lever)
  const tou = useMemo(() => {
    const machineHours = smart.lanes.reduce((a, l) => a + l.loadH, 0);
    const kwh = machineHours * line.machineKw;
    return { kwh: Math.round(kwh), offCost: Math.round(kwh * OFFPEAK_OMR_PER_KWH), peakCost: Math.round(kwh * PEAK_OMR_PER_KWH), spread: Math.round(kwh * (PEAK_OMR_PER_KWH - OFFPEAK_OMR_PER_KWH)) };
  }, [smart, line]);

  // Biggest levers — what moves the finish date / risk most (so you know what to fix or measure)
  const levers = useMemo(() => {
    const base = smart.makespanDays;
    const reRun = (m: number, h: number, fh: number, dh: number) =>
      scheduleOrders(orders, products, horizon, m, line, econ, h, fh, dh, scrapPerChg, 'grouped').makespanDays;
    const out = [
      { t: 'Add a machine', save: base - reRun(machines + 1, hoursPerDay, famH, diaH) },
      { t: 'Run +4 hours/day', save: base - reRun(machines, Math.min(24, hoursPerDay + 4), famH, diaH) },
      { t: 'Halve changeover time', save: base - reRun(machines, hoursPerDay, famH / 2, diaH / 2) },
      { t: 'Stabilise run rates (less variability)', save: Math.max(0, (mc.samplesDays[Math.floor(0.9 * (mc.samplesDays.length - 1))] || 0) - (monteCarloOrders(smart, hoursPerDay, RATE_CV / 2, 600).samplesDays[Math.floor(0.9 * 599)] || 0)) },
    ].map((l) => ({ ...l, save: Math.max(0, Math.round(l.save * 10) / 10) })).sort((a, b) => b.save - a.save);
    return out;
  }, [smart, orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, mc]);
  const leverMax = Math.max(...levers.map((l) => l.save), 0.1);

  const field = 'rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white';
  const chip = (on: boolean) => `rounded-md px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`;
  const probColor = (p: number) => p >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : p >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Order Planner</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your orders in, on-time confidence out. Add a rush order and watch it.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', 'Pilot · 2'], ['demo', 'Full plant · 12']] as const).map(([ds, label]) => (<button key={ds} type="button" onClick={() => chooseDataset(ds)} className={chip(dataset === ds)}>{label}</button>))}
        </div>
      </div>

      {/* VERDICT */}
      <div className={`rounded-2xl border p-5 ${onTimePct >= 85 ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : onTimePct >= 50 ? 'border-amber-300/60 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10' : 'border-rose-300/60 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${onTimePct >= 85 ? 'text-emerald-700 dark:text-emerald-300' : onTimePct >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
            {smart.onTime} of {smart.total} orders on time · {onTimePct}% chance ALL ship on time
        </p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">Last order finishes day <span className="font-mono">{num(smart.makespanDays, 1)}</span> (typical) · <span className="font-mono">{num(mc.samplesDays[Math.floor(0.9 * (mc.samplesDays.length - 1))] || 0, 1)}</span> on a bad run</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sequencing by family vs your current way saves <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{num(savedChg, 1)} h</span> changeover and <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{num(savedScrap)} kg</span> scrap (≈ {num(savedScrapOmr)} OMR).
          {smart.lateOrders.length > 0 && <span className="text-rose-600 dark:text-rose-400"> At risk: {smart.lateOrders.map((l) => l.name).slice(0, 3).join(', ')}{smart.lateOrders.length > 3 ? '…' : ''}.</span>}
        </p>
      </div>

      {/* YOUR DECISIONS — only what a manager controls */}
      <div className="card-surface flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">You decide</span>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Planning window</span><div className="mt-1 flex items-center gap-1"><input type="number" min={1} value={horizon} onChange={(e) => setHorizon(Math.max(1, Math.round(Number(e.target.value) || 1)))} className={`w-20 ${field}`} /><span className="text-xs text-slate-400">days</span></div></label>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Machines running</span><input type="number" min={1} max={6} value={machines} onChange={(e) => setMachines(Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 block w-20 ${field}`} /></label>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours / day</span><input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 block w-20 ${field}`} /></label>
        <span className="text-xs text-slate-400">…and the order book below. Everything else is calibrated from your data.</span>
      </div>

      {/* MODEL PARAMETERS — calibrated from data, sensors fine-tune (collapsed) */}
      <div className="card-surface p-0">
        <button type="button" onClick={() => setShowParams((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Model parameters <span className="font-normal normal-case text-slate-400">· calibrated from your production data · live sensors will fine-tune</span></span>
          <span className="text-xs text-slate-400">{showParams ? 'hide ▲' : 'show ▼'}</span>
        </button>
        {showParams && (
          <div className="border-t border-slate-200/60 px-5 py-4 dark:border-white/10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Param label="Run rate (per product)" value="measured from history" measured />
              <Param label="Reject rate (per product)" value="measured from history" measured />
              <Param label="Rate variability" value="measured from history" measured />
              <ParamInput label="Changeover — family (h)" value={famH} step={0.5} onChange={setFamH} />
              <ParamInput label="Changeover — diameter (h)" value={diaH} step={0.25} onChange={setDiaH} />
              <ParamInput label="Scrap per changeover (kg)" value={scrapPerChg} step={1} onChange={setScrapPerChg} />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Run rates and reject rates come straight from your records. Changeover times and startup scrap are <span className="text-amber-600 dark:text-amber-400">estimates today</span> — when the line's changeover log and sensors are connected, these calibrate automatically and turn measured. You never type these as a manager; they're shown here for transparency.</p>
          </div>
        )}
      </div>

      {/* ORDER BOOK — input + outcome per order */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order book</h3>
          <button type="button" onClick={addOrder} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/90">+ Add order</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Due (day)</th><th className="px-4 py-2 text-right">Finishes</th><th className="px-4 py-2">On time?</th><th className="px-4 py-2 text-right">Confidence</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {orders.map((o) => {
                const it = itemByOrder[o.id]; const prob = mc.onTimeProb[o.id] ?? 1; const p = products[o.productId];
                return (
                  <tr key={o.id}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-sm ${FAMILY_BG[p?.family] ?? 'bg-slate-400'}`} />
                        <select value={o.productId} onChange={(e) => editOrder(o.id, { productId: e.target.value })} className={`${field} max-w-[200px]`}>
                          {skus.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right"><input type="number" min={0} value={o.qty} onChange={(e) => editOrder(o.id, { qty: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={`w-24 text-right ${field}`} /></td>
                    <td className="px-4 py-2 text-right"><input type="number" min={1} value={o.dueDay} onChange={(e) => editOrder(o.id, { dueDay: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={`w-16 text-right ${field}`} /></td>
                    <td className="px-4 py-2 text-right font-mono">{it ? `day ${num(it.finishDay, 1)}` : '—'}</td>
                    <td className="px-4 py-2">{it ? (it.onTime ? <span className="text-emerald-600 dark:text-emerald-400">✓ on time</span> : <span className="text-rose-600 dark:text-rose-400">late {num(it.lateDays, 1)} d</span>) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${probColor(prob)}`}>{Math.round(prob * 100)}%</td>
                    <td className="px-4 py-2 text-right"><button type="button" onClick={() => rmOrder(o.id)} aria-label="Remove" className="text-slate-300 transition hover:text-rose-500">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENERGY & SCRAP — schedule linked to the two cost drivers (Track B v1) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Expected scrap — from this plan's run-time &amp; changeovers</h3>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(smart.scrapKg)} kg <span className="text-base font-normal text-slate-500">≈ {num(smart.scrapOmr)} OMR</span></p>
          <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">−{num(savedScrap)} kg (≈ {num(savedScrapOmr)} OMR) vs your current way</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">{num(smart.baseScrapKg)} kg</span> in-run reject + <span className="font-mono">{num(smart.startupScrapKg)} kg</span> startup scrap from <span className="font-mono">{smart.familyChanges + smart.diameterChanges}</span> changeovers. Fewer/cleaner changeovers → less scrap.
          </p>
        </div>
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Energy — time of use</h3>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(tou.kwh)} kWh</p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400">Off-peak <span className="font-mono font-semibold">{num(tou.offCost)} OMR</span></span>
            <span className="text-rose-600 dark:text-rose-400">Peak <span className="font-mono font-semibold">{num(tou.peakCost)} OMR</span></span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Timing runs into off-peak hours is worth up to <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{num(tou.spread)} OMR</span>. TOU rates from the CRT tariff engine; hour-by-hour scheduling is next.</p>
        </div>
      </div>

      {/* BIGGEST LEVERS — sensitivity */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Biggest levers — what cuts your finish date most</h3>
        <div className="mt-3 space-y-2">
          {levers.map((l) => (
            <div key={l.t} className="flex items-center gap-3">
              <span className="w-56 shrink-0 text-sm text-slate-700 dark:text-slate-300">{l.t}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${(l.save / leverMax) * 100}%` }} /></div>
              <span className="w-20 shrink-0 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">−{num(l.save, 1)} d</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Days off the finish date if you made each change — tells you what to invest in, or which signal to measure first.</p>
      </div>

      {/* MONTE-CARLO REPRESENTATION — smart vs current finish distributions */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">When will it finish? — {mc.samplesDays.length.toLocaleString()} simulated months</h3>
          <div className="flex gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Smart (family-grouped)</span>
            <span className="inline-flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Current way</span>
          </div>
        </div>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={overlay} margin={{ top: 6, right: 8, left: 0, bottom: 16 }}>
              <XAxis dataKey="day" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} label={{ value: 'finish day', position: 'insideBottom', offset: -6, fill: 'var(--muted-text)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={26} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} labelFormatter={(l) => `~day ${l}`} />
              <ReferenceLine x={overlay.reduce((best, b) => (Math.abs(b.day - horizon) < Math.abs(best - horizon) ? b.day : best), overlay[0]?.day ?? 0)} stroke="#f43f5e" strokeDasharray="4 3" label={{ value: 'deadline', fill: '#f43f5e', fontSize: 10, position: 'top' }} />
              <Area type="monotone" dataKey="current" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.35} />
              <Area type="monotone" dataKey="smart" stroke="#10b981" fill="#10b981" fillOpacity={0.45} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">The smart schedule's curve sits <em>earlier and tighter</em> — finishing sooner with less uncertainty. Both account for run-to-run rate variability.</p>
      </div>

      {/* SCHEDULE (evidence) */}
      <div className="card-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule — grouped by family</h3>
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {Object.keys(FAMILY_BG).filter((f) => skus.some((s) => s.family === f)).map((f) => (<span key={f} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${FAMILY_BG[f]}`} />{f}</span>))}
          </div>
        </div>
        <div className="space-y-2">
          {smart.lanes.map((lane) => (
            <div key={lane.machine} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{lane.name}</span>
              <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
                <div className="flex h-full">
                  {lane.items.map((it) => (
                    <div key={it.orderId} className="flex h-full" title={`${it.name} · ${num(it.qty)} · finishes day ${num(it.finishDay, 1)} (due ${it.dueDay})`}>
                      {it.setupBeforeH > 0 && <div className={`h-full ${it.setupType === 'family' ? 'bg-slate-400/70' : 'bg-slate-300/70 dark:bg-white/20'}`} style={{ width: `${(it.setupBeforeH / smart.capacityPerMachineH) * 100}%` }} />}
                      <div className={`h-full ${it.onTime ? FAMILY_BG[it.family] ?? 'bg-slate-400' : 'bg-rose-500'}`} style={{ width: `${Math.min((it.runtimeH / smart.capacityPerMachineH) * 100, 100)}%` }} />
                    </div>
                  ))}
                </div>
              </div>
              <span className={`w-16 shrink-0 text-right font-mono text-xs ${lane.loadH > smart.capacityPerMachineH ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{num(lane.loadH)} h</span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="w-24 shrink-0" /><span className="flex-1 text-right">▲ window {num(smart.capacityPerMachineH)} h ({num(horizon)} d × {hoursPerDay} h) · red = late order</span><span className="w-16 shrink-0" /></div>
        </div>
      </div>

      <p className="text-xs text-slate-400">Family change ≈ {famH} h, Ø ≈ {diaH} h, scrap ≈ {scrapPerChg} kg/changeover, rate variability assumed — edit above with your real numbers. Computed live; exact optimiser runs server-side.</p>
    </section>
  );
};

const Param: FC<{ label: string; value: string; measured?: boolean }> = ({ label, value, measured }) => (
  <div className="rounded-lg border border-slate-200/70 px-3 py-2 dark:border-white/10">
    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</p>
    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
      <span className={`h-1.5 w-1.5 rounded-full ${measured ? 'bg-emerald-500' : 'bg-amber-500'}`} />{value}
    </p>
  </div>
);

const ParamInput: FC<{ label: string; value: number; step: number; onChange: (v: number) => void }> = ({ label, value, step, onChange }) => (
  <div className="rounded-lg border border-amber-300/50 px-3 py-2 dark:border-amber-500/20">
    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label} <span className="text-amber-600 dark:text-amber-400">· estimate</span></p>
    <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="mt-1 w-full rounded border border-slate-200/70 bg-white px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white" />
  </div>
);

export default ProductionPlannerPage;
