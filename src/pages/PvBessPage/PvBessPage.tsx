import { type FC, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart, Area, Bar, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ReferenceLine,
} from 'recharts';
import { pvBessData } from '@/data/pvBessData';
import { DataFreshness } from '@/shared/Provenance';
import ScenarioBanner from '@/shared/ScenarioBanner';
import Breadcrumb, { type Crumb } from '@/shared/Breadcrumb';
import type { DispatchHour, NasaCell } from '@/features/pv-bess/pvBess';

// ─────────────────────────────────────────────────────────────────────────────
// Solar + storage reference plant.
//
// Recorded public datasets run through the Enerlytics physics: a year of
// production, a day-ahead forecast, a battery dispatch (a stated scenario),
// fault detection on a labelled dataset, and battery ageing on lab cells.
// Copy is deliberately plain — the reader is a facility owner, not an engineer.
// Nothing here is a live feed; the freshness chip and the scenario banner say so.
// ─────────────────────────────────────────────────────────────────────────────

export type PvBessFocus = 'pv' | 'inverters' | 'bess' | null;

// Series colours — validated with the dataviz palette checker on both surfaces
// (light #4D8B12/#1D4ED8/#BE185D, dark #5FA51C/#3B6FE8/#D63A78). Amber is money only.
const C = {
  pv: 'var(--series-pv)',
  load: 'var(--series-load)',
  battery: 'var(--series-battery)',
  navy: 'var(--series-navy)',
};
const tooltipStyles = { background: 'var(--card-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.75rem', fontSize: 12 };
const tickStyle = { fill: 'var(--muted-text)', fontSize: 11 } as const;
const axisLine = { stroke: 'var(--grid-stroke)' };
const yAxis = (label: string, width = 52) => ({
  tick: tickStyle, tickLine: false, axisLine, width,
  label: { value: label, angle: -90, position: 'insideLeft' as const, fill: 'var(--muted-text)', fontSize: 11 },
});

const fmt = (v: number | null | undefined, d = 1, suffix = '') =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
const fmtInt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// ── Building blocks ──────────────────────────────────────────────────────────

const SectionTitle: FC<{ id: string; title: string; note?: string }> = ({ id, title, note }) => (
  <div id={id} className="scroll-mt-24">
    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
    {note && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{note}</p>}
  </div>
);

const Kpi: FC<{ label: string; value: string; sub?: string; money?: boolean }> = ({ label, value, sub, money }) => (
  <div className="card-surface p-5">
    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-2 text-3xl font-semibold tabular-nums ${money ? 'text-accent' : 'text-slate-900 dark:text-white'}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);

const Frame: FC<{ title: string; caption?: string; height?: string; children: React.ReactElement }> = ({ title, caption, height = 'h-64', children }) => (
  <div className="card-surface p-5">
    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
    {caption && <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{caption}</p>}
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </div>
);

