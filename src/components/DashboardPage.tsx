import type { FC } from 'react';
import {
  portfolioWarnings,
  portfolioNotifications,
  todaysProduction,
  todaysConsumption,
} from '../data/mockPortfolioData';

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
  const unreadCount = portfolioNotifications.filter((n) => !n.read).length;

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Warnings summary */}
        <button
          type="button"
          onClick={onNavigateToPortfolio}
          className="card-surface flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-400/15">
            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Warnings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {portfolioWarnings.length} <span className="text-sm font-normal text-slate-500">Active</span>
            </p>
          </div>
        </button>

        {/* Notifications summary */}
        <button
          type="button"
          onClick={onNavigateToPortfolio}
          className="card-surface flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notifications</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {portfolioNotifications.length} <span className="text-sm font-normal text-slate-500">Outstanding</span>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
          </div>
        </button>

        {/* Today's Production */}
        <div className="card-surface flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Today&apos;s Production</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {todaysProduction.kWh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
              <span className="mx-1 text-slate-400">/</span>
              {todaysProduction.omr} <span className="text-sm font-normal text-slate-500">OMR</span>
            </p>
          </div>
        </div>

        {/* Today's Consumption */}
        <div className="card-surface flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Today&apos;s Consumption</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {todaysConsumption.kWh.toLocaleString()} <span className="text-sm font-normal text-slate-500">kWh</span>
              <span className="mx-1 text-slate-400">/</span>
              {todaysConsumption.omr} <span className="text-sm font-normal text-slate-500">OMR</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Warnings List (clickable) ─────────────────────────── */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Active Warnings</h3>
        <div className="space-y-2">
          {portfolioWarnings.map((w) => (
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
      </div>

      {/* ── Notifications List (clickable) ────────────────────── */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Notifications</h3>
        <div className="space-y-2">
          {portfolioNotifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleNotificationClick(n)}
              className={`card-surface flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl ${n.read ? 'opacity-60' : ''}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-slate-400/15' : 'bg-accent/15'}`}>
                <svg className={`h-4 w-4 ${n.read ? 'text-slate-400' : 'text-accent'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{n.title}</p>
                {!n.read && <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent" />}
              </div>
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* View Portfolio link */}
      <div className="text-center">
        <button
          type="button"
          onClick={onNavigateToPortfolio}
          className="rounded-xl bg-accent/10 px-6 py-3 text-sm font-semibold text-accent transition hover:bg-accent/20"
        >
          View Full Portfolio &rarr;
        </button>
      </div>
    </section>
  );
};

export default DashboardPage;
