import type { FC } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { outdoorTempSeries } from '../../data/mockDashboardData';

const OutdoorTempWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Muscat</p>
          <h3 className="text-lg font-semibold text-white">Outdoor Temperature</h3>
        </div>
        <span className="text-sm text-slate-400">Last 7 days</span>
      </div>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={outdoorTempSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" unit="°C" allowDecimals={false} domain={[32, 40]} />
            <Tooltip
              contentStyle={{ background: '#15223c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OutdoorTempWidget;
