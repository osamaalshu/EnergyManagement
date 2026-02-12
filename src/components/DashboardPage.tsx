import { type FC, useState, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  portfolioWarnings,
  portfolioNotifications,
  todaysProduction,
  todaysConsumption,
  hourlyProductionConsumption,
} from '../data/mockPortfolioData';

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

interface DashboardPageProps {
  onNavigateToPortfolio: () => void;
  onNavigateToBuilding: (buildingId: string) => void;
  onNavigateToEquipment: (buildingId: string, equipmentId: string) => void;
}

const DashboardPage: FC<DashboardPageProps> = ({
  onNavigateToPortfolio,
  onNavigateToBuilding,
  onNavigateToEquipment,
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

  const hasChartData = hourlyProductionConsumption.length > 0 &&
    hourlyProductionConsumption.some((d) => d.production > 0 || d.consumption > 0);

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
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
          Overview
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Portfolio Overview
        </h2>
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────── */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Warnings summary — scrolls to warnings section */}
        <button
          type="button"
          onClick={scrollToWarnings}
          className="card-surface flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${hasWarnings ? 'bg-red-400/15' : 'bg-emerald-400/15'}`}>
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
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Warnings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {warningCount} <span className="text-sm font-normal text-slate-500">{hasWarnings ? 'Active' : 'All Clear'}</span>
            </p>
          </div>
        </button>

        {/* Notifications summary — scrolls to notifications section */}
        <button
          type="button"
          onClick={scrollToNotifications}
          className="card-surface flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notifications</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {portfolioNotifications.length} <span className="text-sm font-normal text-slate-500">Outstanding</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
          </div>
        </button>

        {/* Today's Production */}
        <div className="card-surface flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Today&apos;s Production</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {todaysProduction.kWh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              {todaysProduction.omr} <span className="text-xs font-normal text-slate-500">OMR</span>
            </p>
          </div>
        </div>

        {/* Today's Consumption */}
        <div className="card-surface flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Today&apos;s Consumption</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {todaysConsumption.kWh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
              {todaysConsumption.omr} <span className="text-xs font-normal text-slate-500">OMR</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Hourly Production vs Consumption Chart ─────────────── */}
      <div className="card-surface p-6">
        <h3 className="mb-4 text-center text-lg font-semibold text-slate-900 dark:text-white">
          Today&apos;s Hourly Production vs Consumption
        </h3>
        {hasChartData ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyProductionConsumption} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="hour"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={hourlyProductionConsumption.length > 12 ? 1 : 0}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 10, fill: 'var(--muted-text)', fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                <Legend
                  wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }}
                  iconType="square"
                />
                <Bar dataKey="production" name="Production (kWh)" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="consumption" name="Consumption (kWh)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              </BarChart>
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
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-accent">New</span>
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
