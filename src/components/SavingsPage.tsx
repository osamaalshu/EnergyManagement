import { useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { FC } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { savingsSummary, savingsTimeseries, savingsPercentTrend } from '../data/mockSavingsData';

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const ResponsiveGridLayout = WidthProvider(Responsive);
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLUMNS = { lg: 12, md: 10, sm: 8, xs: 6, xxs: 2 } as const;

const initialCharts: Layout[] = [
  { i: 'baselineActual', x: 0, y: 0, w: 8, h: 5, minW: 4, minH: 4 },
  { i: 'savingsPercent', x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
];

const cloneLayouts = (items: Layout[]): Layouts => {
  const clones = items.map((item) => ({ ...item }));
  return (Object.keys(BREAKPOINTS) as Array<keyof typeof BREAKPOINTS>).reduce((acc, key) => {
    acc[key] = clones.map((layout) => ({ ...layout }));
    return acc;
  }, {} as Layouts);
};

type SavingsPageProps = {
  isEditMode: boolean;
};

const SavingsPage: FC<SavingsPageProps> = ({ isEditMode }) => {
  const summaryCards = [
    {
      label: 'Baseline consumption (kWh)',
      value: formatNumber(savingsSummary.baselineKwh),
      accent: 'text-slate-700 dark:text-slate-300',
    },
    {
      label: 'Actual consumption (kWh)',
      value: formatNumber(savingsSummary.actualKwh),
      accent: 'text-slate-700 dark:text-slate-300',
    },
    {
      label: 'Savings vs baseline (%)',
      value: `${savingsSummary.savingsPercent}%`,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  const [chartLayouts, setChartLayouts] = useState<Layouts>(() => cloneLayouts(initialCharts));

  const handleChartLayoutChange = (_current: Layout[], layouts: Layouts) => setChartLayouts(layouts);


  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Savings</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Baseline vs actual performance</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="card-surface p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{card.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <ResponsiveGridLayout
        className={`layout ${isEditMode ? 'edit-mode' : ''}`}
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        layouts={chartLayouts}
        rowHeight={95}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        margin={[16, 16]}
        containerPadding={[0, 16]}
        compactType={null}
        onLayoutChange={handleChartLayoutChange}
      >
        <div key="baselineActual" className={`h-full ${isEditMode ? 'ring-1 ring-slate-200 dark:ring-white/10' : ''}`}>
          <div className="card-surface h-full p-6 flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Baseline vs Actual Energy Performance</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">Monthly view</span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsTimeseries} margin={{ top: 10, left: 0, right: 24, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
                <YAxis
                  width={56}
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--muted-text)', style: { textTransform: 'uppercase' } }}
                />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                <Legend wrapperStyle={{ color: 'var(--muted-text)' }} />
                <Bar dataKey="baseline" name="Baseline" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div key="savingsPercent" className={`h-full ${isEditMode ? 'ring-1 ring-slate-200 dark:ring-white/10' : ''}`}>
          <div className="card-surface h-full p-6 flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Savings compared to baseline (%)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sparkline view</p>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsPercentTrend} margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={false} hide />
                <YAxis
                  width={56}
                  domain={['auto', 'auto']}
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  label={{ value: '%', angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--muted-text)', style: { textTransform: 'uppercase' } }}
                />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                <Line type="monotone" dataKey="percent" stroke="#f472b6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </ResponsiveGridLayout>
    </section>
  );
};

export default SavingsPage;
