import { type FC, type ReactNode, useMemo, useState } from 'react';
import { tariffHourlyData } from '@/data/mockPortfolioData';
import ExportExcelButton from '@/shared/ExportExcelButton';

/**
 * Daily consumption heatmap for the Tariff Structure page (sits under Monthly
 * Peak Power Demand).
 *
 * Landscape orientation — reads like a timeline, fills the card width:
 *   • X-axis (top):  day of month 1–31 (labelled "Days")
 *   • Y-axis (left): months Jan–Dec
 *   • Colour:        vivid sequential ramp green → light green → yellow →
 *                    orange → red, encoding the day's total kWh consumption.
 *   • Side panel:    peak/lowest day, annual daily average, days above average,
 *                    and a monthly-average sparkline — fills the right gutter.
 *   • Tooltip:       weekday, kWh, and variance vs that month's average.
 *   • Year buttons:  one per year present in the data.
 *
 * Invalid calendar dates (e.g. Feb 30) are blank; valid days with no reading get
 * a faint neutral fill.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Vivid sequential ramp: green → light green → yellow → orange → red.
const STOPS = [
  [22, 163, 74], //  green       #16a34a
  [132, 204, 22], // light green #84cc16
  [250, 204, 21], // yellow      #facc15
  [249, 115, 22], // orange      #f97316
  [220, 38, 38], //  red         #dc2626
];
const mix = (a: number[], b: number[], t: number) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const rgb = (a: number[]) => `rgb(${a[0]} ${a[1]} ${a[2]})`;
const ramp = (t: number) => {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  return mix(STOPS[i], STOPS[i + 1], x - i);
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtKwh = (v: number) => Math.round(v).toLocaleString(undefined);
const fmtSigned = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`;

type Cell = { valid: boolean; kwh: number | null };
type DayRef = { month: number; day: number; kwh: number };

const ConsumptionHeatmap: FC = () => {
  const { dayKwh, years, defaultYear } = useMemo(() => {
    const map = new Map<string, number>();
    const yearDays = new Map<string, number>();
    for (const d of tariffHourlyData ?? []) {
      const key = d.timestamp.substring(0, 10);
      if (!map.has(key)) yearDays.set(key.substring(0, 4), (yearDays.get(key.substring(0, 4)) ?? 0) + 1);
      map.set(key, (map.get(key) ?? 0) + d.kwh);
    }
    const yrs = Array.from(new Set([...map.keys()].map((k) => k.substring(0, 4)))).sort();
    // Default to the latest reasonably complete year, not a partial one.
    const fullYears = yrs.filter((y) => (yearDays.get(y) ?? 0) >= 300);
    const def = (fullYears.length ? fullYears[fullYears.length - 1] : yrs[yrs.length - 1]) ?? '';
    return { dayKwh: map, years: yrs, defaultYear: def };
  }, []);

  const [year, setYear] = useState<string>(defaultYear);

  // rows = months (0–11), cols = days (1–31)
  const { rows, min, max, monthAvg, monthMax, yearTotal, dailyAvg, daysWithData, daysAboveAvg, peak, low } = useMemo(() => {
    const grid: Cell[][] = [];
    const all: number[] = [];
    const mAvg: number[] = Array(12).fill(0);
    const mCount: number[] = Array(12).fill(0);
    let total = 0;
    let peakDay: DayRef | null = null;
    let lowDay: DayRef | null = null;
    for (let m = 1; m <= 12; m++) {
      const row: Cell[] = [];
      const dim = new Date(Number(year), m, 0).getDate();
      for (let day = 1; day <= 31; day++) {
        const valid = day <= dim;
        const v = valid ? dayKwh.get(`${year}-${pad(m)}-${pad(day)}`) : undefined;
        row.push({ valid, kwh: v ?? null });
        if (v !== undefined) {
          all.push(v);
          total += v;
          mAvg[m - 1] += v;
          mCount[m - 1] += 1;
          if (!peakDay || v > peakDay.kwh) peakDay = { month: m - 1, day, kwh: v };
          if (!lowDay || v < lowDay.kwh) lowDay = { month: m - 1, day, kwh: v };
        }
      }
      grid.push(row);
    }
    all.sort((a, b) => a - b);
    const avg = all.length ? total / all.length : 0;
    const mAvgArr = mAvg.map((s, i) => (mCount[i] ? s / mCount[i] : 0));
    return {
      rows: grid,
      min: all.length ? all[0] : 0,
      max: all.length ? all[all.length - 1] : 1,
      monthAvg: mAvgArr,
      monthMax: Math.max(1, ...mAvgArr),
      yearTotal: total,
      dailyAvg: avg,
      daysWithData: all.length,
      daysAboveAvg: all.filter((v) => v > avg).length,
      peak: peakDay,
      low: lowDay,
    };
  }, [dayKwh, year]);

  const [hover, setHover] = useState<{ day: number; month: number; kwh: number } | null>(null);

  const norm = (v: number) => (max > min ? (v - min) / (max - min) : 0.5);
  const colorFor = (v: number) => rgb(ramp(norm(v)));
  const legendGradient = `linear-gradient(to right, ${STOPS.map(rgb).join(', ')})`;

  const variance = (kwh: number, month: number) => {
    const avg = monthAvg[month];
    return avg ? ((kwh - avg) / avg) * 100 : 0;
  };
  const weekdayOf = (month: number, day: number) => WEEKDAYS[new Date(Number(year), month, day).getDay()];

  const exportRows = useMemo(
    () =>
      rows.flatMap((row, mi) =>
        row.flatMap((c, di) => (c.kwh !== null ? [{ date: `${year}-${pad(mi + 1)}-${pad(di + 1)}`, kwh: Math.round(c.kwh) }] : [])),
      ),
    [rows, year],
  );

  return (
    <div className="group card-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Daily Consumption Heatmap — {year}</h3>
          {/* Summary / hover readout — operational context, not just a colour */}
          <p className="mt-1 h-5 text-xs text-slate-500 dark:text-slate-400">
            {hover ? (
              <span className="text-slate-700 dark:text-slate-200">
                <span className="tabular-nums">{weekdayOf(hover.month, hover.day)}, {MONTHS[hover.month]} {hover.day}</span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span className="font-semibold tabular-nums text-amber-500">{fmtKwh(hover.kwh)} kWh</span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span className="tabular-nums">{fmtSigned(variance(hover.kwh, hover.month))} vs {MONTHS[hover.month]} avg</span>
              </span>
            ) : daysWithData > 0 ? (
              <>
                Year total <span className="font-semibold tabular-nums text-amber-500">{fmtKwh(yearTotal)} kWh</span>
                <span className="ml-1.5 text-slate-400">· hover any day for detail</span>
              </>
            ) : (
              'Each square is one day, coloured by its total kWh.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportExcelButton data={exportRows as unknown as Record<string, unknown>[]} fileName={`DailyConsumption_${year}`} />
          <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="Heatmap year">
            {years.map((yr) => (
              <button
                key={yr}
                type="button"
                role="radio"
                aria-checked={year === yr}
                onClick={() => setYear(yr)}
                className={`px-3 py-1.5 text-xs font-medium tabular-nums transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  year === yr
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {daysWithData === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No consumption data for {year}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Heatmap + legend */}
          <div className="min-w-0 flex-1">
            <div className="overflow-x-auto">
              <div className="grid w-[91%] min-w-[600px] items-center" style={{ gridTemplateColumns: '2.25rem repeat(31, minmax(0, 1fr))', gap: 3 }}>
                {/* X-axis caption */}
                <span />
                <span className="pb-0.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400" style={{ gridColumn: '2 / -1' }}>
                  Days
                </span>
                {/* X-axis: every day 1–31 */}
                <span />
                {Array.from({ length: 31 }, (_, i) => (
                  <span key={i} className="pb-1 text-center text-[0.55rem] tabular-nums text-slate-400">
                    {i + 1}
                  </span>
                ))}

                {/* One row per month */}
                {rows.map((row, mi) => (
                  <GridRow key={mi}>
                    <span className="pr-2 text-right text-[0.65rem] font-medium text-slate-500 dark:text-slate-400">{MONTHS[mi]}</span>
                    {row.map((c, di) => {
                      if (!c.valid) return <span key={di} className="aspect-square" />;
                      const hasData = c.kwh !== null;
                      const isHover = hover?.day === di + 1 && hover?.month === mi;
                      const kwh = c.kwh as number;
                      return (
                        <span
                          key={di}
                          onMouseEnter={() => hasData && setHover({ day: di + 1, month: mi, kwh })}
                          onMouseLeave={() => setHover(null)}
                          title={
                            hasData
                              ? `${weekdayOf(mi, di + 1)}, ${MONTHS[mi]} ${di + 1}, ${year}\n${fmtKwh(kwh)} kWh · ${fmtSigned(variance(kwh, mi))} vs ${MONTHS[mi]} avg`
                              : undefined
                          }
                          className={`aspect-square rounded-[3px] transition ${
                            hasData ? 'cursor-pointer hover:ring-2 hover:ring-slate-900 dark:hover:ring-white' : ''
                          } ${isHover ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`}
                          style={{
                            background: hasData ? colorFor(kwh) : 'var(--grid-stroke)',
                            opacity: hasData ? 1 : 0.3,
                          }}
                        />
                      );
                    })}
                  </GridRow>
                ))}
              </div>
            </div>

            {/* Legend — explicit about what colour means */}
            <div className="mt-5 pl-9">
              <p className="mb-1.5 text-[0.7rem] font-medium text-slate-600 dark:text-slate-300">Daily consumption — lower to higher (kWh)</p>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-[0.65rem] text-slate-400">{fmtKwh(min)}</span>
                <div className="h-2.5 w-52 rounded-full" style={{ background: legendGradient }} aria-hidden />
                <span className="tabular-nums text-[0.65rem] text-slate-400">{fmtKwh(max)}</span>
              </div>
            </div>
          </div>

          {/* Right stats panel — fills the gutter with high-value context */}
          <aside className="grid w-full shrink-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:w-[14.6rem] lg:flex-col lg:pt-7">
            {peak && <StatCard label="Peak day" sub={`${MONTHS[peak.month]} ${peak.day}, ${year}`} value={peak.kwh} tone="high" />}
            {low && <StatCard label="Lowest day" sub={`${MONTHS[low.month]} ${low.day}, ${year}`} value={low.kwh} tone="low" />}
            <StatCard label="Average / day" value={dailyAvg} />
            <StatCard label="Days above average" value={daysAboveAvg} unit={`of ${daysWithData}`} plain />

            {/* Monthly-average sparkline */}
            <div className="col-span-2 rounded-xl border border-slate-200/70 px-3.5 py-3 dark:border-white/10 sm:col-span-4 lg:col-span-1">
              <p className="mb-2 text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Monthly average</p>
              <div className="flex h-12 items-end gap-[3px]">
                {monthAvg.map((a, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-[2px]"
                    title={`${MONTHS[i]} · ${fmtKwh(a)} kWh/day avg`}
                    style={{ height: `${Math.max(6, (a / monthMax) * 100)}%`, background: colorFor(a) }}
                  />
                ))}
              </div>
              <div className="mt-1 flex gap-[3px]">
                {MONTHS.map((m, i) => (
                  <span key={i} className="flex-1 text-center text-[0.5rem] text-slate-400">{m.charAt(0)}</span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const StatCard: FC<{ label: string; value: number; sub?: string; unit?: string; tone?: 'high' | 'low' | 'default'; plain?: boolean }> = ({
  label,
  value,
  sub,
  unit = 'kWh',
  tone = 'default',
  plain,
}) => {
  const color = tone === 'high' ? 'text-orange-500' : tone === 'low' ? 'text-emerald-500' : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-xl border border-slate-200/70 px-3.5 py-2.5 dark:border-white/10">
      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>
        {plain ? value.toLocaleString(undefined) : fmtKwh(value)}
        <span className="ml-1 text-[0.65rem] font-normal text-slate-500">{unit}</span>
      </p>
      {sub && <p className="text-[0.62rem] tabular-nums text-slate-400">{sub}</p>}
    </div>
  );
};

/** Lets each month emit its label + 31 cells as direct CSS-grid children. */
const GridRow: FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;

export default ConsumptionHeatmap;
