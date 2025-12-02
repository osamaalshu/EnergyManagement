import type { FC } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { energyBySystemData } from '../../data/mockDashboardData';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const EnergyBySystemWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Energy Use</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">By system (kWh)</h3>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">Last 7 days</span>
      </div>
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={energyBySystemData} margin={{ top: 10, left: 12, right: 24, bottom: 10 }}>
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
            <Legend wrapperStyle={{ color: 'var(--muted-text)' }} />
            <Bar dataKey="hvac" name="HVAC" stackId="a" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="lighting" name="Lighting" stackId="a" fill="#f472b6" radius={[6, 6, 0, 0]} />
            <Bar dataKey="equipment" name="Equipment" stackId="a" fill="#34d399" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EnergyBySystemWidget;
