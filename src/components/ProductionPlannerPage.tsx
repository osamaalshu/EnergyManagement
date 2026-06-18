import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { productionData } from '../data/productionData';
import {
  buildSchedule, monteCarloFit, PERIODS, DEMO_SKUS, DEMO_LINE, DEMO_ECON,
  type SkuParam, type LineParam, type Econ, type ScheduleItem,
} from '../lib/productionModel';

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Other: 'bg-slate-400',
};
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });

const ProductionPlannerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const { meta, model } = productionData;
  const [dataset, setDataset] = useState<'pilot' | 'demo'>('demo');
  const skus: SkuParam[] = dataset === 'demo' ? DEMO_SKUS : (model.skus as SkuParam[]);
  const line: LineParam = dataset === 'demo' ? DEMO_LINE : {
    machineKw: model.line.machineKw, changeoverH: model.line.changeoverH, changeoverKw: model.line.changeoverKw,
    nMachines: model.line.nMachines, machineNames: model.line.machineNames,
  };
  const econ: Econ = dataset === 'demo' ? DEMO_ECON : model.economics;

  const [period, setPeriod] = useState<keyof typeof PERIODS>('month');
  const [unit, setUnit] = useState<'pieces' | 'kg'>('pieces');
  const [hoursPerDay, setHoursPerDay] = useState(24);
  const [machines, setMachines] = useState(line.nMachines || 1);
  const [demandX, setDemandX] = useState(1);
  const [famH, setFamH] = useState(3);
  const [diaH, setDiaH] = useState(0.5);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [policies, setPolicies] = useState<Record<string, 'MTO' | 'MTS'>>({});
  const policyOf = (id: string) => policies[id] ?? 'MTO';

  const days = PERIODS[period].days;
  const defaultPieces = (s: SkuParam) => Math.round((s.demand * days * demandX) / 365);
  const piecesOf = (s: SkuParam) => edits[s.id] ?? defaultPieces(s);

  const chooseDataset = (ds: 'pilot' | 'demo') => {
    setDataset(ds); setMachines((ds === 'demo' ? DEMO_LINE.nMachines : model.line.nMachines) || 1);
    setEdits({}); setDemandX(1);
  };
  const setDemandScale = (x: number) => { setDemandX(x); setEdits({}); };

  const pieces = useMemo(() => Object.fromEntries(skus.map((s) => [s.id, piecesOf(s)])), [skus, edits, period, demandX]);
  const sched = useMemo(() => buildSchedule(skus, pieces, days, machines, line, econ, hoursPerDay, famH, diaH),
    [skus, pieces, days, machines, line, econ, hoursPerDay, famH, diaH]);
  const cap = sched.capacityPerMachineH;
  const mc = useMemo(() => monteCarloFit(sched, cap, hoursPerDay), [sched, cap, hoursPerDay]);

  const holding = useMemo(() => {
    let inv = 0, omr = 0;
    for (const s of skus) {
      const p = pieces[s.id] ?? 0; const stock = policyOf(s.id) === 'MTS' ? p / 2 : p * 0.05;
      inv += stock; omr += stock * s.kgPerUnit * econ.materialOmrPerKg * econ.holdingRateAnnual * (days / 365);
    }
    return { inv: Math.round(inv), omr: Math.round(omr) };
  }, [skus, pieces, policies, econ, days]);
  const totalCost = sched.costOmr + holding.omr;
  const savedOmr = Math.round(sched.savedH * line.changeoverKw * econ.elecOmrPerKwh);
  const bottleneck = sched.lanes.reduce((a, l) => (l.loadH > a.loadH ? l : a), sched.lanes[0]);

  // top moves — ranked, actionable
  const moves = useMemo(() => {
    const omrOf = (h: number) => Math.round(h * line.changeoverKw * econ.elecOmrPerKwh);
    const list: { t: string; d: string; h: number; soft?: boolean }[] = [];
    if (sched.savedH > 0.5) list.push({ t: 'Sequence by family, then diameter', d: `vs running ungrouped (${sched.familyChanges} family + ${sched.diameterChanges} Ø changes)`, h: sched.savedH });
    const fam: Record<string, Set<number>> = {};
    sched.items.forEach((it) => { (fam[it.family] ??= new Set()).add(it.machine); });
    const splits = Object.entries(fam).filter(([, m]) => m.size > 1).map(([f]) => f);
    if (splits.length) list.push({ t: 'Keep each family on one machine', d: `${splits.join(', ')} ${splits.length > 1 ? 'are' : 'is'} split across machines`, h: splits.length * famH });
    if (!sched.fits) list.push({ t: 'Add capacity to hit the deadline', d: `${num(sched.makespanDays - days, 1)} days over — add a machine or a shift`, h: 0, soft: true });
    const big = [...sched.items].sort((a, b) => b.runtimeH - a.runtimeH)[0];
    if (big && sched.items.length > 2) list.push({ t: `Make ${big.name} to stock`, d: 'highest-volume runner — build ahead to smooth next month', h: 0, soft: true });
    return list.map((m) => ({ ...m, omr: omrOf(m.h) })).sort((a, b) => b.h - a.h);
  }, [sched, line, econ, famH, days]);

  const toDisplay = (s: SkuParam, p: number) => unit === 'kg' ? Math.round(p * s.kgPerUnit) : p;
  const setQty = (s: SkuParam, v: string) => {
    const n = Math.max(0, Math.round(Number(v) || 0));
    setEdits((e) => ({ ...e, [s.id]: unit === 'kg' ? Math.round(n / Math.max(s.kgPerUnit, 1e-9)) : n }));
  };
  const famHoursH = sched.familyChanges * famH, diaHoursH = sched.diameterChanges * diaH;
  const totalH = Math.max(sched.productionH + famHoursH + diaHoursH, 1);
  const field = 'rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-white';
  const chip = (on: boolean) => `rounded-md px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`;

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
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Production Planner</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Plan your month, test a rush order, see what it saves.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['pilot', 'Pilot · 2'], ['demo', 'Full plant · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => chooseDataset(ds)} className={chip(dataset === ds)}>{label}</button>
          ))}
        </div>
      </div>

      {/* VERDICT — value-led */}
      <div className={`rounded-2xl border p-5 ${sched.fits ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-rose-300/60 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${sched.fits ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {sched.fits ? `✓ ${Math.round(mc.pFit * 100)}% chance it's done within the ${PERIODS[period].label.toLowerCase()}` : `✗ ${num(sched.makespanDays - days, 1)} days over the ${PERIODS[period].label.toLowerCase()}`}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
          {num(sched.items.length)} products · finishes in <span className="font-mono">{num(sched.makespanDays, 1)}</span> of {num(days)} days
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Running them in the right order saves <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{num(sched.savedH, 1)} h</span> of changeover
          <span className="text-slate-400"> (≈ {num(savedOmr)} OMR energy)</span> vs running ungrouped — that's machine time back for more product.
          Bottleneck: {bottleneck?.name} at <span className="font-mono">{Math.round(sched.utilization * 100)}%</span>. Typical finish <span className="font-mono">{num(mc.p50Days, 1)}d</span>, bad run <span className="font-mono">{num(mc.p90Days, 1)}d</span>.
        </p>
      </div>

      {/* WHAT-IF — the play */}
      <div className="card-surface p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Demand</span>
            <div className="mt-1 inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
              {([[1, 'Normal'], [1.5, 'Rush +50%'], [2, 'Surge ×2']] as const).map(([x, l]) => (
                <button key={x} type="button" onClick={() => setDemandScale(x)} className={chip(demandX === x)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Plan for</span>
            <div className="mt-1 inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
              {Object.entries(PERIODS).map(([k, p]) => (<button key={k} type="button" onClick={() => setPeriod(k as keyof typeof PERIODS)} className={chip(period === k)}>{p.label}</button>))}
            </div>
          </div>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Machines</span><input type="number" min={1} max={6} value={machines} onChange={(e) => setMachines(Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 block w-20 ${field}`} /></label>
          <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours / day</span><input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 1))))} className={`mt-1 block w-20 ${field}`} /></label>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Quantities</span>
            <div className="mt-1 inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
              {(['pieces', 'kg'] as const).map((u) => (<button key={u} type="button" onClick={() => setUnit(u)} className={`capitalize ${chip(unit === u)}`}>{u}</button>))}
            </div>
          </div>
          <div className="flex items-end gap-2 border-l border-slate-200/60 pl-4 dark:border-white/10">
            <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Family Δ (h)</span><input type="number" min={0} step={0.5} value={famH} onChange={(e) => setFamH(Math.max(0, Number(e.target.value) || 0))} className={`mt-1 block w-16 ${field}`} /></label>
            <label className="block"><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ø Δ (h)</span><input type="number" min={0} step={0.25} value={diaH} onChange={(e) => setDiaH(Math.max(0, Number(e.target.value) || 0))} className={`mt-1 block w-16 ${field}`} /></label>
          </div>
        </div>
      </div>

      {/* TOP MOVES — what to do */}
      <div className="card-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Top moves — biggest wins first</h3>
        <div className="mt-3 space-y-2">
          {moves.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-4 py-3 dark:border-white/10">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-semibold text-accent">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{m.t}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{m.d}</p>
              </div>
              {m.soft
                ? <span className="shrink-0 text-xs font-medium text-slate-400">try it →</span>
                : <span className="shrink-0 text-right"><span className="block font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{num(m.h, 1)} h</span><span className="text-[11px] text-slate-400">≈ {num(m.omr)} OMR</span></span>}
            </div>
          ))}
        </div>
      </div>

      {/* GANTT */}
      <div className="card-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule · {PERIODS[period].label}</h3>
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {Object.keys(FAMILY_BG).filter((f) => skus.some((s) => s.family === f)).map((f) => (<span key={f} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${FAMILY_BG[f]}`} />{f}</span>))}
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-white/20" />changeover</span>
          </div>
        </div>
        <div className="space-y-2">
          {sched.lanes.map((lane) => (
            <div key={lane.machine} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-700 dark:text-slate-300">{lane.name}</span>
              <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
                <div className="flex h-full">
                  {lane.items.map((it) => (
                    <div key={it.id} className="flex h-full" title={`${it.name} · ${num(it.pieces)} pcs · ${num(it.runtimeH, 1)} h${it.setupBeforeH ? ` · ${it.setupType} changeover ${it.setupBeforeH}h` : ''}`}>
                      {it.setupBeforeH > 0 && <div className={`h-full ${it.setupType === 'family' ? 'bg-slate-400/70' : 'bg-slate-300/70 dark:bg-white/20'}`} style={{ width: `${(it.setupBeforeH / cap) * 100}%` }} />}
                      <div className={`flex h-full items-center ${FAMILY_BG[it.family] ?? 'bg-slate-400'} px-1.5`} style={{ width: `${Math.min((it.runtimeH / cap) * 100, 100)}%` }}><span className="truncate text-[10px] font-semibold text-white">{it.diameterMm}</span></div>
                    </div>
                  ))}
                </div>
                {lane.loadH > cap && <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-rose-500 px-1 text-[10px] font-semibold text-white">over</span>}
              </div>
              <span className={`w-16 shrink-0 text-right font-mono text-xs ${lane.loadH > cap ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{num(lane.loadH)} h</span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="w-24 shrink-0" /><span className="flex-1 text-right">▲ {PERIODS[period].label.toLowerCase()} capacity {num(cap)} h ({num(days)} d × {hoursPerDay} h)</span><span className="w-16 shrink-0" /></div>
        </div>
        <div className="mt-4">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Where the time goes</p>
          <div className="flex h-3 overflow-hidden rounded-full">
            <div className="bg-slate-400" style={{ width: `${(sched.productionH / totalH) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(famHoursH / totalH) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(diaHoursH / totalH) * 100}%` }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span><span className="font-mono">{num(sched.productionH)} h</span> producing</span>
            <span className="text-rose-600 dark:text-rose-400"><span className="font-mono">{num(famHoursH, 1)} h</span> family changes ({sched.familyChanges})</span>
            <span className="text-amber-600 dark:text-amber-400"><span className="font-mono">{num(diaHoursH, 1)} h</span> Ø changes ({sched.diameterChanges})</span>
          </div>
        </div>
      </div>

      {/* RISK + COST */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost &amp; stock</h3>
          <div className="mt-3 space-y-2 text-sm">
            <KpiRow label="Energy" value={`${num(sched.costOmr)} OMR`} />
            <KpiRow label="Stock held" value={`${num(holding.inv)} units`} />
            <KpiRow label="Holding" value={`${num(holding.omr)} OMR`} />
            <div className="border-t border-slate-200/60 dark:border-white/10" />
            <KpiRow label="Total cost" value={`${num(totalCost)} OMR`} strong />
          </div>
        </div>
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Will it fit? — finish-time risk</h3>
            <span className="text-xs text-slate-400">deadline {num(mc.deadlineDays, 1)} d</span>
          </div>
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mc.hist} margin={{ top: 6, right: 8, left: 0, bottom: 14 }}>
                <XAxis dataKey="day" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} label={{ value: 'finish (days)', position: 'insideBottom', offset: -6, fill: 'var(--muted-text)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={26} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number) => [`${v} runs`, 'count']} labelFormatter={(l) => `${l} days`} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>{mc.hist.map((b, i) => (<Cell key={i} fill={b.over ? '#f43f5e' : '#34d399'} />))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Each bar = a simulated month with real rate variability. Green finishes in time, red misses — <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(mc.pFit * 100)}%</span> land green.</p>
        </div>
      </div>

      {/* RUN SHEET */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Run sheet</h3>
          <span className="text-[11px] text-slate-400">edit a quantity to replan · set MTO/MTS per product</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Product</th><th className="px-4 py-2">Family</th><th className="px-4 py-2">Policy</th><th className="px-4 py-2 text-right">Ø</th><th className="px-4 py-2 text-right">Qty ({unit})</th><th className="px-4 py-2">Machine</th><th className="px-4 py-2 text-right">Run (h)</th><th className="px-4 py-2">Changeover</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {[...sched.items].sort((a, b) => a.machine - b.machine || a.seq - b.seq).map((it: ScheduleItem) => {
                const s = skus.find((x) => x.id === it.id)!;
                return (
                  <tr key={it.machine + '-' + it.id}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">{it.seq}</td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{it.name}</td>
                    <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[it.family] ?? 'bg-slate-400'}`} />{it.family}</span></td>
                    <td className="px-4 py-2"><div className="inline-flex rounded-md border border-slate-200/70 p-0.5 dark:border-white/10">{(['MTO', 'MTS'] as const).map((pol) => (<button key={pol} type="button" onClick={() => setPolicies((e) => ({ ...e, [it.id]: pol }))} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${policyOf(it.id) === pol ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>{pol}</button>))}</div></td>
                    <td className="px-4 py-2 text-right font-mono">{it.diameterMm}</td>
                    <td className="px-4 py-2 text-right"><input type="number" min={0} value={toDisplay(s, it.pieces)} onChange={(e) => setQty(s, e.target.value)} className={`w-24 text-right ${field}`} /></td>
                    <td className="px-4 py-2 text-xs">{it.machineName}</td>
                    <td className="px-4 py-2 text-right font-mono">{num(it.runtimeH, 1)}</td>
                    <td className="px-4 py-2 text-xs">{it.setupType === 'family' ? <span className="text-rose-600 dark:text-rose-400">family +{it.setupBeforeH}h</span> : it.setupType === 'diameter' ? <span className="text-amber-600 dark:text-amber-400">Ø +{it.setupBeforeH}h</span> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">Family change ≈ {famH} h, diameter ≈ {diaH} h, rate variability assumed — edit Family Δ / Ø Δ above with your real times. Computed live; exact optimiser runs server-side. {meta.note}</p>
    </section>
  );
};

const KpiRow: FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className={`font-mono tabular-nums ${strong ? 'text-base font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{value}</span>
  </div>
);

export default ProductionPlannerPage;
