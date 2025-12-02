import type { FC } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { microgridSeries } from '../../data/mockDashboardData';

const MicrogridWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Microgrid</p>
          <h3 className="text-lg font-semibold text-white">Self-sufficiency</h3>
        </div>
        <span className="text-sm text-slate-500">Today</span>
      </div>
      <div className="h-60 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={microgridSeries} margin={{ top: 10, left: -20, right: 0 }}>
            <defs>
              <linearGradient id="consumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="self" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" unit=" kWh" />
            <Tooltip
              contentStyle={{ background: '#15223c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
            />
            <Area type="monotone" dataKey="consumption" stroke="#38bdf8" fillOpacity={1} fill="url(#consumption)" name="Consumption" />
            <Area type="monotone" dataKey="self" stroke="#34d399" fillOpacity={1} fill="url(#self)" name="Self-sufficiency" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MicrogridWidget;
