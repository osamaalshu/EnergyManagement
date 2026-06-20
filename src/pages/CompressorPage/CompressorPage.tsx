import { type FC, useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { compressorData } from '@/data/compressorData';
import { DataFreshness } from '@/shared/Provenance';
import CompressorSchematic, { type CmpStage } from '@/features/compressor-pilot/CompressorSchematic';
import Breadcrumb, { type Crumb } from '@/shared/Breadcrumb';
import type { CompressorFinding } from '@/features/compressor-pilot/compressor';

const tooltipStyles = { background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.75rem' };
const tickStyle = { fill: 'var(--muted-text)', fontSize: 11 } as const;

const fmt = (v: number | null | undefined, d = 2, s = '') =>
  v === null || v === undefined ? '—' : `${v.toFixed(d)}${s}`;

const sevClasses = (s: string): string =>
  s === 'HIGH' ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
  : s === 'MEDIUM' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  : 'bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400';

const KpiCard: FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
  <div className="card-surface p-5">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-2 text-3xl font-semibold ${accent ?? 'text-slate-900 dark:text-white'}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);

const ChartCard: FC<{ title: string; children: React.ReactElement }> = ({ title, children }) => (
  <div className="card-surface p-5">
    <h4 className="mb-3 text-center text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </div>
);

// Single-signal trend used by the stage-detail drill-down (click a node on the schematic).
const SignalChart: FC<{ data: unknown[]; title: string; dataKey: string; name: string; color: string; yLabel: string }> = ({ data, title, dataKey, name, color, yLabel }) => (
  <ChartCard title={title}>
    <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
      <XAxis {...axisX} />
      <YAxis {...axisY(yLabel)} domain={['auto', 'auto']} />
      <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
      <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={false} connectNulls />
    </LineChart>
  </ChartCard>
);

const STAGE_META: Record<CmpStage, { title: string; sub: string }> = {
  suction: { title: 'Suction / scrubber', sub: 'Inlet gas conditions before compression — pressure & temperature.' },
  compressor: { title: 'Compressor', sub: 'Work done on the gas — efficiency, power vs the ratio baseline, and specific power.' },
  discharge: { title: 'Discharge / aftercooler', sub: 'Outlet conditions after compression — pressure & temperature.' },
};

const axisX = { dataKey: 'label', tick: tickStyle, tickLine: false, axisLine: { stroke: 'var(--grid-stroke)' }, interval: 1, angle: -45, textAnchor: 'end' as const, height: 50 };
const axisY = (label: string) => ({ tick: tickStyle, tickLine: false, axisLine: { stroke: 'var(--grid-stroke)' }, width: 56, label: { value: label, angle: -90, position: 'insideLeft' as const, fill: 'var(--muted-text)', fontSize: 11 } });

const CompressorPage: FC<{ crumbs: Crumb[]; onBack: () => void }> = ({ crumbs, onBack }) => {
  const { meta, kpis, series, findings, reinforcing, counts, totalOmrImpactPerWindow } = compressorData;
  const dropPct = kpis.etaPoly !== null && kpis.designPolyEff ? ((kpis.designPolyEff - kpis.etaPoly) / kpis.designPolyEff) * 100 : null;
  const alertEff = kpis.designPolyEff ? kpis.designPolyEff * 0.9 : null;

  // Simulated live tile — cycles the daily series (honest: demo, not a real feed)
  const [i, setI] = useState(0);
  useEffect(() => {
    if (series.length === 0) return;
    const t = setInterval(() => setI((p) => (p + 1) % series.length), 1600);
    return () => clearInterval(t);
  }, [series.length]);
  const live = series[i] ?? null;

  // Clicking a node on the schematic drills into that stage's parameters.
  const [stage, setStage] = useState<CmpStage>('compressor');

  return (
    <section className="space-y-8">
      <Breadcrumb crumbs={crumbs} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button onClick={onBack} aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Compressor {meta.compressorTag}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{meta.site} · {meta.facility}</p>
          </div>
        </div>
        <DataFreshness meta={meta} />
      </div>

      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-semibold">Pilot preview · synthetic data.</span> {meta.note}
      </div>

      {/* Live monitor (simulated) */}
      {live && (
        <div className="card-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Live monitor</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> Simulated stream · demo
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Power (now)" value={fmt(live.actualKw, 0, ' kW')} sub={`expected ${fmt(live.expectedKw, 0)} kW`} />
            <KpiCard label="Polytropic η" value={fmt(live.etaPoly, 3)}
              accent={live.etaPoly !== null && alertEff !== null && live.etaPoly < alertEff ? 'text-red-400' : 'text-emerald-400'} />
            <KpiCard label="Compression ratio" value={fmt(live.compressionRatio, 2)} />
            <KpiCard label="Reading" value={live.label} sub="cycling 16-day window" />
          </div>
          <div className="mt-5 border-t border-slate-200/60 pt-4 dark:border-white/10">
            <CompressorSchematic point={live} designPolyEff={kpis.designPolyEff} selected={stage} onSelect={setStage} />
          </div>
        </div>
      )}

      {/* KPI cards (window averages) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Polytropic η" value={fmt(kpis.etaPoly, 3)}
          sub={dropPct !== null ? `${dropPct >= 0 ? '−' : '+'}${Math.abs(dropPct).toFixed(1)}% vs design ${fmt(kpis.designPolyEff, 2)}` : undefined}
          accent={dropPct !== null && dropPct > 7 ? 'text-red-400' : undefined} />
        <KpiCard label="Isentropic η" value={fmt(kpis.etaIsen, 3)} sub="wire-to-gas" />
        <KpiCard label="Specific power" value={fmt(kpis.specificPowerKwPerNm3hr, 4)} sub="kW per Nm³/hr" />
        <KpiCard label="Compression ratio" value={fmt(kpis.compressionRatio, 2)} sub="discharge / suction" />
        <KpiCard label="Rated power" value={fmt(kpis.ratedKw, 0, ' kW')} sub="nameplate" />
      </div>

      {/* Stage detail — driven by the schematic node you click */}
      <div className="card-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{STAGE_META[stage].title} <span className="text-sm font-normal text-slate-400">— parameters</span></h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{STAGE_META[stage].sub}</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200/70 p-0.5 dark:border-white/10">
            {(['suction', 'compressor', 'discharge'] as CmpStage[]).map((s) => (
              <button key={s} type="button" onClick={() => setStage(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${stage === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {stage === 'suction' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <SignalChart data={series} title="Suction pressure" dataKey="suctionP" name="Suction P" color="#1A365D" yLabel="bar a" />
            <SignalChart data={series} title="Suction temperature" dataKey="suctionT" name="Suction T" color="#0EA5E9" yLabel="°C" />
          </div>
        )}

        {stage === 'discharge' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <SignalChart data={series} title="Discharge pressure" dataKey="dischargeP" name="Discharge P" color="#1A365D" yLabel="bar a" />
            <SignalChart data={series} title="Discharge temperature" dataKey="dischargeT" name="Discharge T" color="#F97316" yLabel="°C" />
          </div>
        )}

        {stage === 'compressor' && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Polytropic efficiency over time">
                <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis {...axisX} />
                  <YAxis {...axisY('η_poly')} domain={[0.6, 0.85]} />
                  <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                  {kpis.designPolyEff && <ReferenceLine y={kpis.designPolyEff} stroke="#82C91E" strokeDasharray="6 4" label={{ value: `design ${kpis.designPolyEff}`, position: 'right', fill: '#82C91E', fontSize: 10 }} />}
                  {alertEff && <ReferenceLine y={alertEff} stroke="#f87171" strokeDasharray="6 4" label={{ value: `alert ${alertEff.toFixed(2)}`, position: 'right', fill: '#f87171', fontSize: 10 }} />}
                  <Line type="monotone" dataKey="etaPoly" name="η_poly" stroke="#1A365D" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ChartCard>

              <ChartCard title="Power — actual vs expected (ratio baseline)">
                <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                  <XAxis {...axisX} />
                  <YAxis {...axisY('kW')} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                  <Legend wrapperStyle={{ color: 'var(--muted-text)', fontSize: 10, paddingTop: 8 }} iconSize={10} />
                  <Line type="monotone" dataKey="expectedKw" name="Expected" stroke="#82C91E" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
                  <Line type="monotone" dataKey="actualKw" name="Actual" stroke="#1A365D" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ChartCard>
            </div>
            <div className="mt-6">
              <SignalChart data={series} title="Specific power over time (kW per Nm³/hr)" dataKey="specificPower" name="Specific power" color="#FAB005" yLabel="kW/Nm³·hr" />
            </div>
          </>
        )}
      </div>

      {/* Findings */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Diagnostic findings (R-CS)</h3>
        <p className="text-xs text-slate-400">Priced at a placeholder Al-Hilal APSR tariff (OQ-GN class TBD). Window total: {totalOmrImpactPerWindow.toFixed(0)} OMR.</p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:bg-white/5">
              <tr><th className="px-4 py-2">Rule</th><th className="px-4 py-2">Severity</th><th className="px-4 py-2 text-right">Triggered</th><th className="px-4 py-2 text-right">OMR</th><th className="px-4 py-2">Detail</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {findings.map((f: CompressorFinding) => (
                <tr key={f.ruleId} className="text-slate-700 dark:text-slate-300">
                  <td className="px-4 py-2.5"><div className="font-medium text-slate-900 dark:text-white">{f.ruleId}</div><div className="text-xs text-slate-400">{f.label}</div></td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevClasses(f.severity)}`}>{f.severity}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.triggeredHours}/{f.evaluatedHours} h</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.omrImpact.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reinforcing */}
      {reinforcing && (
        <div className="card-surface p-5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Model validation (reinforcing loop)</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Each kW prediction is reconciled against the observed reading — <span className="font-medium text-slate-700 dark:text-slate-200">measured, not asserted.</span></p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Forecast error (MAPE)" value={fmt(reinforcing.mape, 1, '%')} sub="out-of-sample" />
            <KpiCard label="Reconciled" value={`${reinforcing.nReconciled}/${reinforcing.nRecorded}`} sub="predictions" />
            <KpiCard label="Coverage" value={fmt(reinforcing.coveragePct, 0, '%')} />
            <KpiCard label="Model" value={reinforcing.modelVersion} sub={reinforcing.contextKey} />
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Diagnostic readings: {counts.diagnosticReadings} · impossible (flagged, not dropped): {counts.badReadings} · blocked at gate: {counts.blockedClaims} · paths: {Object.entries(counts.pathUsed).map(([k, v]) => `${k}=${v}`).join(', ')}
      </p>
    </section>
  );
};

export default CompressorPage;
