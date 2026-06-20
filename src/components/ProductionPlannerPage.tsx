import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { productionData } from '../data/productionData';
import {
  scheduleOrders, monteCarloOrders, energyIntensityKwhPerKg, RATE_CV, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type SkuParam, type LineParam, type Econ, type Order, type OrderItem,
} from '../lib/productionModel';
import { effectiveRateOmrPerKwh, TARIFF_SCHEDULE_VERSION } from '../lib/tariffEngine';
import ScenarioBanner from './ScenarioBanner';

// Representative days for Time-of-Use pricing — Oman summer/winter, factory LV.
const TOU_VOLTAGE = '0.415kV';
const TOU_SEASON_DATE: Record<'summer' | 'winter', string> = { summer: '2025-07-15', winter: '2025-12-15' };
const hhmm = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
const heat = (v: number, max: number, rgb: string) => ({ background: `rgba(${rgb},${0.06 + 0.5 * (max > 0 ? v / max : 0)})` });

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Other: 'bg-slate-400',
};
const SCENARIO_BANNER_TEXT = 'Scenario — figures use a generated order book, not your live orders. Connect the order book to make this operational.';
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
type Strategy = 'grouped' | 'balanced' | 'due';
const STRATEGY_LABEL: Record<Strategy, string> = { grouped: 'Fewest changeovers', balanced: 'Balanced', due: 'Meet due dates' };
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
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('pilot');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const products = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, s])), [skus]);
  const line: LineParam = useMemo(() => (dataset === 'demo' ? DEMO_LINE : {
    machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw,
    nMachines: model.line.nMachines, machineNames: model.line.machineNames,
  }), [dataset, model.line]);
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;

  const [horizon, setHorizon] = useState(30);
  const [hoursPerDay, setHoursPerDay] = useState(16);
  // Pilot scope: plan Machine 01 only. The other extruders run different dies at
  // different rates and power, and we haven't calibrated them yet — modelling them
  // with MC01's numbers would be a guess dressed up as data. One machine, honest.
  const machines = 1;
  const [shiftStart, setShiftStart] = useState(22); // hour the daily shift begins (TOU lever)
  const [season, setSeason] = useState<'summer' | 'winter'>('summer');
  const [rateCv, setRateCv] = useState(RATE_CV);
  const [famH, setFamH] = useState(3);
  const [diaH, setDiaH] = useState(0.5);
  const [scrapPerChg, setScrapPerChg] = useState(10);
  const [strategy, setStrategy] = useState<Strategy>('balanced');
  const [showParams, setShowParams] = useState(false);
  const [q, setQ] = useState('');
  const match = (name: string) => !q.trim() || name.toLowerCase().includes(q.toLowerCase());
  const [orders, setOrders] = useState<Order[]>(() => genOrders(model.skus as SkuParam[], 30));

  const chooseDataset = (ds: 'pilot' | 'demo') => {
    const list = ds === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
    setDataset(ds);
    setOrders(genOrders(list, horizon));
  };
  const editOrder = (id: string, patch: Partial<Order>) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const addOrder = () => setOrders((os) => [...os, { id: `o${++_uid}`, productId: skus[0].id, qty: 500, dueDay: horizon }]);
  const rmOrder = (id: string) => setOrders((os) => os.filter((o) => o.id !== id));

  const smart = useMemo(() => scheduleOrders(orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, strategy),
    [orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, strategy]);
  const current = useMemo(() => scheduleOrders(orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg, 'due'),
    [orders, products, horizon, machines, line, econ, hoursPerDay, famH, diaH, scrapPerChg]);
  const mc = useMemo(() => monteCarloOrders(smart, hoursPerDay, rateCv), [smart, hoursPerDay, rateCv]);
  const mcCur = useMemo(() => monteCarloOrders(current, hoursPerDay, rateCv), [current, hoursPerDay, rateCv]);
  const overlay = useMemo(() => (mc.samplesDays.length && mcCur.samplesDays.length ? binTwo(mc.samplesDays, mcCur.samplesDays) : []), [mc, mcCur]);
  const intensityData = useMemo(() => skus
    .map((s) => ({ id: s.id, name: s.name || s.id, kwhPerKg: energyIntensityKwhPerKg(line.machineKw, s.rateEffective, s.kgPerUnit) }))
    .sort((a, b) => b.kwhPerKg - a.kwhPerKg), [skus, line]);

  const itemByOrder = useMemo(() => { const map: Record<string, OrderItem> = {}; smart.items.forEach((it) => { map[it.orderId] = it; }); return map; }, [smart]);
  const savedChg = Math.round((current.changeoverH - smart.changeoverH) * 10) / 10;
  const savedScrap = Math.round(current.scrapKg - smart.scrapKg);
  const savedScrapOmr = Math.round(savedScrap * econ.materialOmrPerKg);
  const onTimePct = Math.round(mc.pAllOnTime * 100);

  // Energy & Time-of-Use: total machine-on energy, priced peak vs off-peak (the timing lever)
  // real CRT rate for each hour of the representative day
  const hourlyRates = useMemo(() => {
    const date = TOU_SEASON_DATE[season];
    return Array.from({ length: 24 }, (_, h) => effectiveRateOmrPerKwh(`${date}T${String(h).padStart(2, '0')}:00:00`, TOU_VOLTAGE));
  }, [season]);
  const medRate = useMemo(() => [...hourlyRates].sort((a, b) => a - b)[12], [hourlyRates]);

  // Price one run by WHEN it actually runs. The machine works a daily shift of
  // `hoursPerDay` starting at clock hour `start`, so machine-elapsed hours map onto
  // the repeating shift window — shifting `start` slides every run across the
  // tariff bands. At 24 h/day the window is the whole clock, so there's nothing to
  // dodge; below that, choosing the start hour is a real money lever.
  const priceRun = (elapsedAtStart: number, runtimeH: number, start: number) => {
    let kwh = 0, omr = 0, peakH = 0, t = elapsedAtStart, rem = runtimeH;
    while (rem > 1e-9) {
      const step = Math.min(1, rem);
      const hod = (start + Math.floor(((t % hoursPerDay) + hoursPerDay) % hoursPerDay)) % 24;
      const r = hourlyRates[hod];
      kwh += line.machineKw * step; omr += line.machineKw * step * r; if (r > medRate) peakH += step;
      t += step; rem -= step;
    }
    return { kwh, omr, peakFrac: runtimeH ? peakH / runtimeH : 0 };
  };

  // TOU lever: scan every shift-start hour, price the whole plan at each, and find
  // the cheapest. The manager sees what their current start costs and what the best
  // start would save — then applies it with one click.
  const tou = useMemo(() => {
    const omrAt = (start: number) => smart.items.reduce((a, it) => a + priceRun(it.startH, it.runtimeH, start).omr, 0);
    const kwh = smart.items.reduce((a, it) => a + it.runtimeH, 0) * line.machineKw;
    const starts = Array.from({ length: 24 }, (_, h) => ({ h, omr: omrAt(h) }));
    const best = starts.reduce((b, s) => (s.omr < b.omr ? s : b), starts[0]);
    const worst = starts.reduce((b, s) => (s.omr > b.omr ? s : b), starts[0]);
    const nowOmr = omrAt(shiftStart);
    return {
      kwh: Math.round(kwh), nowOmr: Math.round(nowOmr),
      bestH: best.h, bestOmr: Math.round(best.omr), worstOmr: Math.round(worst.omr),
      saveIfBest: Math.round(nowOmr - best.omr), spread: Math.round(worst.omr - best.omr),
      full24: hoursPerDay >= 24,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart, line, hoursPerDay, hourlyRates, medRate, shiftStart]);

  // Per-run breakdown: each run's expected scrap (this product's own benchmark) + energy priced by when it runs
  const detail = useMemo(() => {
    const items = [...smart.items].sort((a, b) => a.machine - b.machine || a.seq - b.seq);
    const rows = items.map((it) => {
      const p = products[it.productId];
      const reject = it.qty * (p?.kgPerUnit ?? 0) * (p?.meanRejection ?? 0);
      const startup = it.setupBeforeH > 0 ? scrapPerChg : 0;
      const e = priceRun(it.startH, it.runtimeH, shiftStart);
      return { it, scrap: reject + startup, reject, startup, kwh: e.kwh, omr: e.omr, band: e.peakFrac > 0.5 ? 'peak' : e.peakFrac > 0.05 ? 'mixed' : 'off-peak' };
    });
    return { rows, maxScrap: Math.max(...rows.map((r) => r.scrap), 1), maxOmr: Math.max(...rows.map((r) => r.omr), 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart, products, scrapPerChg, hourlyRates, medRate, line, hoursPerDay, shiftStart]);

  // Biggest levers — what moves the finish date / risk most (so you know what to fix or measure)
  const levers = useMemo(() => {
    const base = smart.makespanDays;
    const reRun = (h: number, fh: number, dh: number) =>
      scheduleOrders(orders, products, horizon, machines, line, econ, h, fh, dh, scrapPerChg, strategy).makespanDays;
    const out = [
      { t: 'Run +4 hours/day', save: base - reRun(Math.min(24, hoursPerDay + 4), famH, diaH) },
      { t: 'Halve changeover time', save: base - reRun(hoursPerDay, famH / 2, diaH / 2) },
      { t: 'Stabilise run rates (less variability)', save: Math.max(0, (mc.samplesDays[Math.floor(0.9 * (mc.samplesDays.length - 1))] || 0) - (monteCarloOrders(smart, hoursPerDay, rateCv / 2, 600).samplesDays[Math.floor(0.9 * 599)] || 0)) },
    ].map((l) => ({ ...l, save: Math.max(0, Math.round(l.save * 10) / 10) })).sort((a, b) => b.save - a.save);
    return out;
  }, [smart, orders, products, horizon, line, econ, hoursPerDay, famH, diaH, scrapPerChg, strategy, mc, rateCv]);
  const leverMax = Math.max(...levers.map((l) => l.save), 0.1);

  const field = 'rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white';
  const chip = (on: boolean) => `rounded-md px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`;
  const probColor = (p: number) => p >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : p >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <section className="space-y-6">
      <ScenarioBanner text={SCENARIO_BANNER_TEXT} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Order Planner <span className="align-middle text-xs font-medium text-slate-400">· Machine 01</span></h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your orders in, on-time confidence out. Flag the must-ship ones, dodge peak tariff, watch a rush order land.</p>
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
          <span className="font-medium">{STRATEGY_LABEL[strategy]}</span> · steady-state run time <span className="font-mono font-semibold">{Math.round(smart.steadyStatePct * 100)}%</span> · saves <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{num(savedChg, 1)} h</span> changeover &amp; <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{num(savedScrap)} kg</span> scrap vs running ungrouped.
          {smart.lateOrders.length > 0 && <span className="text-rose-600 dark:text-rose-400"> At risk: {smart.lateOrders.map((l) => l.name).slice(0, 3).join(', ')}{smart.lateOrders.length > 3 ? '…' : ''}.</span>}
        </p>
      </div>

      {/* YOUR DECISIONS — only what a manager controls */}
      <div className="card-surface flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">You decide</span>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Planning window</span><div className="mt-1 flex items-center gap-1"><input type="number" min={1} value={horizon} onChange={(e) => setHorizon(Math.max(1, Math.round(Number(e.target.value) || 1)))} className={`w-20 ${field}`} /><span className="text-xs text-slate-400">days</span></div></label>
        <div className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Machine</span><div className="mt-1 flex h-[34px] items-center rounded-lg border border-slate-200/70 bg-slate-50 px-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400" title="Pilot scope: MC01 is the only extruder we've calibrated. Others run different dies at different rates and power.">01 only</div></div>
        <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours / day (shift length)</span><input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 block w-20 ${field}`} /></label>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance</span>
          <div className="mt-1 inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
            {(['grouped', 'balanced', 'due'] as Strategy[]).map((s) => (
              <button key={s} type="button" onClick={() => setStrategy(s)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${strategy === s ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{STRATEGY_LABEL[s]}</button>
            ))}
          </div>
        </div>
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
              <ParamInput label="Rate variability (CV)" value={rateCv} step={0.05} onChange={setRateCv} />
              <ParamInput label="Changeover — family (h)" value={famH} step={0.5} onChange={setFamH} />
              <ParamInput label="Changeover — diameter (h)" value={diaH} step={0.25} onChange={setDiaH} />
              <ParamInput label="Scrap per changeover (kg)" value={scrapPerChg} step={1} onChange={setScrapPerChg} />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Run rates and reject rates come straight from your records. Rate variability (CV), changeover times and startup scrap are <span className="text-amber-600 dark:text-amber-400">estimates today</span> — when the line's changeover log and sensors are connected, these calibrate automatically and turn measured. You never type these as a manager; they're shown here for transparency.</p>
          </div>
        )}
      </div>

      {/* ORDER BOOK — input + outcome per order */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Order book</h3>
          <div className="flex items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…" className="rounded-lg border border-slate-200/70 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-slate-200" />
            <button type="button" onClick={addOrder} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent/90">+ Add order</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2" title="Must-ship: forces this order to the front of the line">★</th><th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Due (day)</th><th className="px-4 py-2 text-right">Finishes</th><th className="px-4 py-2">On time?</th><th className="px-4 py-2 text-right">Confidence</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {orders.filter((o) => match(products[o.productId]?.name ?? '')).map((o) => {
                const it = itemByOrder[o.id]; const prob = mc.onTimeProb[o.id] ?? 1; const p = products[o.productId];
                return (
                  <tr key={o.id} className={o.priority ? 'bg-amber-50/60 dark:bg-amber-500/5' : ''}>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => editOrder(o.id, { priority: !o.priority })} aria-label={o.priority ? 'Remove priority' : 'Mark must-ship'} aria-pressed={!!o.priority} title={o.priority ? 'Must-ship — runs first' : 'Mark as must-ship'} className={`text-base leading-none transition ${o.priority ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'}`}>{o.priority ? '★' : '☆'}</button>
                    </td>
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Energy — run off-peak</h3>
            <span className="text-[11px] text-slate-400">{num(tou.kwh)} kWh total</span>
          </div>
          <div className="mt-3 inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
            {(['summer', 'winter'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSeason(s)} className={chip(season === s)}>{s === 'summer' ? 'Summer' : 'Winter'}</button>
            ))}
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(tou.nowOmr)} OMR <span className="text-base font-normal text-slate-500">at this plan's energy</span></p>
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Shift starts</span>
              <div className="mt-1 flex items-center gap-1"><input type="number" min={0} max={23} value={shiftStart} onChange={(e) => setShiftStart(((Math.round(Number(e.target.value) || 0)) % 24 + 24) % 24)} className={`w-16 ${field}`} /><span className="text-xs text-slate-400">:00</span></div>
            </label>
            {tou.full24 ? (
              <span className="pb-1 text-xs text-slate-400">Running 24 h/day — the whole clock is used, so there's no off-peak window to shift into. Drop hours/day to free a choice.</span>
            ) : tou.saveIfBest > 0 ? (
              <button type="button" onClick={() => setShiftStart(tou.bestH)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600">Start at {hhmm(tou.bestH)} → save {num(tou.saveIfBest)} OMR</button>
            ) : (
              <span className="pb-1 text-xs text-emerald-600 dark:text-emerald-400">Already on the cheapest start ({hhmm(tou.bestH)}).</span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Best vs worst start hour is worth <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{num(tou.spread)} OMR</span> on this plan. Priced on the live <span className="font-medium">CRT {TARIFF_SCHEDULE_VERSION}</span> tariff (0.415 kV, {season}) by the clock-hours each run lands on. In winter the CRT tariff bands are flat, with no peak/off-peak spread, so this lever only saves money in summer.</p>
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
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> {STRATEGY_LABEL[strategy]}</span>
            <span className="inline-flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Meet due dates (baseline)</span>
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

      {/* PER-RUN DETAIL — every run: scrap (this product's benchmark) + energy by time-of-use */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Run-by-run detail</h3>
          <span className="text-[11px] text-slate-400">scrap = each product's own benchmark · energy priced by when it runs · shaded = bigger</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr>
                <th className="px-3 py-2">#</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Run h</th>
                <th className="px-3 py-2">Changeover</th><th className="px-3 py-2 text-right">Finish d</th>
                <th className="px-3 py-2 text-right">Scrap kg</th><th className="px-3 py-2 text-right">Energy kWh</th><th className="px-3 py-2 text-right">kWh/kg</th>
                <th className="px-3 py-2">When</th><th className="px-3 py-2 text-right">Energy OMR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {detail.rows.filter(({ it }) => match(it.name)).map(({ it, scrap, reject, startup, kwh, omr, band }) => {
                const kg = it.qty * (products[it.productId]?.kgPerUnit ?? 0);
                return (
                  <tr key={it.machine + '-' + it.orderId}>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{it.seq}</td>
                    <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[it.family] ?? 'bg-slate-400'}`} /><span className="font-medium text-slate-900 dark:text-white">{it.name}</span></span></td>
                    <td className="px-3 py-1.5 text-xs">{it.machineName}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{num(it.qty)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{num(it.runtimeH, 1)}</td>
                    <td className="px-3 py-1.5 text-xs">{it.setupType === 'family' ? <span className="text-rose-600 dark:text-rose-400">family +{it.setupBeforeH}h</span> : it.setupType === 'diameter' ? <span className="text-amber-600 dark:text-amber-400">Ø +{it.setupBeforeH}h</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{num(it.finishDay, 1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={heat(scrap, detail.maxScrap, '244,63,94')} title={`reject ${num(reject)} + startup ${num(startup)} kg`}>{num(scrap)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{num(kwh)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{kg > 0 ? (kwh / kg).toFixed(2) : '—'}</td>
                    <td className="px-3 py-1.5 text-xs">{band === 'peak' ? <span className="text-rose-600 dark:text-rose-400">peak</span> : band === 'mixed' ? <span className="text-amber-600 dark:text-amber-400">mixed</span> : <span className="text-emerald-600 dark:text-emerald-400">off-peak</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={heat(omr, detail.maxOmr, '245,158,11')}>{num(omr, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200/60 px-5 py-4 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Energy intensity — kWh per kg by product</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intensityData} margin={{ top: 8, right: 16, left: 0, bottom: 50 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} angle={-35} textAnchor="end" height={56} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
                <YAxis tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number) => [v.toFixed(2), 'kWh/kg']} />
                <Bar dataKey="kwhPerKg" fill="#1A365D" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Run energy only — excludes changeover and time-of-use pricing. Higher = more energy per kg produced.</p>
        </div>
      </div>

      <p className="text-xs text-slate-400">Each product uses its own measured reject rate; startup scrap ≈ {scrapPerChg} kg/changeover and changeover times are estimates (see Model parameters). Energy priced on the CRT tariff by the clock-hours each run occupies (shift starts {hhmm(shiftStart)}). Plans Machine 01 only — other extruders aren't calibrated yet. Computed live; exact optimiser runs server-side.</p>
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
