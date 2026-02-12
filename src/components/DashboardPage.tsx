import { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import TodayBillWidget from './widgets/TodayBillWidget';
import OutdoorTempWidget from './widgets/OutdoorTempWidget';
import UseBreakdownWidget from './widgets/UseBreakdownWidget';
import EnergyBySystemWidget from './widgets/EnergyBySystemWidget';
import MicrogridWidget from './widgets/MicrogridWidget';
import PlaceholderWidget from './widgets/PlaceholderWidget';
import TariffWidget from './widgets/TariffWidget';
import {
  portfolioWarnings,
  portfolioNotifications,
  todaysProduction,
  todaysConsumption,
} from '../data/mockPortfolioData';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type WidgetType =
  | 'todayBill'
  | 'outdoorTemp'
  | 'breakdown'
  | 'energyBySystem'
  | 'microgrid'
  | 'tariff'
  | 'placeholder';

interface WidgetInstance {
  id: string;
  type: WidgetType;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLUMNS = { lg: 12, md: 10, sm: 8, xs: 6, xxs: 2 } as const;

const defaultSize: Record<WidgetType, { w: number; h: number }> = {
  todayBill: { w: 4, h: 3 },
  outdoorTemp: { w: 8, h: 4 },
  breakdown: { w: 4, h: 4 },
  energyBySystem: { w: 8, h: 4 },
  microgrid: { w: 6, h: 4 },
  tariff: { w: 6, h: 4 },
  placeholder: { w: 4, h: 3 },
};

const seedWidgets: Array<{ instance: WidgetInstance; layout: Layout }> = [
  {
    instance: { id: 'todayBill', type: 'todayBill' },
    layout: { i: 'todayBill', x: 0, y: 0, w: 4, h: 3, minW: 3, minH: 2 },
  },
  {
    instance: { id: 'outdoorTemp', type: 'outdoorTemp' },
    layout: { i: 'outdoorTemp', x: 4, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
  },
  {
    instance: { id: 'breakdown', type: 'breakdown' },
    layout: { i: 'breakdown', x: 0, y: 3, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    instance: { id: 'energyBySystem', type: 'energyBySystem' },
    layout: { i: 'energyBySystem', x: 4, y: 4, w: 8, h: 4, minW: 4, minH: 3 },
  },
  {
    instance: { id: 'microgrid', type: 'microgrid' },
    layout: { i: 'microgrid', x: 0, y: 7, w: 6, h: 4, minW: 4, minH: 3 },
  },
];

const cloneLayouts = (layoutItems: Layout[]): Layouts => {
  return (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).reduce((acc, key) => {
    acc[key as keyof Layouts] = layoutItems.map((item) => ({ ...item }));
    return acc;
  }, {} as Layouts);
};

interface DashboardPageProps {
  isEditMode: boolean;
  onNavigateToPortfolio?: () => void;
}

const DashboardPage = ({ isEditMode, onNavigateToPortfolio }: DashboardPageProps) => {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(() => seedWidgets.map(({ instance }) => instance));
  const [layouts, setLayouts] = useState<Layouts>(() => cloneLayouts(seedWidgets.map(({ layout }) => layout)));
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (!isEditMode) {
      setAddMenuOpen(false);
    }
  }, [isEditMode]);

  const addWidget = (type: WidgetType) => {
    const id = `${type}-${Date.now()}`;
    const size = defaultSize[type] ?? { w: 3, h: 2 };
    const layoutItem: Layout = {
      i: id,
      x: 0,
      y: Infinity,
      w: size.w,
      h: size.h,
      minW: Math.max(3, Math.min(size.w, 6)),
      minH: Math.max(2, Math.min(size.h, 4)),
    };

    setWidgets((prev) => [...prev, { id, type }]);
    setLayouts((prev: Layouts) => {
      const nextLayouts: Layouts = {};
      (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).forEach((key) => {
        const existing = (prev[key] ?? []) as Layout[];
        nextLayouts[key] = [...existing.map((item: Layout) => ({ ...item })), { ...layoutItem }];
      });
      return nextLayouts;
    });
    setAddMenuOpen(false);
  };

  const removeWidget = (widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setLayouts((prev: Layouts) => {
      const nextLayouts: Layouts = {};
      (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).forEach((key) => {
        const existing = (prev[key] ?? []) as Layout[];
        nextLayouts[key] = existing.filter((item: Layout) => item.i !== widgetId);
      });
      return nextLayouts;
    });
  };

  const organizeWidgets = () => {
    const sorted = [...widgets].sort((a, b) => {
      const order = ['todayBill', 'outdoorTemp', 'breakdown', 'energyBySystem', 'microgrid', 'tariff', 'placeholder'];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });

    const newLayouts: Layouts = {};
    (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).forEach((breakpoint) => {
      const cols = COLUMNS[breakpoint];
      const layoutItems: Layout[] = [];

      sorted.forEach((widget) => {
        const size = defaultSize[widget.type] ?? { w: 3, h: 2 };
        const w = Math.min(size.w, cols);
        const h = size.h;

        let bestX = 0;
        let bestY = 0;
        let minY = Infinity;

        for (let tryX = 0; tryX <= cols - w; tryX++) {
          const maxY = Math.max(0, ...layoutItems
            .filter(item => 
              !(item.x + item.w <= tryX || item.x >= tryX + w)
            )
            .map(item => item.y + item.h)
          );

          if (maxY < minY) {
            minY = maxY;
            bestX = tryX;
            bestY = maxY;
          }
        }

        layoutItems.push({
          i: widget.id,
          x: bestX,
          y: bestY,
          w,
          h,
          minW: Math.max(3, Math.min(size.w, 6)),
          minH: Math.max(2, Math.min(size.h, 4)),
        });
      });

      newLayouts[breakpoint] = layoutItems;
    });

    setLayouts(newLayouts);
  };

  const scaleWidgets = (factor: number) => {
    setLayouts((prev: Layouts) => {
      const nextLayouts: Layouts = {};
      (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).forEach((breakpoint) => {
        const existing = (prev[breakpoint] ?? []) as Layout[];
        nextLayouts[breakpoint] = existing.map((item: Layout) => {
          const newW = Math.max(item.minW || 3, Math.min(COLUMNS[breakpoint], Math.round(item.w * factor)));
          const newH = Math.max(item.minH || 2, Math.round(item.h * factor));
          return { ...item, w: newW, h: newH };
        });
      });
      return nextLayouts;
    });
  };

  const minimizeWidgets = () => scaleWidgets(0.75);
  const enlargeWidgets = () => scaleWidgets(1.33);

  const availableWidgets: Array<{ type: WidgetType; label: string }> = [
    { type: 'todayBill', label: "Today's Energy Bill" },
    { type: 'outdoorTemp', label: 'Outdoor Temperature' },
    { type: 'breakdown', label: 'Electricity Use Breakdown' },
    { type: 'energyBySystem', label: 'Energy Use by System' },
    { type: 'microgrid', label: 'Microgrid / Self-sufficiency' },
    { type: 'tariff', label: 'Tariff Rate Over Time' },
    { type: 'placeholder', label: 'Empty widget' },
  ];

  const renderWidget = (type: WidgetType) => {
    switch (type) {
      case 'todayBill':
        return <TodayBillWidget />;
      case 'outdoorTemp':
        return <OutdoorTempWidget />;
      case 'breakdown':
        return <UseBreakdownWidget />;
      case 'energyBySystem':
        return <EnergyBySystemWidget />;
      case 'microgrid':
        return <MicrogridWidget />;
      case 'tariff':
        return <TariffWidget />;
      default:
        return <PlaceholderWidget />;
    }
  };

  const severityIcon: Record<string, string> = { critical: 'text-red-400', warning: 'text-amber-400', info: 'text-accent' };
  const unreadCount = portfolioNotifications.filter((n) => !n.read).length;

  return (
    <>
      {/* ── Portfolio Overview Strip (static, outside grid) ───── */}
      <section className="mb-6">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Portfolio Overview</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Warnings */}
          <div className="card-surface flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-400/15">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Warnings</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{portfolioWarnings.length} <span className="text-sm font-normal text-slate-500">Active</span></p>
              {portfolioWarnings[0] && (
                <p className={`mt-1 truncate text-xs ${severityIcon[portfolioWarnings[0].severity]}`}>
                  {portfolioWarnings[0].message}
                </p>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="card-surface flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notifications</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{portfolioNotifications.length} <span className="text-sm font-normal text-slate-500">Outstanding</span></p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
            </div>
          </div>

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
        {onNavigateToPortfolio && (
          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={onNavigateToPortfolio}
              className="text-sm font-medium text-accent transition hover:underline"
            >
              View Portfolio &rarr;
            </button>
          </div>
        )}
      </section>

      {/* ── Existing Dashboard ────────────────────────────────── */}
    <section className="relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Overview</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Facility KPIs</h2>
        </div>
        {isEditMode && (
          <div className="relative z-50 flex items-center gap-3">
            <button
              type="button"
              onClick={minimizeWidgets}
              className="rounded-full border border-slate-300 bg-transparent px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/5"
              title="Shrink widgets by 25%"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={enlargeWidgets}
              className="rounded-full border border-slate-300 bg-transparent px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/5"
              title="Enlarge widgets by 33%"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={organizeWidgets}
              className="rounded-full border border-accent/30 bg-transparent px-4 py-2 text-sm font-semibold text-accent shadow-sm transition hover:bg-accent/10"
            >
              ⚡ Organize
            </button>
            <button
              type="button"
              onClick={() => setAddMenuOpen((prev) => !prev)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-950 shadow-card"
            >
              + Add widget
            </button>
            {addMenuOpen && (
              <div className="card-surface absolute right-0 mt-3 w-64 space-y-1 p-3 z-50 shadow-2xl">
                {availableWidgets.map((option) => (
                  <button
                    type="button"
                    key={option.type}
                    onClick={() => addWidget(option.type)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ResponsiveGridLayout
        className={`layout ${isEditMode ? 'edit-mode' : ''}`}
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        layouts={layouts}
        rowHeight={95}
        isResizable={isEditMode}
        isDraggable={isEditMode}
        margin={[16, 16]}
        containerPadding={[0, 16]}
        onLayoutChange={(_current, allLayouts: Layouts) => setLayouts(allLayouts)}
        compactType={null}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="h-full group"
          >
            <div
              className={`card-surface relative h-full transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl focus-within:-translate-y-1 ${
                isEditMode ? 'cursor-grab active:cursor-grabbing border-accent/20' : 'cursor-default'
              }`}
            >
              {isEditMode && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeWidget(widget.id);
                  }}
                  className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-red-500"
                  aria-label="Remove widget"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {renderWidget(widget.type)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </section>
    </>
  );
};

export default DashboardPage;
