import type { FC } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { outdoorTempSeries } from '../../data/mockDashboardData';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const OutdoorTempWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Muscat</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Outdoor Temperature</h3>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">Last 7 days</span>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={outdoorTempSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
            <XAxis dataKey="day" tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
            <YAxis
              width={56}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid-stroke)' }}
              allowDecimals={false}
              domain={[32, 40]}
              label={{ value: '°C', angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--muted-text)', style: { textTransform: 'uppercase' } }}
            />
            <Tooltip
              contentStyle={tooltipStyles}
              labelStyle={{ color: 'var(--muted-text)' }}
              itemStyle={{ color: '#0f172a' }}
            />
            <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OutdoorTempWidget;
