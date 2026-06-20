import { type FC, useState, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  portfolioWarnings,
  portfolioNotifications,
  todaysConsumption,
  hourlyProductionConsumption,
  tariffHourlyData,
  getChillerTimeSeries,
  datasetMeta,
} from '@/data/mockPortfolioData';
import { DataFreshness, TariffBasis } from '@/shared/Provenance';
import { tariffBasis } from '@/data/enrichedPortfolioData';
import { effectiveRateOmrPerKwh, calculateMonthlyDetailedBills } from '@/features/tariff-engine/tariffEngine';
import ExportExcelButton from '@/shared/ExportExcelButton';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const severityColor: Record<string, string> = {
  critical: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-accent',
};

const severityBg: Record<string, string> = {
  critical: 'bg-red-400/15',
  warning: 'bg-amber-400/15',
  info: 'bg-accent/15',
};

// Last 24 hours straight from the metered hourly series: kWh and OMR are
// derived from the SAME timestamped rows (no index-based join between two
// different series, which could silently misalign). Computed once at module
// scope since the underlying data is static.
const last24 = (() => {
  const rows = (tariffHourlyData ?? []).slice(-24);
  if (rows.length > 0) {
    return rows.map((r) => ({
      hour: r.timestamp.substring(11, 16),
      kwh: Math.round(r.kwh * 100) / 100,
      omr: Math.round(r.kwh * effectiveRateOmrPerKwh(r.timestamp, '11kV') * 100) / 100,
    }));
  }
  // Fallback when no tariff data: show consumption only
  return hourlyProductionConsumption.slice(-24).map((h) => ({ hour: h.hour, kwh: h.consumption, omr: 0 }));
})();

interface DashboardPageProps {
  onNavigateToPortfolio: () => void;
  onNavigateToBuilding: (buildingId: string) => void;
  onNavigateToEquipment: (buildingId: string, equipmentId: string) => void;
  onNavigateToTariff: () => void;
}

