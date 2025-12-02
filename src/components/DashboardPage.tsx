import { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import TodayBillWidget from './widgets/TodayBillWidget';
import OutdoorTempWidget from './widgets/OutdoorTempWidget';
import UseBreakdownWidget from './widgets/UseBreakdownWidget';
import EnergyBySystemWidget from './widgets/EnergyBySystemWidget';
import MicrogridWidget from './widgets/MicrogridWidget';
import PlaceholderWidget from './widgets/PlaceholderWidget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

type WidgetType =
  | 'todayBill'
  | 'outdoorTemp'
  | 'breakdown'
  | 'energyBySystem'
  | 'microgrid'
  | 'placeholder';

interface WidgetInstance {
  id: string;
  type: WidgetType;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLUMNS = { lg: 12, md: 10, sm: 8, xs: 6, xxs: 2 } as const;

const defaultSize: Record<WidgetType, { w: number; h: number }> = {
  todayBill: { w: 3, h: 2 },
  outdoorTemp: { w: 6, h: 3 },
  breakdown: { w: 3, h: 3 },
  energyBySystem: { w: 6, h: 3 },
  microgrid: { w: 6, h: 3 },
  placeholder: { w: 3, h: 2 },
};

const seedWidgets: Array<{ instance: WidgetInstance; layout: Layout }> = [
  {
    instance: { id: 'todayBill', type: 'todayBill' },
    layout: { i: 'todayBill', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  },
  {
    instance: { id: 'outdoorTemp', type: 'outdoorTemp' },
    layout: { i: 'outdoorTemp', x: 3, y: 0, w: 6, h: 3, minW: 3, minH: 2 },
  },
  {
    instance: { id: 'breakdown', type: 'breakdown' },
    layout: { i: 'breakdown', x: 0, y: 2, w: 3, h: 3, minW: 2, minH: 2 },
  },
  {
    instance: { id: 'energyBySystem', type: 'energyBySystem' },
    layout: { i: 'energyBySystem', x: 3, y: 3, w: 6, h: 3, minW: 3, minH: 2 },
  },
  {
    instance: { id: 'microgrid', type: 'microgrid' },
    layout: { i: 'microgrid', x: 9, y: 0, w: 3, h: 3, minW: 3, minH: 2 },
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
}

const DashboardPage = ({ isEditMode }: DashboardPageProps) => {
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
      minW: Math.min(3, size.w),
      minH: Math.min(2, size.h),
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

  const availableWidgets: Array<{ type: WidgetType; label: string }> = [
    { type: 'todayBill', label: "Today's Energy Bill" },
    { type: 'outdoorTemp', label: 'Outdoor Temperature' },
    { type: 'breakdown', label: 'Electricity Use Breakdown' },
    { type: 'energyBySystem', label: 'Energy Use by System' },
    { type: 'microgrid', label: 'Microgrid / Self-sufficiency' },
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
      default:
        return <PlaceholderWidget />;
    }
  };

  return (
    <section className="relative">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Overview</p>
          <h2 className="text-2xl font-semibold text-white">Facility KPIs</h2>
        </div>
        {isEditMode && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((prev) => !prev)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-950 shadow-card"
            >
              + Add widget
            </button>
            {addMenuOpen && (
              <div className="card-surface absolute right-0 mt-3 w-64 space-y-1 p-3">
                {availableWidgets.map((option) => (
                  <button
                    type="button"
                    key={option.type}
                    onClick={() => addWidget(option.type)}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
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
        rowHeight={80}
        isResizable={isEditMode}
        isDraggable={isEditMode}
        margin={[16, 16]}
        containerPadding={[0, 16]}
        onLayoutChange={(_current, allLayouts: Layouts) => setLayouts(allLayouts)}
        compactType={null}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className={`h-full ${isEditMode ? 'ring-1 ring-white/10' : ''}`}>
            <div className="card-surface h-full">{renderWidget(widget.type)}</div>
          </div>
        ))}
      </ResponsiveGridLayout>
    </section>
  );
};

export default DashboardPage;