const Th: FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td: FC<{ children: React.ReactNode; right?: boolean; strong?: boolean; nowrap?: boolean }> = ({ children, right, strong, nowrap }) => (
  <td className={`px-3 py-2 text-sm tabular-nums ${right ? 'text-right' : 'text-left'} ${nowrap ? 'whitespace-nowrap' : ''} ${strong ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{children}</td>
);

// ── The signature: one day of dispatch with the tariff painted behind it ─────

const BAND_LABEL: Record<string, string> = { off_peak: 'Off-peak', weekday_peak: 'Day peak', night_peak: 'Night peak' };

function bandSegments(hours: DispatchHour[]): { from: string; to: string; band: string }[] {
  const out: { from: string; to: string; band: string }[] = [];
  hours.forEach((h, i) => {
    const last = out[out.length - 1];
    if (last && last.band === h.band) last.to = h.hour;
    else out.push({ from: h.hour, to: hours[Math.min(i + 1, hours.length - 1)].hour, band: h.band });
  });
  for (let i = 0; i < out.length - 1; i += 1) out[i].to = out[i + 1].from;
  out[out.length - 1].to = hours[hours.length - 1].hour;
  return out;
}

const DispatchStrip: FC<{ hours: DispatchHour[] }> = ({ hours }) => {
  const rows = useMemo(() => hours.map((h) => ({
    ...h,
    batteryKw: Math.round((h.dischargeKw - h.chargeKw) * 10) / 10,
    bandLabel: BAND_LABEL[h.band] ?? h.band,
  })), [hours]);
  const segs = useMemo(() => bandSegments(hours), [hours]);
  const bandFill = (b: string) => (b === 'night_peak' ? 0.22 : b === 'weekday_peak' ? 0.12 : 0);

  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">One weekday, hour by hour</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">Shaded hours cost more. The battery charges when power is cheap and discharges when it is dear.</p>
      </div>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }} stackOffset="sign">
            <defs>
              <pattern id="pvbess-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-text)" strokeWidth="1" />
              </pattern>
            </defs>
            {segs.map((s) => (
              <ReferenceArea key={`${s.from}-${s.band}`} x1={s.from} x2={s.to} fill="#FAB005" fillOpacity={bandFill(s.band)} strokeOpacity={0} ifOverflow="extendDomain" />
            ))}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
            <XAxis dataKey="hour" tick={tickStyle} tickLine={false} axisLine={axisLine} interval={2} />
            <YAxis {...yAxis('kW')} />
            <Tooltip
              contentStyle={tooltipStyles}
              labelStyle={{ color: 'var(--muted-text)' }}
              formatter={(v: number, name: string) => [`${fmt(v, 0)} kW`, name]}
              labelFormatter={(l: string, p) => {
                const r = p?.[0]?.payload as (typeof rows)[number] | undefined;
                return r ? `${l} · ${r.bandLabel} · ${r.rateBz} Bz/kWh` : l;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
            <ReferenceLine y={0} stroke="var(--grid-stroke)" />
            <Area type="monotone" dataKey="gridImportKw" name="From the grid" stroke="var(--muted-text)" strokeWidth={1} fill="url(#pvbess-hatch)" fillOpacity={0.55} isAnimationActive={false} />
            <Bar dataKey="batteryKw" name="Battery (up = discharging, down = charging)" fill={C.battery} radius={[3, 3, 3, 3]} maxBarSize={18} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.hour} fill={C.battery} fillOpacity={r.batteryKw >= 0 ? 0.95 : 0.55} />)}
            </Bar>
            <Line type="monotone" dataKey="loadKw" name="Site load" stroke={C.load} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="pvKw" name="Solar" stroke={C.pv} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
            <XAxis dataKey="hour" tick={tickStyle} tickLine={false} axisLine={axisLine} interval={2} />
            <YAxis {...yAxis('Charge %')} domain={[0, 100]} ticks={[0, 50, 100]} />
            <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number) => [`${fmt(v, 0)} %`, 'Battery charge']} />
            <Line type="stepAfter" dataKey="socPct" name="Battery charge" stroke={C.battery} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

const PvBessPage: FC<{ crumbs: Crumb[]; focus: PvBessFocus; onBack: () => void; onOpenTwin?: () => void }> = ({ crumbs, focus, onOpenTwin }) => {
  const { meta, pv, pvFaults, inverterFleet, bess, dispatch } = pvBessData;
  const { annual, monthly, forecast, site } = pv;
  const { day, month, assumptions } = dispatch;

  useEffect(() => {
    if (!focus) return;
    const id = focus === 'bess' ? 'pvbess-battery' : focus === 'inverters' ? 'pvbess-faults' : 'pvbess-production';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);

  const availabilityPct = useMemo(() => monthly.reduce((s, m) => s + m.availabilityPct * m.intervals, 0) / monthly.reduce((s, m) => s + m.intervals, 0), [monthly]);

  const sohRows = useMemo(() => {
    const cells = Object.entries(bess.nasa.cells);
    const n = Math.max(...cells.map(([, c]) => c.cycles));
    return Array.from({ length: n }, (_, i) => {
      const row: Record<string, number | null> = { cycle: i + 1 };
      cells.forEach(([name, c]) => { row[name] = c.sohPct[i] ?? null; });
      return row;
    });
  }, [bess.nasa.cells]);
  // One navy ramp for the four cells, re-stepped per theme in index.css so a theme toggle repaints without a re-render.
  const ramp = ['var(--series-cell-1)', 'var(--series-cell-2)', 'var(--series-cell-3)', 'var(--series-cell-4)'];

  const calibrated = pvFaults.calibration?.status === 'fitted' ? pvFaults.calibration.classes : undefined;
  const faultRows = useMemo(() => pvFaults.classes.map((c) => ({ ...c, range: [c.p10, c.p90] as [number, number] })), [pvFaults.classes]);
  const peakShavedKw = day.peakImportWithoutKw - day.peakImportWithKw;
  const daysWithin10 = Math.round(forecast.skill.share_within_10pct * 100);
  const endSoh = (c: NasaCell) => c.sohPct[c.sohPct.length - 1];

  return (
    <section className="space-y-10">
      <Breadcrumb crumbs={crumbs} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Solar + storage</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Reference plant</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            {site.dcNameplateKw} kWp tracking array, {site.location}, {site.year}. Public data, not a customer site.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onOpenTwin && (
            <button type="button" onClick={onOpenTwin} className="rounded-full border border-slate-200/80 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:text-slate-200">
              Open the digital twin →
            </button>
          )}
          <DataFreshness meta={meta} />
        </div>
      </div>

      {/* ── Production ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle id="pvbess-production" title="Production" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Energy this year" value={`${fmtInt(annual.energyKwh)} kWh`} sub={`${fmtInt(annual.specificYieldKwhPerKwp)} kWh per kWp`} />
          <Kpi label="Performance ratio" value={fmt(annual.performanceRatio, 2)} sub="Output compared with the sunlight received" />
          <Kpi label="Availability" value={fmt(availabilityPct, 1, ' %')} sub="Time with a valid reading" />
          <Kpi label="Meter check" value={fmt(Math.abs(annual.meterAgreementPct), 2, ' %')} sub="Gap between summed power and the meter register" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Frame title="Monthly yield" caption="kWh per kWp installed">
            <BarChart data={monthly} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
              <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={axisLine} />
              <YAxis {...yAxis('kWh / kWp')} />
              <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }}
                formatter={(v: number, _n, p) => [`${fmt(v, 0)} kWh/kWp · ${fmtInt((p.payload as { energyKwh: number }).energyKwh)} kWh`, 'Yield']} />
              <Bar dataKey="specificYieldKwhPerKwp" name="Yield" fill={C.pv} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </Frame>
          <Frame title="Monthly performance ratio" caption="Lower in hot months: warm modules produce less">
            <LineChart data={monthly} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
              <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={axisLine} />
              <YAxis {...yAxis('PR')} domain={[0.5, 0.8]} tickFormatter={(v: number) => v.toFixed(2)} />
              <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number) => [fmt(v, 3), 'Performance ratio']} />
              <Line type="monotone" dataKey="performanceRatio" name="Performance ratio" stroke={C.navy} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C.navy }} isAnimationActive={false} />
            </LineChart>
          </Frame>
        </div>
      </div>

      {/* ── Forecast ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle id="pvbess-forecast" title="Day-ahead forecast" note="Tomorrow's solar energy from the site's sun geometry and recent output. No weather service yet." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Typical error" value={fmt(forecast.skill.median_ape_pct, 1, ' %')} sub={`Median over ${forecast.skill.days} days`} />
          <Kpi label="Days within 10 %" value={`${daysWithin10} %`} />
          <Kpi label="Clear-day error" value={fmt(forecast.clearDay.absPctError, 1, ' %')} sub={shortDate(forecast.clearDay.day)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {([['Clear day', forecast.clearDay], ['Cloudy day', forecast.cloudyDay]] as const).map(([title, fd]) => (
            <Frame key={fd.day} title={`${title} · ${shortDate(fd.day)}`} caption={`Forecast ${fmt(fd.forecastKwh, 0)} kWh · actual ${fmt(fd.actualKwh, 0)} kWh`}>
              <ComposedChart data={fd.hourly} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
                <XAxis dataKey="hour" tick={tickStyle} tickLine={false} axisLine={axisLine} interval={2} />
                <YAxis {...yAxis('kW')} />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} formatter={(v: number, name: string) => [`${fmt(v, 1)} kW`, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
                <Area type="monotone" dataKey="actualKw" name="Actual" stroke={C.pv} strokeWidth={2} fill={C.pv} fillOpacity={0.18} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecastKw" name="Forecast" stroke={C.navy} strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </Frame>
          ))}
        </div>
      </div>

      {/* ── Battery savings (scenario) ───────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle id="pvbess-dispatch" title="Battery savings" note="The battery is scheduled hour by hour to cut the bill under the Oman tariff, including the charge on peak demand." />
        <ScenarioBanner text={dispatch.scenarioNote} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi money label="Saved on this day" value={`${fmt(day.savingOmr, 2)} OMR`} sub={`${fmt(day.savingPct, 1)} % of the day's bill`} />
          <Kpi money label="Saved in 30 days" value={`${fmt(month.savingOmr, 0)} OMR`} sub={`About ${fmt(month.savingOmrPerDayMedian, 2)} OMR a day`} />
          <Kpi label="Peak demand cut" value={`${fmt(peakShavedKw, 0)} kW`} sub={`${fmt(day.peakImportWithoutKw, 0)} kW down to ${fmt(day.peakImportWithKw, 0)} kW`} />
          <Kpi label="Battery cycles" value={fmt(day.cyclesUsed, 2)} sub={`Full-cycle equivalents in the day · ${assumptions.batteryKwh} kWh, ${assumptions.batteryKw} kW`} />
        </div>
        <DispatchStrip hours={day.hourly} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Load: measured chiller plant, {shortDate(day.loadDate)}. Solar: measured array, {shortDate(day.pvDate)}, scaled to {assumptions.pvKwp} kWp. Tariff: {assumptions.tariff}.
        </p>
      </div>

      {/* ── Fault detection ──────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle id="pvbess-faults" title="Fault detection" note="Expected output from sunlight and module temperature, compared with what the strings delivered. Tested on a plant with known, labelled faults." />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Frame title="How far each fault sits from normal" caption="Shortfall against expected output, % of nameplate. Bars span the typical range." height="h-64">
              <BarChart data={faultRows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" horizontal={false} />
                <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={axisLine} domain={[-50, 10]} tickFormatter={(v: number) => `${v} %`} />
                <YAxis type="category" dataKey="label" tick={tickStyle} tickLine={false} axisLine={axisLine} width={90} />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }}
                  formatter={(_v, _n, p) => { const r = p.payload as (typeof faultRows)[number]; return [`typical ${fmt(r.medianResidualPctOfNameplate, 1)} % · range ${fmt(r.p10, 1)} to ${fmt(r.p90, 1)} %`, 'Shortfall']; }} />
                <ReferenceLine x={0} stroke="var(--muted-text)" />
                <Bar dataKey="range" name="Shortfall" fill={C.navy} radius={[4, 4, 4, 4]} maxBarSize={16} isAnimationActive={false} />
              </BarChart>
            </Frame>
          </div>
          <div className="card-surface overflow-x-auto p-5 lg:col-span-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Detection rate</h4>
            <p className="mb-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Share of minutes flagged. The Normal row is the false-alarm rate — the one an operator lives with.
            </p>
            {calibrated ? (
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Condition</Th>
                    <Th right>Minutes</Th>
                    <Th right>Off the shelf</Th>
                    <Th right>Tuned to the plant</Th>
                  </tr>
                </thead>
                <tbody>
                  {calibrated.map((c) => (
                    <tr key={c.label} className="border-t border-slate-200/60 dark:border-white/5">
                      <Td strong nowrap>{c.label}</Td>
                      <Td right>{fmtInt(c.minutes)}</Td>
                      <Td right>{fmt(c.againstDatasheetPct, 1, ' %')}</Td>
                      <Td right strong>{fmt(c.againstHealthyBaselinePct, 1, ' %')}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead><tr><Th>Condition</Th><Th right>Minutes</Th><Th right>Flagged</Th></tr></thead>
                <tbody>
                  {pvFaults.classes.map((c) => (
                    <tr key={c.label} className="border-t border-slate-200/60 dark:border-white/5">
                      <Td strong>{c.label}</Td>
                      <Td right>{fmtInt(c.minutes)}</Td>
                      <Td right>{fmt(c.flaggedMediumOrHighPct, 1, ' %')}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pvFaults.calibration?.note && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Tuning learns what this plant does when it is healthy, so its normal shortfall stops
                reading as a fault. Slow decline is tracked separately, as movement in that learned
                baseline.
              </p>
            )}
          </div>
        </div>
        <div className="card-surface overflow-x-auto p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Inverters</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Efficiency from DC in to AC out, one year, seven inverters</p>
          </div>
          <table className="mt-2 w-full">
            <thead><tr><Th>Inverter</Th><Th right>Typical efficiency</Th><Th right>Worst 10 %</Th><Th right>Readings</Th><Th right>Flags</Th></tr></thead>
            <tbody>
              {inverterFleet.inverters.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-200/60 dark:border-white/5">
                  <Td strong>{inv.id}</Td>
                  <Td right>{fmt(inv.efficiencyMedian * 100, 1, ' %')}</Td>
                  <Td right>{fmt(inv.efficiencyP10 * 100, 1, ' %')}</Td>
                  <Td right>{fmtInt(inv.rows)}</Td>
                  <Td right>{fmtInt(inv.mediumFlags)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Battery health ───────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionTitle id="pvbess-battery" title="Battery health" note="Capacity retention and round-trip efficiency, cycle by cycle, on lab cells run to end of life." />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Frame title="Capacity retention" caption="% of first-cycle capacity" height="h-72">
              <LineChart data={sohRows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" vertical={false} />
                <XAxis dataKey="cycle" tick={tickStyle} tickLine={false} axisLine={axisLine} type="number" domain={[1, 'dataMax']} label={{ value: 'Cycle', position: 'insideBottomRight', fill: 'var(--muted-text)', fontSize: 11, dy: 8 }} />
                <YAxis {...yAxis('%')} domain={[50, 100]} />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} labelFormatter={(l) => `Cycle ${l}`} formatter={(v: number, name: string) => [fmt(v, 1, ' %'), name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
                <ReferenceLine y={70} stroke="var(--muted-text)" strokeDasharray="4 4" label={{ value: 'End of life', fill: 'var(--muted-text)', fontSize: 11, position: 'insideBottomRight' }} />
                {Object.keys(bess.nasa.cells).map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} name={`Cell ${name}`} stroke={ramp[i % ramp.length]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </Frame>
          </div>
          <div className="card-surface overflow-x-auto p-5 lg:col-span-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Per cell</h4>
            <p className="mb-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">End of life is 70 % of first-cycle capacity.</p>
            <table className="w-full">
              <thead><tr><Th>Cell</Th><Th right>Cycles</Th><Th right>Capacity left</Th><Th right>Round trip</Th><Th right>End of life</Th></tr></thead>
              <tbody>
                {Object.entries(bess.nasa.cells).map(([name, c]) => (
                  <tr key={name} className="border-t border-slate-200/60 dark:border-white/5">
                    <Td strong>{name}</Td>
                    <Td right>{c.cycles}</Td>
                    <Td right>{fmt(endSoh(c), 1, ' %')}</Td>
                    <Td right>{fmt(c.rteMedian * 100, 1, ' %')}</Td>
                    <Td right>{c.eolCycle === null ? 'not reached' : `cycle ${c.eolCycle}`}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-surface overflow-x-auto p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Fast charging and ageing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Same cell type, different charging speeds</p>
          </div>
          <table className="mt-2 w-full">
            <thead><tr><Th>Cell</Th><Th>Charging policy</Th><Th right>Cycles</Th><Th right>Capacity lost</Th><Th right>Round trip</Th></tr></thead>
            <tbody>
              {Object.entries(bess.severson.cells).map(([name, c]) => (
                <tr key={name} className="border-t border-slate-200/60 dark:border-white/5">
                  <Td strong>{name.replace('/', ' · ')}</Td>
                  <Td>{c.policy}</Td>
                  <Td right>{c.cycles}</Td>
                  <Td right>{fmt(c.fade_pct, 1, ' %')}</Td>
                  <Td right>{fmt(c.rte_median * 100, 1, ' %')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Data sources (quiet footer) ──────────────────────────── */}
      <div className="border-t border-slate-200/70 pt-4 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
        <p className="font-medium uppercase tracking-[0.2em]">Data sources</p>
        <p className="mt-2 max-w-4xl leading-relaxed">
          {site.name}. {pvFaults.source}. {inverterFleet.source}. {bess.nasa.source}. {bess.severson.source}. Performance ratio and yields per IEC 61724-1; round-trip efficiency per IEC 62933-2-1; tariff bands per APSR CRT 2025.
        </p>
      </div>
    </section>
  );
};

export default PvBessPage;
