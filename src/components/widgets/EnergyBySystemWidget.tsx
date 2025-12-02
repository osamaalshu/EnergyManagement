import type { FC } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { energyBySystemData } from '../../data/mockDashboardData';

const EnergyBySystemWidget: FC = () => {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Energy Use</p>
          <h3 className="text-lg font-semibold text-white">By system (kWh)</h3>
        </div>
        <span className="text-sm text-slate-500">Last 7 days</span>
      </div>
      <div className="h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={energyBySystemData} margin={{ top: 10, left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" unit=" kWh" />
            <Tooltip
              contentStyle={{ background: '#15223c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
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
