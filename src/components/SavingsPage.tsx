import type { FC } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { savingsSummary, savingsTimeseries, savingsPercentTrend } from '../data/mockSavingsData';

const formatNumber = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

const SavingsPage: FC = () => {
  const summaryCards = [
    {
      label: 'Baseline consumption (kWh)',
      value: formatNumber(savingsSummary.baselineKwh),
      accent: 'text-slate-300',
    },
    {
      label: 'Actual consumption (kWh)',
      value: formatNumber(savingsSummary.actualKwh),
      accent: 'text-slate-300',
    },
    {
      label: 'Savings vs baseline (%)',
      value: `${savingsSummary.savingsPercent}%`,
      accent: 'text-emerald-400',
    },
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Savings</p>
        <h2 className="text-2xl font-semibold text-white">Baseline vs actual performance</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="card-surface p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface h-[420px] p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Baseline vs Actual Energy Performance</h3>
            <span className="text-sm text-slate-500">Monthly view</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={savingsTimeseries} margin={{ top: 10, left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" unit=" kWh" />
              <Tooltip
                contentStyle={{ background: '#15223c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="baseline" name="Baseline" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card-surface h-[420px] p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Savings compared to baseline (%)</h3>
            <p className="text-sm text-slate-500">Sparkline view</p>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={savingsPercentTrend} margin={{ top: 10, right: 10, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" stroke="#94a3b8" hide />
              <YAxis stroke="#94a3b8" unit="%" domain={[0, 40]} />
              <Tooltip
                contentStyle={{ background: '#15223c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="percent" stroke="#f472b6" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default SavingsPage;
