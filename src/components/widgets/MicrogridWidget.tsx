import type { FC } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { microgridSeries } from '../../data/mockDashboardData';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const MicrogridWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Microgrid</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Self-sufficiency</h3>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">Today</span>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={microgridSeries} margin={{ top: 10, left: 12, right: 24, bottom: 10 }}>
            <defs>
              <linearGradient id="consumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A365D" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#1A365D" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="self" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82C91E" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#82C91E" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
            <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
            <YAxis
              width={56}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid-stroke)' }}
              label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: 'var(--muted-text)', style: { textTransform: 'uppercase' } }}
            />
            <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
            <Area type="monotone" dataKey="consumption" stroke="#1A365D" fillOpacity={1} fill="url(#consumption)" name="Consumption" />
            <Area type="monotone" dataKey="self" stroke="#82C91E" fillOpacity={1} fill="url(#self)" name="Self-sufficiency" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MicrogridWidget;