const DashboardPage: FC<DashboardPageProps> = ({
  onNavigateToPortfolio,
  onNavigateToBuilding,
  onNavigateToEquipment,
  onNavigateToTariff,
}) => {
  // Local read state for notifications (survives within session)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const n of portfolioNotifications) { if (n.read) initial.add(n.id); }
    return initial;
  });

  const isRead = (id: string) => readIds.has(id);
  const unreadCount = portfolioNotifications.filter((n) => !isRead(n.id)).length;

  // Real warnings = severity !== 'info'
  const realWarnings = portfolioWarnings.filter((w) => w.severity !== 'info');
  const warningCount = realWarnings.length;
  const hasWarnings = warningCount > 0;

  const hasChartData = last24.length > 0 && last24.some((d) => d.kwh > 0 || d.omr > 0);

  // Overview cards: actual last 24h from data

  // Cooling output = sum of chiller 1 + 2 + 3 cooling tons (last 24h)
  const last24CoolingTons = useMemo(() => {
    let total = 0;
    for (let ch = 1; ch <= 3; ch++) {
      const series = getChillerTimeSeries(ch, 'hourly');
      const last24 = series.powerCoolingSeries.slice(-24);
      total += last24.reduce((s, d) => s + d.coolingTons, 0);
    }
    return Math.round(total * 100) / 100;
  }, []);

  // Energy consumption = sum of metered kWh from tariff data (last 24h)
  const last24ConsumptionKwh = useMemo(() => {
    if (!tariffHourlyData || tariffHourlyData.length === 0) {
      return hourlyProductionConsumption.slice(-24).reduce((s, d) => s + d.consumption, 0);
    }
    return Math.round(tariffHourlyData.slice(-24).reduce((s, d) => s + d.kwh, 0) * 100) / 100;
  }, []);

  const last24ConsumptionOmr = useMemo(() => {
    if (!tariffHourlyData || tariffHourlyData.length === 0) return todaysConsumption.omr;
    const rows = tariffHourlyData.slice(-24);
    let omr = 0;
    for (const r of rows) {
      omr += r.kwh * effectiveRateOmrPerKwh(r.timestamp, '11kV');
    }
    return Math.round(omr * 10) / 10;
  }, []);

  // Full-bill-aware daily cost: energy charges + the day's amortized share of
  // capacity + supply charges, plus VAT — derived from the latest month's CRT bill.
  const last24FullBillOmr = useMemo(() => {
    if (!tariffHourlyData || tariffHourlyData.length === 0) return null;
    const lastTs = tariffHourlyData[tariffHourlyData.length - 1].timestamp;
    const monthRows = tariffHourlyData.filter((d) => d.timestamp.startsWith(lastTs.substring(0, 7)));
    const bills = calculateMonthlyDetailedBills(monthRows, { voltageLevel: '11kV' });
    if (bills.length === 0) return null;
    const bill = bills[0];
    const daysInMonth = new Set(monthRows.map((d) => d.timestamp.substring(0, 10))).size || 1;
    const energyOmr = typeof last24ConsumptionOmr === 'number' ? last24ConsumptionOmr : 0;
    const subtotal = energyOmr + (bill.capacityOmr + bill.supplyOmr) / daysInMonth;
    return Math.round(subtotal * 1.05 * 10) / 10; // + 5% VAT
  }, [last24ConsumptionOmr]);

  // Scroll-to refs
  const warningsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const scrollToWarnings = () => {
    warningsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollToNotifications = () => {
    notificationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleWarningClick = (warning: typeof portfolioWarnings[0]) => {
    if (warning.buildingId && warning.equipmentId) {
      onNavigateToEquipment(warning.buildingId, warning.equipmentId);
    } else if (warning.buildingId) {
      onNavigateToBuilding(warning.buildingId);
    } else {
      onNavigateToPortfolio();
    }
  };

  const handleNotificationClick = (notification: typeof portfolioNotifications[0]) => {
    // Mark as read
    setReadIds((prev) => new Set(prev).add(notification.id));

    // External links open in new tab
    if (notification.externalUrl) {
      window.open(notification.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (notification.buildingId && notification.equipmentId) {
      onNavigateToEquipment(notification.buildingId, notification.equipmentId);
    } else if (notification.buildingId) {
      onNavigateToBuilding(notification.buildingId);
    } else {
      onNavigateToPortfolio();
    }
  };

  return (
    <section className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Overview
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Portfolio Overview
          </h2>
        </div>
        <div className="mt-1">
          <DataFreshness meta={datasetMeta} />
        </div>
      </div>

      {/* ── KPI Strip (titles aligned horizontally, content centered) ─────────────────────────────────────────── */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Warnings summary — scrolls to warnings section */}
        <button
          type="button"
          onClick={scrollToWarnings}
          className="card-surface flex flex-col items-center justify-center p-5 text-center transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Warnings</p>
          <div className={`mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hasWarnings ? 'bg-red-400/15' : 'bg-emerald-400/15'}`}>
            {hasWarnings ? (
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {warningCount} <span className="text-sm font-normal text-slate-500">{hasWarnings ? 'Active' : 'All Clear'}</span>
          </p>
        </button>

        {/* Notifications summary — scrolls to notifications section */}
        <button
          type="button"
          onClick={scrollToNotifications}
          className="card-surface flex flex-col items-center justify-center p-5 text-center transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Notifications</p>
          <div className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {portfolioNotifications.length} <span className="text-sm font-normal text-slate-500">Outstanding</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
        </button>

        {/* Cooling Output — navigates to Chiller Plant (building) */}
        <button
          type="button"
          onClick={() => onNavigateToBuilding('CP1')}
          className="card-surface flex flex-col items-center justify-center p-5 text-center transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Cooling Output</p>
          <div className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {last24CoolingTons.toLocaleString()} <span className="text-sm font-normal text-slate-500">tons</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">View Chiller Plant</p>
        </button>

        {/* Energy Consumption — navigates to Tariff page (energy consumption cost) */}
        <button
          type="button"
          onClick={onNavigateToTariff}
          className="card-surface flex flex-col items-center justify-center p-5 text-center transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Energy Consumption</p>
          <div className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
            {last24ConsumptionKwh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
          </p>
          <p className="mt-0.5 text-sm font-semibold text-accent">
            {last24ConsumptionOmr} <span className="text-xs font-normal text-slate-500">OMR energy</span>
          </p>
          {last24FullBillOmr != null && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ≈ {last24FullBillOmr} OMR full bill (incl. capacity, supply, VAT)
            </p>
          )}
        </button>
      </div>

      {/* ── Daily kWh and OMR profile (line chart, dual axis) ───── */}
      <div className="group card-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Daily Profile — Consumption (kWh) & Cost (OMR)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Cost line shows CRT energy charges only (BST + distribution); capacity, supply and VAT are billed monthly.
            </p>
            <TariffBasis text={tariffBasis} className="mt-1.5" />
          </div>
          <ExportExcelButton data={last24 as unknown as Record<string, unknown>[]} fileName="Last24h_Consumption_Cost" />
        </div>
        {hasChartData ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last24} margin={{ top: 8, right: 56, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="hour"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={last24.length > 12 ? 1 : 0}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={48}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 8, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={48}
                  label={{ value: 'OMR', angle: 90, position: 'insideRight', offset: 8, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} formatter={(value: number, name: string) => [name === 'Consumption (kWh)' ? `${Number(value).toLocaleString()} kWh` : `${value} OMR`, name]} />
                <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} iconType="line" />
                <Line yAxisId="left" type="monotone" dataKey="kwh" name="Consumption (kWh)" stroke="#1A365D" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="omr" name="Energy Cost (OMR)" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No data available yet</p>
          </div>
        )}
      </div>

      {/* ── Warnings Section ──────────────────────────────────── */}
      <div ref={warningsRef} className="scroll-mt-24">
        <h3 className="mb-3 text-center text-lg font-semibold text-slate-900 dark:text-white">Active Warnings</h3>
        {realWarnings.length > 0 ? (
          <div className="space-y-2">
            {realWarnings.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleWarningClick(w)}
                className="card-surface flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${severityBg[w.severity]}`}>
                  <svg className={`h-4 w-4 ${severityColor[w.severity]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900 dark:text-white">{w.message}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(w.timestamp).toLocaleString()} &middot; <span className={`font-medium capitalize ${severityColor[w.severity]}`}>{w.severity}</span>
                  </p>
                </div>
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="card-surface flex items-center gap-3 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">All systems operating within normal parameters</p>
          </div>
        )}
      </div>

      {/* ── Notifications Section ─────────────────────────────── */}
      <div ref={notificationsRef} className="scroll-mt-24">
        <h3 className="mb-3 text-center text-lg font-semibold text-slate-900 dark:text-white">Notifications</h3>
        <div className="space-y-2">
          {portfolioNotifications.map((n) => {
            const read = isRead(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`card-surface flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl ${read ? 'opacity-60' : ''}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${read ? 'bg-slate-400/15' : n.externalUrl ? 'bg-emerald-400/15' : 'bg-accent/15'}`}>
                  {n.externalUrl ? (
                    <svg className={`h-4 w-4 ${read ? 'text-slate-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  ) : (
                    <svg className={`h-4 w-4 ${read ? 'text-slate-400' : 'text-accent'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${read ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-slate-900 dark:text-white'}`}>
                    {n.title}
                    {n.externalUrl && (
                      <span className="ml-1.5 text-xs text-emerald-500 dark:text-emerald-400">(external link)</span>
                    )}
                  </p>
                </div>
                {!read ? (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-accent">New</span>
                ) : (
                  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Portfolio link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onNavigateToPortfolio}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
        >
          View Full Portfolio &rarr;
        </button>
      </div>
    </section>
  );
};

export default DashboardPage;
