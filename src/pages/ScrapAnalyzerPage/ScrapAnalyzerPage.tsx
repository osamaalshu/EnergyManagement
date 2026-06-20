import { type FC, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, LineChart, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { DEMO_SKUS, DEMO_ECON, type Econ } from '@/features/production-planning/productionModel';
import { scrapCatalog, type ScrapProduct } from '@/data/scrapCatalog';
import { CHART_TOP_N, placeholderKwhKgSeries, selectChartProducts, type ChartScope, type Granularity } from '@/features/production-planning/energyPlaceholder';
import { startupKpis } from '@/features/production-planning/startupKpis';

const FAMILY_BG: Record<string, string> = {
  Drainage: 'bg-accent', Pressure: 'bg-amber-500', Conduit: 'bg-emerald-500', Waste: 'bg-violet-500', Duct: 'bg-sky-500', Other: 'bg-slate-400',
};
const FAMILY_STROKE: Record<string, string> = {
  Drainage: '#1A365D', Pressure: '#FAB005', Conduit: '#10b981', Waste: '#8b5cf6', Duct: '#0ea5e9', Other: '#94a3b8',
};
const GRANULARITY_OPTIONS: Granularity[] = ['day', 'week', 'month', 'year'];
const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
const pct = (v: number | null, d = 1) => v == null ? '—' : `${(v * 100).toFixed(d)}%`;
const dateFmt = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const MIN_SAMPLES = 5; // fewer shift-records than this → reject rate is noisy, flag it

// Demo catalogue shaped like the real one, so the illustrative view still works.
const DEMO_PRODUCTS: ScrapProduct[] = DEMO_SKUS.map((s) => ({
  id: s.id, name: s.name, family: s.family, diameterMm: s.diameterMm,
  demand: s.demand, kgPerUnit: s.kgPerUnit, meanRejection: s.meanRejection, rateEffective: s.rateEffective,
  samples: 60, scrapKgObs: Math.round(s.demand * s.kgPerUnit * s.meanRejection),
  bestRejectOwn: null,
  shift1Reject: null, shift2Reject: null, monthly: [],
  kwhPerKgPlaceholder: 0.45,
}));

const ScrapAnalyzerPage: FC<{ onBack: () => void }> = ({ onBack }) => {
  const [dataset, setDataset] = useState<'real' | 'demo'>('real');
  const meta = scrapCatalog.meta;
  const products: ScrapProduct[] = dataset === 'real' ? scrapCatalog.products : DEMO_PRODUCTS;
  const econ: Econ = DEMO_ECON; // material price / holding — same economics either way

  const [famFilter, setFamFilter] = useState('All');
  const [confidentOnly, setConfidentOnly] = useState(false);
  const [scrapPerChg, setScrapPerChg] = useState(10); // kg purge per changeover (estimate)
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<string | null>(null);
  const [energyGranularity, setEnergyGranularity] = useState<Granularity>('month');
  const [chartScope, setChartScope] = useState<ChartScope>('top');

  const a = useMemo(() => {
    const base = products.map((s) => {
      const scrapKg = s.demand * s.kgPerUnit * s.meanRejection;
      const target = s.bestRejectOwn;
      const saving = target == null ? 0 : Math.max(0, s.meanRejection - target) * s.demand * s.kgPerUnit * econ.materialOmrPerKg;
      const lowData = s.samples < MIN_SAMPLES;
      return {
        id: s.id, name: s.name, family: s.family, samples: s.samples, lowData,
        reject: s.meanRejection * 100, bestPct: target == null ? null : target * 100, demand: s.demand, kgPerUnit: s.kgPerUnit,
        scrapKg, scrapOmr: scrapKg * econ.materialOmrPerKg, saving, kwhPerKgPlaceholder: s.kwhPerKgPlaceholder,
        bestRejectOwn: s.bestRejectOwn, shift1Reject: s.shift1Reject, shift2Reject: s.shift2Reject, monthly: s.monthly,
      };
    }).sort((x, y) => y.scrapKg - x.scrapKg);

    const totalKg = base.reduce((s, r) => s + r.scrapKg, 0) || 1;
    const rows = [];
    let cum = 0;
    for (const r of base) {
      cum += r.scrapKg;
      const material = r.scrapKg >= totalKg * 0.02;
      const focus = material && !r.lowData && r.saving > 0;
      rows.push({ ...r, material, focus, cumPct: (cum / totalKg) * 100 });
    }
    const wellMeasuredBase = base.filter((r) => !r.lowData);
    const wellMeasuredTotalKg = wellMeasuredBase.reduce((s, r) => s + r.scrapKg, 0) || 1;
    const wellMeasured = [];
    let wellMeasuredCum = 0;
    for (const r of wellMeasuredBase) {
      wellMeasuredCum += r.scrapKg;
      const row = rows.find((candidate) => candidate.id === r.id)!;
      wellMeasured.push({ ...row, cumPct: (wellMeasuredCum / wellMeasuredTotalKg) * 100 });
    }
    const totalOmr = rows.reduce((s, r) => s + r.scrapOmr, 0);
    const grossKgYr = rows.reduce((s, r) => s + r.demand * r.kgPerUnit, 0);
    const recoverable = rows.filter((r) => r.focus).reduce((s, r) => s + r.saving, 0);
    const lowDataRows = rows.filter((r) => r.lowData);

    // changeover purge — modeled from the REAL switch frequency on MC01 (count is
    // measured; only kg/changeover is the estimate). Decomposes the loss above; not additive.
    const chgPerYear = dataset === 'real' ? meta.changeoversPerYear : Math.round(products.length * 6);
    const changeoverKg = chgPerYear * scrapPerChg;
    const changeoverShare = totalKg > 0 ? changeoverKg / totalKg : 0;

    return {
      rows, wellMeasured, totalKg, totalOmr, recoverable, maxKg: wellMeasured[0]?.scrapKg || 1,
      totalProducts: rows.length,
      focusCount: rows.filter((r) => r.focus).length,
      grossKgYr,
      perHalfPp: 0.005 * grossKgYr * econ.materialOmrPerKg,
      per1pp: 0.01 * grossKgYr * econ.materialOmrPerKg,
      lowDataCount: lowDataRows.length,
      lowDataOmr: lowDataRows.reduce((s, r) => s + r.scrapOmr, 0),
      chgPerYear, changeoverKg, changeoverOmr: changeoverKg * econ.materialOmrPerKg, changeoverShare,
    };
  }, [products, econ, dataset, meta, scrapPerChg]);

  const top10 = a.wellMeasured.slice(0, 10);
  const top10Cum = top10.at(-1)?.cumPct ?? 0;
  const energyChartProducts = useMemo(
    () => selectChartProducts(a.rows, chartScope, q),
    [a.rows, chartScope, q],
  );
  const energyChartRows = useMemo(() => {
    const productSeries = energyChartProducts.map((product) => ({
      product,
      series: placeholderKwhKgSeries(product.kwhPerKgPlaceholder, energyGranularity, product.id),
    }));
    const pointCount = productSeries[0]?.series.length ?? 0;

    return Array.from({ length: pointCount }, (_, i) => {
      const row: Record<string, string | number> = { t: productSeries[0]?.series[i]?.t ?? '' };
      for (const { product, series } of productSeries) {
        row[product.id] = series[i]?.v ?? 0.05;
      }
      return row;
    });
  }, [energyChartProducts, energyGranularity]);
  const energySearch = q.trim().toLowerCase();
  const recs = a.rows.filter((r) => r.focus && r.saving > 0).sort((x, y) => y.saving - x.saving).slice(0, 5);
  const tableRows = (q.trim() ? a.rows : top10)
    .filter((r) => (famFilter === 'All' || r.family === famFilter) && (!confidentOnly || !r.lowData) && r.name.toLowerCase().includes(q.toLowerCase()));
  const drillRow = a.rows.find((r) => r.id === drill);
  const families = [...new Set(products.map((s) => s.family))];
  const latestStartupWeek = startupKpis.weekly.at(-1) ?? {
    week: '—',
    startups: startupKpis.summary.startups,
    coldStarts: startupKpis.summary.coldStarts,
    subEconomicRuns: startupKpis.summary.subEconomicRuns,
    subEconomicPct: startupKpis.summary.subEconomicPct,
    scrapPerStartupKg: startupKpis.summary.scrapPerStartupKg,
    totalScrapKg: startupKpis.summary.totalScrapKg,
  };
  const startupTrend = startupKpis.weekly.slice(-16);
  const startupTrendMax = Math.max(1, ...startupTrend.map((point) => point.startups));
  const startupKpiCards = [
    { label: 'startups', value: num(latestStartupWeek.startups), detail: latestStartupWeek.week },
    {
      label: 'cold-starts',
      value: num(latestStartupWeek.coldStarts),
      detail: `idle gap >= ${startupKpis.meta.coldStartGapDays} days`,
      title: `Measured idle-gap cold-starts from ERP run episodes; threshold is ${startupKpis.meta.coldStartGapDays} days.`,
    },
    { label: 'sub-economic runs', value: pct(latestStartupWeek.subEconomicPct), detail: `${num(latestStartupWeek.subEconomicRuns)} below ${num(startupKpis.meta.minEconomicRunKg)} kg` },
    { label: 'scrap per startup', value: `${num(latestStartupWeek.scrapPerStartupKg, 1)} kg`, detail: `${num(latestStartupWeek.totalScrapKg)} kg total` },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Scrap Focus <span className="align-middle text-xs font-medium text-slate-400">· Extrusion Line 1 (MC 01+03)</span></h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">How much you're losing to scrap, which products drive it, and what's worth fixing.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
          {([['real', `Real · ${scrapCatalog.products.length}`], ['demo', 'Illustrative · 12']] as const).map(([ds, label]) => (
            <button key={ds} type="button" onClick={() => { setDataset(ds); setFamFilter('All'); }} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${dataset === ds ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Provenance banner */}
      {dataset === 'real' ? (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-2.5 text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          Real Extrusion Line 1 (Machines 01 &amp; 03) records · {meta.periodStart} → {meta.periodEnd} ({meta.spanDays} days) · {meta.products} products · overall reject <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{meta.overallRejectPct}%</span>. Demand &amp; scrap annualised (×{(1 / meta.annualiseFactor).toFixed(2)} period → year). Reject &amp; weight measured; <span className="text-amber-600 dark:text-amber-400">{a.lowDataCount} products ({num(a.lowDataOmr)} OMR) have &lt;{MIN_SAMPLES} records</span> — excluded from ranking until more data is collected.
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          Illustrative catalogue — synthetic products, made-up demand &amp; reject rates. Use the <span className="font-semibold">Real</span> view for decisions.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
        <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/80 p-5 shadow-sm dark:border-emerald-500/25 dark:bg-emerald-500/10" aria-label="This week measured startup KPIs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">This week (measured)</h3>
                <span className="rounded-full border border-emerald-400/70 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200">MEASURED</span>
              </div>
              <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Startup KPIs from real ERP run episodes for {latestStartupWeek.week}.</p>
            </div>
            <div className="min-w-44">
              <p className="text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">weekly startup trend</p>
              <div className="mt-2 flex h-12 items-end gap-1" aria-label="Weekly startup trend">
                {startupTrend.map((point) => (
                  <div key={point.week} className="flex h-full flex-1 items-end" title={`${point.week}: ${num(point.startups)} startups`}>
                    <div className="w-full rounded-t-sm bg-emerald-500 dark:bg-emerald-300" style={{ height: `${Math.max(8, (point.startups / startupTrendMax) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {startupKpiCards.map((card) => (
              <div key={card.label} title={card.title} className="rounded-xl border border-emerald-200/80 bg-white/75 p-3 dark:border-emerald-400/15 dark:bg-slate-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">{card.label}</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
                <p className="mt-1 text-xs text-emerald-800/75 dark:text-emerald-200/75">{card.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-emerald-900/70 dark:text-emerald-200/75">
            Provenance: {startupKpis.meta.provenance} · window {startupKpis.meta.window[0]} → {startupKpis.meta.window[1]} · source {startupKpis.meta.source}.
          </p>
        </div>

        <div className="card-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">This period's 5 worst startup-only runs</h3>
            <span className="rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200">MEASURED</span>
          </div>
          <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
            {startupKpis.worstStartupRuns.map((run) => (
              <div key={`${run.startDate}-${run.product}`} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-slate-900 dark:text-white">{run.product}</p>
                  {run.coldStart && (
                    <span title={`Measured idle-gap cold-start: at least ${startupKpis.meta.coldStartGapDays} days since the prior run.`} className="shrink-0 rounded-full border border-sky-300/70 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200">cold-start</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {dateFmt(run.startDate)} · run <span className="font-mono text-slate-700 dark:text-slate-200">{num(run.runKg, 1)} kg</span> · scrap <span className="font-mono text-rose-600 dark:text-rose-300">{num(run.scrapKg, 1)} kg</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top bar — loss summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Scrap / year</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(a.totalKg)} kg</p><p className="text-xs text-slate-500 dark:text-slate-400">≈ {num(a.totalOmr)} OMR lost</p></div>
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-[11px] uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">Recoverable</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(a.recoverable)} OMR</p><p className="text-xs text-slate-500 dark:text-slate-400">if {a.focusCount} well-measured products reach their own best-demonstrated reject (their P25)</p></div>
        <div className="card-surface p-4"><p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Plant-wide lever</p><p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{num(a.perHalfPp)} OMR/yr</p><p className="text-xs text-slate-500 dark:text-slate-400">per 0.5 pp of line reject removed (1 pp ≈ {num(a.per1pp)}). Scrap is diffuse — the biggest win is lowering the whole line's reject, not chasing single products.</p></div>
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
                <Bar yAxisId="l" dataKey="scrapKg" radius={[2, 2, 0, 0]}>{top10.map((r, i) => (<Cell key={i} fill={r.lowData ? 'rgba(148,163,184,0.55)' : `rgba(244,63,94,${0.35 + 0.6 * (r.scrapKg / a.maxKg)})`} />))}</Bar>
                <Line yAxisId="r" type="monotone" dataKey="cumPct" stroke="#1A365D" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Top 10 of {a.wellMeasured.length} well-measured products = {top10Cum.toFixed(0)}% — scrap is diffuse.</p>
        </div>

        {/* Focus recommendations */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Focus here first — biggest recoverable savings</h3>
          {recs.map((r) => (
            <button key={r.id} type="button" onClick={() => setDrill(r.id)} className="card-surface w-full p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{r.name}</span>
                <span className="shrink-0 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">save {num(r.saving)} OMR</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {num(r.scrapOmr)} OMR scrap/yr ({((r.scrapKg / a.totalKg) * 100).toFixed(0)}% of scrap kg). reject {r.reject.toFixed(1)}% → your best {r.bestPct == null ? '—' : `${r.bestPct.toFixed(1)}%`} → save {num(r.saving)} OMR.
              </p>
            </button>
          ))}
          {recs.length === 0 && <div className="card-surface p-4 text-sm text-slate-500 dark:text-slate-400">No material, well-measured product is above its own best-demonstrated reject.</div>}
        </div>
      </div>

      <div className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Energy intensity over time — kWh/kg by product</h3>
            {meta.kwhPerKgProvenance === 'PLACEHOLDER' && (
              <p title={meta.kwhPerKgNote} className="mt-2 max-w-4xl rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                PLACEHOLDER — illustrative per-product energy intensity over time; no real per-product energy-over-time data exists yet (needs machine sub-metering).
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Showing top {CHART_TOP_N} by energy intensity — switch to All, or search a product to add it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10" aria-label="Energy intensity chart scope">
              {([
                ['top', `Top ${CHART_TOP_N}`],
                ['all', 'All'],
              ] as const).map(([scope, label]) => (
                <button key={scope} type="button" onClick={() => setChartScope(scope)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${chartScope === scope ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10" aria-label="Energy intensity granularity">
              {GRANULARITY_OPTIONS.map((granularity) => (
                <button key={granularity} type="button" onClick={() => setEnergyGranularity(granularity)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${energyGranularity === granularity ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                  {granularity}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={energyChartRows} margin={{ top: 8, right: 18, left: 0, bottom: 18 }}>
              <XAxis dataKey="t" tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
              <YAxis tick={{ fill: 'var(--muted-text)', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.5rem', maxHeight: 240, overflowY: 'auto' }} labelStyle={{ color: 'var(--muted-text)' }} formatter={(value: number, name: string) => [`${Number(value).toFixed(2)} kWh/kg`, name]} />
              {energyChartProducts.map((product) => {
                const isMatch = energySearch.length > 0 && product.name.toLowerCase().includes(energySearch);
                return (
                  <Line
                    key={product.id}
                    type="monotone"
                    dataKey={product.id}
                    name={product.name}
                    stroke={isMatch ? '#1A365D' : (FAMILY_STROKE[product.family] ?? FAMILY_STROKE.Other)}
                    strokeWidth={isMatch ? 2.25 : 1}
                    strokeOpacity={isMatch ? 1 : 0.25}
                    dot={false}
                    activeDot={isMatch ? { r: 3 } : false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Changeover scrap — modeled from real switch frequency */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Changeover scrap <span className="font-normal normal-case text-amber-600 dark:text-amber-400">· estimate</span></h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Of the {num(a.totalKg)} kg above, an estimated <span className="font-mono font-semibold text-slate-900 dark:text-white">{num(a.changeoverKg)} kg</span> (<span className="font-mono font-semibold">{(a.changeoverShare * 100).toFixed(1)}%</span> ≈ {num(a.changeoverOmr)} OMR) is changeover purge — {dataset === 'real' ? <>from a <span className="font-medium">measured</span> {num(a.chgPerYear)} product-switches/yr on the line (MC01+03) ({meta.changeoversObservedFamily} family, {meta.changeoversObservedDiameter} diameter over the period)</> : <>{num(a.chgPerYear)} modeled switches/yr</>}.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The switch count is real; only the kg-per-switch is assumed. Your records log <em>total</em> scrap and don't tag startup vs in-run, so this is a decomposition estimate — not extra scrap. It's the slice the <span className="font-medium">Order Planner</span>'s family-grouping directly removes. The rest is in-run reject, spread across many products — so scrap here is <span className="font-medium">diffuse and reject-driven, not changeover-driven</span>.
            </p>
          </div>
          <label className="block shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">kg / changeover</span>
            <input type="number" min={0} step={1} value={scrapPerChg} onChange={(e) => setScrapPerChg(Math.max(0, Number(e.target.value) || 0))} className="mt-1 block w-24 rounded-lg border border-amber-300/50 bg-white px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-accent focus:outline-none dark:border-amber-500/20 dark:bg-card-dark dark:text-white" />
          </label>
        </div>
      </div>

      {/* Investigator table */}
      <div className="card-surface overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 px-5 py-3 dark:border-white/10">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{q.trim() ? 'Search results' : 'Top 10 — investigate'}</h3>
            {meta.kwhPerKgProvenance === 'PLACEHOLDER' && (
              <p title={meta.kwhPerKgNote} className="mt-1 max-w-4xl rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                PLACEHOLDER — illustrative energy intensity (nameplate power ÷ real output), not measured. Real per-product kWh/kg needs machine sub-metering.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…" className="rounded-lg border border-slate-200/70 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-accent focus:outline-none dark:border-white/10 dark:bg-card-dark dark:text-slate-200" />
            <select value={famFilter} onChange={(e) => setFamFilter(e.target.value)} className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-card-dark dark:text-slate-200"><option>All</option>{families.map((f) => <option key={f}>{f}</option>)}</select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><input type="checkbox" checked={confidentOnly} onChange={(e) => setConfidentOnly(e.target.checked)} className="accent-accent" />well-measured only</label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Product</th><th className="px-4 py-2">Family</th><th className="px-4 py-2 text-right">Records</th><th className="px-4 py-2 text-right">Reject %</th><th className="px-4 py-2 text-right">Best %</th><th className="px-4 py-2 text-right">Demand/yr</th><th className="px-4 py-2 text-right">Scrap kg</th><th className="px-4 py-2 text-right">Scrap OMR</th><th className="px-4 py-2 text-right">Cum %</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {tableRows.map((r) => (
                <tr key={r.id} className={r.lowData ? 'opacity-60' : ''}>
                  <td className="px-4 py-1.5 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="px-4 py-1.5"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${FAMILY_BG[r.family] ?? 'bg-slate-400'}`} />{r.family}</span></td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.lowData ? <span className="text-amber-600 dark:text-amber-400" title="Too few records — reject rate is noisy">{r.samples} ⚠</span> : r.samples}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.reject.toFixed(1)}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.bestPct == null ? '—' : r.bestPct.toFixed(1)}</td>
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

      <p className="text-xs text-slate-400">Scrap = demand × kg/unit × each product's own measured reject rate (mass-basis). Recoverable compares material, well-measured products against their own best-demonstrated reject (P25). Plant = Extrusion Line 1 (Machines 01 &amp; 03). Changeover scrap is modeled from the real switch count; per-shift / per-batch / per-cause attribution unlocks once the MES is connected.</p>

      {/* Drill-down */}
      {drillRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDrill(null)} role="presentation">
          <div className="card-surface max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><h3 className="text-lg font-semibold text-slate-900 dark:text-white">{drillRow.name}</h3><button onClick={() => setDrill(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button></div>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <p>Family {drillRow.family} · demand <span className="font-mono">{num(drillRow.demand)}</span>/yr · <span className="font-mono">{drillRow.samples}</span> shift-records{drillRow.lowData && <span className="text-amber-600 dark:text-amber-400"> ⚠ noisy</span>}</p>
              <p>Reject <span className="font-mono">{drillRow.reject.toFixed(1)}%</span> → your best <span className="font-mono">{drillRow.bestPct == null ? '—' : `${drillRow.bestPct.toFixed(1)}%`}</span>. Annual scrap <span className="font-mono">{num(drillRow.scrapKg)} kg</span> ({((drillRow.scrapKg / a.totalKg) * 100).toFixed(1)}% of scrap kg) ≈ <span className="font-mono">{num(drillRow.scrapOmr)} OMR</span>.</p>
              <p>Saving to own best <span className="font-mono">{num(drillRow.saving)} OMR/yr</span>{!drillRow.focus && drillRow.saving > 0 ? ' (not counted in recoverable)' : ''}.</p>
              {drillRow.saving > 0 && drillRow.focus
                ? <p className="font-medium text-emerald-600 dark:text-emerald-400">Close the gap to its own best → save {num(drillRow.saving)} OMR/yr ({num(drillRow.saving / econ.materialOmrPerKg)} kg)</p>
                : drillRow.lowData
                  ? <p className="text-amber-600 dark:text-amber-400">Too few records to size a reliable saving — collect more runs before acting.</p>
                  : drillRow.saving > 0
                    ? <p className="text-slate-500">Above its own best, but below the 2% materiality threshold for recoverable sizing.</p>
                    : <p className="text-slate-500">Already at/below its own best, or no own-best target is available.</p>}
              <div className="mt-4 border-t border-slate-200/60 pt-3 dark:border-white/10">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Where the loss is</h4>
                {drillRow.lowData && <p className="mt-2 font-medium text-amber-600 dark:text-amber-400">Too few records to diagnose reliably</p>}
                <div className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Shift</p>
                  <p className="mt-1">Shift 1 <span className="font-mono">{pct(drillRow.shift1Reject)}</span> · Shift 2 <span className="font-mono">{pct(drillRow.shift2Reject)}</span></p>
                  {drillRow.shift1Reject != null && drillRow.shift2Reject != null && Math.abs(drillRow.shift1Reject - drillRow.shift2Reject) >= 0.005
                    ? (() => {
                      const worseShift = drillRow.shift2Reject! > drillRow.shift1Reject! ? 2 : 1;
                      const worse = Math.max(drillRow.shift1Reject!, drillRow.shift2Reject!);
                      const better = Math.min(drillRow.shift1Reject!, drillRow.shift2Reject!);
                      const ratio = better > 0 ? `${(worse / better).toFixed(1)}` : '∞';
                      return <p className="mt-1 font-medium text-rose-600 dark:text-rose-400">Shift {worseShift} runs {ratio}× worse ({worseShift === 2 ? `${pct(drillRow.shift2Reject)} vs ${pct(drillRow.shift1Reject)}` : `${pct(drillRow.shift1Reject)} vs ${pct(drillRow.shift2Reject)}`}) — investigate shift-{worseShift} practice.</p>;
                    })()
                    : <p className="mt-1 text-slate-500">No material shift difference.</p>}
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monthly trend</p>
                  {drillRow.monthly.length >= 2
                    ? (() => {
                      const best = drillRow.monthly.reduce((m, r) => (r.r < m.r ? r : m), drillRow.monthly[0]);
                      const worst = drillRow.monthly.reduce((m, r) => (r.r > m.r ? r : m), drillRow.monthly[0]);
                      const maxR = Math.max(1e-9, ...drillRow.monthly.map((r) => r.r));
                      return (
                        <>
                          <div className="mt-2 flex h-14 items-end gap-1" aria-label="Monthly reject sparkline">
                            {drillRow.monthly.map((point) => {
                              const hitOwnBest = drillRow.bestRejectOwn != null && point.r <= drillRow.bestRejectOwn + 0.0005;
                              return (
                                <div key={point.m} title={`${point.m}: ${pct(point.r)}${hitOwnBest ? ' · own best' : ''}`} className="flex h-full flex-1 items-end">
                                  <div className={`w-full rounded-t-sm ${hitOwnBest ? 'bg-emerald-500' : 'bg-accent'}`} style={{ height: `${Math.max(4, (point.r / maxR) * 100)}%` }} />
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2">Best month <span className="font-mono">{pct(best.r)}</span> · worst <span className="font-mono">{pct(worst.r)}</span> — you have already hit <span className="font-mono">{pct(best.r)}</span>, so the gap is consistency, not capability.</p>
                          {drillRow.bestRejectOwn != null && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Green marks months at or below own-best target ({pct(drillRow.bestRejectOwn)}).</p>}
                        </>
                      );
                    })()
                    : <p className="mt-1 text-slate-500">Not enough monthly data to show a trend.</p>}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cause attribution is limited to shift and month — the records hold no process settings (line speed, melt temp, vacuum, material lot). Log those per run to pinpoint the exact setting and quantify the fix.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ScrapAnalyzerPage;
