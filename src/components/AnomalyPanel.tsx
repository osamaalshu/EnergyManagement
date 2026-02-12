import type { FC } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { AnomalyData } from '../types/portfolio';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

interface AnomalyPanelProps {
  data: AnomalyData;
  /** Optional title override (default: "Anomaly Detection") */
  title?: string;
}

const AnomalyPanel: FC<AnomalyPanelProps> = ({ data, title = 'Anomaly Detection' }) => {
  const hasData = data.series.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Anomalies Last Month
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {data.anomalyCount}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Inefficiency Cost
          </p>
          <p className="mt-2 text-3xl font-semibold text-red-400">
            {data.inefficiencyCost} <span className="text-base font-normal text-slate-500">OMR</span>
          </p>
        </div>
      </div>

      {/* Baseline vs Actual chart */}
      {hasData ? (
        <div className="card-surface p-4">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Baseline vs Actual (Last Month)
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--muted-text)' }} />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card-surface flex h-40 items-center justify-center p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">No anomaly data available</p>
        </div>
      )}
    </div>
  );
};

export default AnomalyPanel;
