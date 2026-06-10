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
import type { AnomalyData, PhysicsRuleResult, TimeResolution } from '../types/portfolio';
import TimeResolutionSelector from './TimeResolutionSelector';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 12 } as const;

const severityBadge: Record<string, string> = {
  HIGH: 'bg-red-400/15 text-red-400',
  MEDIUM: 'bg-amber-400/15 text-amber-400',
  LOW: 'bg-sky-400/15 text-sky-400',
};

interface AnomalyPanelProps {
  data: AnomalyData;
  /** Optional title override (default: "Anomaly Detection") */
  title?: string;
  /** Optional subtitle explaining the data source / methodology */
  subtitle?: string;
  /** Physics rule findings (rule id, severity, hours, priced OMR impact) */
  findings?: PhysicsRuleResult[];
  /** When provided, shows a time-resolution toggle */
  resolution?: TimeResolution;
  onResolutionChange?: (resolution: TimeResolution) => void;
}

const AnomalyPanel: FC<AnomalyPanelProps> = ({
  data,
  title = 'Anomaly Detection',
  subtitle,
  findings,
  resolution,
  onResolutionChange,
}) => {
  const hasData = data.series.length > 0;
  const isPhysics = findings != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {resolution != null && onResolutionChange && (
          <TimeResolutionSelector value={resolution} onChange={onResolutionChange} />
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {isPhysics ? 'Rule-Triggered Hours' : 'Anomalies Detected'}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {data.anomalyCount.toLocaleString()}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {isPhysics ? 'Diagnosed Cost Impact' : 'Inefficiency Cost'}
          </p>
          <p className="mt-2 text-3xl font-semibold text-red-400">
            {data.inefficiencyCost.toLocaleString()} <span className="text-base font-normal text-slate-500">OMR</span>
          </p>
        </div>
      </div>

      {/* Physics rule findings */}
      {findings && findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.ruleId} className="card-surface flex flex-wrap items-center gap-3 p-3">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${severityBadge[f.severity] ?? 'bg-slate-400/15 text-slate-400'}`}>
                {f.ruleId}
              </span>
              <p className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-300">{f.description}</p>
              <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {f.triggeredHours.toLocaleString()} / {f.evaluatedHours.toLocaleString()} hrs
              </p>
              <p className={`shrink-0 text-sm font-semibold ${f.triggeredHours > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {f.omrImpact.toLocaleString(undefined, { maximumFractionDigits: 1 })} OMR
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Baseline vs Actual chart */}
      {hasData ? (
        <div className="card-surface p-4">
          <p className="mb-3 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
            Baseline vs Actual
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  interval={data.series.length > 30 ? Math.floor(data.series.length / 8) : 'preserveStartEnd'}
                  angle={data.series.length > 15 ? -45 : 0}
                  textAnchor={data.series.length > 15 ? 'end' : 'middle'}
                  height={data.series.length > 15 ? 60 : 30}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={52}
                  label={{ value: 'kW/ton', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyles}
                  labelStyle={{ color: 'var(--muted-text)' }}
                />
                <Legend wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }} iconSize={12} />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name={isPhysics ? 'Gulf benchmark (COP 4.5)' : 'Baseline'}
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
