import type { FC } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tariffSeries } from '../../data/mockTariffData';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};

const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const TariffWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Tariff Rate</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Over Time (OMR/kWh)</h3>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">Last 12 months</span>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tariffSeries} margin={{ top: 10, left: 8, right: 24, bottom: 10 }}>
            <defs>
              <linearGradient id="tariffGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
            <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={{ stroke: 'var(--grid-stroke)' }} />
            <YAxis
              width={56}
              tick={tickStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid-stroke)' }}
              domain={[0.15, 0.25]}
              label={{ value: 'OMR', angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--muted-text)', style: { textTransform: 'uppercase' } }}
              tickFormatter={(value) => value.toFixed(2)}
            />
            <Tooltip
              contentStyle={tooltipStyles}
              labelStyle={{ color: 'var(--muted-text)' }}
              formatter={(value: number) => [`${value.toFixed(2)} OMR/kWh`, 'Tariff']}
            />
            <Area
              type="monotone"
              dataKey="tariff"
              stroke="#f59e0b"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#tariffGradient)"
              dot={{ r: 4, fill: '#f59e0b' }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TariffWidget;
