import { useState } from 'react';
import type { FC } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { energyBreakdown } from '../../data/mockDashboardData';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const UseBreakdownWidget: FC = () => {
  const [hiddenSegments, setHiddenSegments] = useState<string[]>([]);
  const displayed = energyBreakdown.filter((item) => !hiddenSegments.includes(item.name));
  const total = displayed.reduce((sum, slice) => sum + slice.value, 0);

  const toggle = (name: string) => {
    setHiddenSegments((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Electricity Use</p>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Breakdown (%)</h3>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
              <Pie data={displayed} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {displayed.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}%`, name as string]}
                contentStyle={tooltipStyles}
                labelStyle={{ color: 'var(--muted-text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Active share: {total}%</p>
        <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
          {energyBreakdown.map((segment) => {
            const active = !hiddenSegments.includes(segment.name);
            return (
              <button
                type="button"
                key={segment.name}
                onClick={() => toggle(segment.name)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-slate-100 text-slate-900 dark:bg-white/5 dark:text-white'
                    : 'text-slate-500 dark:text-slate-500'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                  {segment.name}
                </span>
                <span>{segment.value}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UseBreakdownWidget;
