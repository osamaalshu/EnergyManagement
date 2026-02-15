import { type FC, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  equipmentDetails,
  getChillerTimeSeries,
  getChillerAnomaly,
  getTowerTempSeries,
  getPumpTimeSeries,
  getChillerKPIsForResolution,
  getCoolingTowerKPIsForResolution,
  getPumpKPIsForResolution,
} from '../data/mockPortfolioData';
import AnomalyPanel from './AnomalyPanel';
import TimeResolutionSelector from './TimeResolutionSelector';
import type { TimeResolution } from '../types/portfolio';

const tooltipStyles = {
  background: 'var(--card-bg)',
  border: '1px solid var(--tooltip-border)',
  borderRadius: '0.75rem',
};
const tickStyle = { fill: 'var(--muted-text)', fontSize: 11 } as const;

interface EquipmentPageProps {
  buildingId: string;
  equipmentId: string;
  onBack: () => void;
  onNavigateToPortfolio: () => void;
}

const EquipmentPage: FC<EquipmentPageProps> = ({ equipmentId, onBack }) => {
  const detail = equipmentDetails[equipmentId];
  const equipment = detail?.equipment;
  const isChiller = equipment?.type === 'chiller';
  const isTower = equipment?.type === 'coolingTower';
  const isPump = equipment?.type === 'pump';
  const chillerNum = isChiller ? parseInt(equipmentId.split('-').pop() ?? '0', 10) : 0;

  const [chartResolution, setChartResolution] = useState<TimeResolution>('hourly');
  const [anomalyResolution, setAnomalyResolution] = useState<TimeResolution>('weekly');
  const [overviewResolution, setOverviewResolution] = useState<TimeResolution>('hourly');

  // Get resolution-aware time series and anomaly data for chillers
  const chartData = useMemo(() => {
    if (!isChiller || chillerNum === 0) return null;
    return getChillerTimeSeries(chillerNum, chartResolution);
  }, [isChiller, chillerNum, chartResolution]);

  const anomalyData = useMemo(() => {
    if (!isChiller || chillerNum === 0) return detail?.anomaly ?? { anomalyCount: 0, inefficiencyCost: 0, series: [] };
    return getChillerAnomaly(chillerNum, anomalyResolution);
  }, [isChiller, chillerNum, anomalyResolution, detail?.anomaly]);

  const towerTempSeries = useMemo(() => {
    if (!isTower) return [];
    return getTowerTempSeries(chartResolution);
  }, [isTower, chartResolution]);

  const pumpSeries = useMemo(() => {
    if (!isPump) return [];
    return getPumpTimeSeries(chartResolution);
  }, [isPump, chartResolution]);

  const overviewChillerKPIs = useMemo(() => {
    if (!isChiller || chillerNum === 0) return null;
    return getChillerKPIsForResolution(chillerNum, overviewResolution);
  }, [isChiller, chillerNum, overviewResolution]);
  const overviewTowerKPIs = useMemo(() => {
    if (!isTower) return null;
    return getCoolingTowerKPIsForResolution(overviewResolution);
  }, [isTower, overviewResolution]);
  const overviewPumpKPIs = useMemo(() => {
    if (!isPump) return null;
    return getPumpKPIsForResolution(overviewResolution);
  }, [isPump, overviewResolution]);

  if (!detail) {
    return (
      <section className="flex h-64 items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Equipment not found.</p>
      </section>
    );
  }

  const { chillerKPIs, coolingTowerKPIs, pumpKPIs } = detail;
  const efficiencySeries = chartData?.efficiencySeries ?? detail.efficiencySeries;
  const temperatureLoopSeries = chartData?.temperatureLoopSeries ?? detail.temperatureLoopSeries;
  const powerCoolingSeries = chartData?.powerCoolingSeries ?? detail.powerCoolingSeries;

  const overviewPeriodLabel =
    overviewResolution === 'hourly'
      ? 'Last 24 hours (hourly average)'
      : overviewResolution === 'daily'
        ? 'Last 7 days (daily average)'
        : 'Last 4 weeks (weekly average)';

  const statusColor: Record<string, string> = {
    running: 'bg-emerald-400',
    off: 'bg-slate-400',
    warning: 'bg-red-400',
  };

  const statusTextColor: Record<string, string> = {
    running: 'text-emerald-400',
    off: 'text-slate-400',
    warning: 'text-red-400',
  };

  // Determine tick props based on data length
  const getXAxisProps = (dataLength: number) => ({
    interval: dataLength > 30 ? Math.floor(dataLength / 8) : (dataLength > 15 ? Math.floor(dataLength / 6) : 0),
    angle: dataLength > 12 ? -45 : 0,
    textAnchor: (dataLength > 12 ? 'end' : 'middle') as 'end' | 'middle',
    height: dataLength > 12 ? 60 : 30,
  });

  return (
    <section className="space-y-8">
      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        {/* Breadcrumb hidden — navigation via back button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            aria-label="Back to building"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{equipment.name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-accent/20 px-3 py-0.5 text-xs font-medium text-accent capitalize">
                {equipment.type === 'coolingTower' ? 'Cooling Tower' : equipment.type}
              </span>
              <span className={`flex items-center gap-1 text-xs font-medium ${statusTextColor[equipment.status]}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${statusColor[equipment.status]}`} />
                {equipment.status === 'running' ? 'Running' : equipment.status === 'off' ? 'Off' : 'Warning'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overview KPI Cards (hourly / daily / weekly) ───────── */}
      {isChiller && (overviewChillerKPIs ?? chillerKPIs) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{overviewPeriodLabel}</p>
            <TimeResolutionSelector value={overviewResolution} onChange={setOverviewResolution} limitTo={['hourly', 'daily', 'weekly']} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(() => {
              const kpis = overviewChillerKPIs ?? chillerKPIs!;
              return (
                <>
                  <KpiCard label="Delta T" value={kpis.deltaT} unit="°C" sub={`Return ${kpis.chilledWaterReturnTemp}°C − Supply ${kpis.chilledWaterSupplyTemp}°C`} />
                  <KpiCard label="Chilled Water Flow" value={kpis.chilledWaterFlowRate} unit="L/s" />
                  <KpiCard label="Condenser Water Flow" value={kpis.condenserWaterFlowRate} unit="L/s" />
                  <KpiCard label="Cooling Output" value={kpis.coolingTons} unit="tons" />
                  <KpiCard
                    label="Efficiency"
                    value={kpis.efficiency}
                    unit="kW/ton"
                    accent={kpis.efficiency <= 0.5 ? 'text-emerald-400' : kpis.efficiency <= 0.7 ? 'text-yellow-400' : 'text-red-400'}
                    sub="Target: < 0.70"
                  />
                  <KpiCard label="Power Draw" value={kpis.powerDraw} unit="kW" />
                </>
              );
            })()}
          </div>
        </>
      )}

      {isTower && (overviewTowerKPIs ?? coolingTowerKPIs) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{overviewPeriodLabel}</p>
            <TimeResolutionSelector value={overviewResolution} onChange={setOverviewResolution} limitTo={['hourly', 'daily', 'weekly']} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Condenser Water Supply Temp"
              value={(overviewTowerKPIs ?? coolingTowerKPIs!).condenserWaterSupplyTemp}
              unit="°C"
              accent={(overviewTowerKPIs ?? coolingTowerKPIs!).condenserWaterSupplyTemp > 50 ? 'text-red-400' : undefined}
            />
          </div>
        </>
      )}

      {isPump && (overviewPumpKPIs ?? pumpKPIs) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{overviewPeriodLabel}</p>
            <TimeResolutionSelector value={overviewResolution} onChange={setOverviewResolution} limitTo={['hourly', 'daily', 'weekly']} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(() => {
              const kpis = overviewPumpKPIs ?? pumpKPIs!;
              return (
                <>
                  <KpiCard label="Flow Rate" value={kpis.flowRate} unit="m³/s" />
                  <KpiCard label="Pump Head Power" value={kpis.powerDraw} unit="kW" />
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Time Series Charts (chiller) ───────────────────────── */}
      {isChiller && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-center text-lg font-semibold text-slate-900 dark:text-white">Time Series</h3>
            <TimeResolutionSelector value={chartResolution} onChange={setChartResolution} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Efficiency Over Time */}
            {efficiencySeries && efficiencySeries.length > 0 && (
              <div className="card-surface p-5">
                <h4 className="mb-3 text-center text-sm font-semibold text-slate-900 dark:text-white">Efficiency Over Time</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={efficiencySeries} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                      <XAxis
                        dataKey="label"
                        tick={tickStyle}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--grid-stroke)' }}
                        {...getXAxisProps(efficiencySeries.length)}
                      />
                      <YAxis
                        tick={tickStyle}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--grid-stroke)' }}
                        width={52}
                        label={{ value: 'kW/ton', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                      <ReferenceLine y={0.7} stroke="#f87171" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: '0.70', position: 'right', fill: '#f87171', fontSize: 10 }} />
                      <Line type="monotone" dataKey="value" name="Efficiency" stroke="#1A365D" strokeWidth={2} dot={efficiencySeries.length <= 30 ? { r: 3 } : false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Temperature Loop */}
            {temperatureLoopSeries && temperatureLoopSeries.length > 0 && (() => {
              // Compute tight Y-axis bounds with 2°C padding
              const allTemps = temperatureLoopSeries.flatMap(d => [
                d.chilledSupply, d.chilledReturn,
                d.condenserSupply, d.condenserReturn,
                ...(d.ambientTemp != null ? [d.ambientTemp] : []),
              ].filter(v => v > 0));
              const tempMin = Math.floor(Math.min(...allTemps) - 2);
              const tempMax = Math.ceil(Math.max(...allTemps) + 2);
              return (
                <div className="card-surface p-5">
                  <h4 className="mb-3 text-center text-sm font-semibold text-slate-900 dark:text-white">Temperature Loop</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={temperatureLoopSeries} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                        <XAxis
                          dataKey="label"
                          tick={tickStyle}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--grid-stroke)' }}
                          {...getXAxisProps(temperatureLoopSeries.length)}
                        />
                        <YAxis
                          tick={tickStyle}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--grid-stroke)' }}
                          width={44}
                          domain={[tempMin, tempMax]}
                          label={{ value: '°C', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                        />
                        <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                        <Legend
                          wrapperStyle={{ color: 'var(--muted-text)', fontSize: 10, paddingTop: 8 }}
                          iconSize={10}
                        />
                        <Line type="monotone" dataKey="chilledSupply" name="Chilled Supply" stroke="#1A365D" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="chilledReturn" name="Chilled Return" stroke="#1A365D" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                        <Line type="monotone" dataKey="ambientTemp" name="Ambient Temp" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                        <Line type="monotone" dataKey="condenserSupply" name="Cond. Supply" stroke="#FAB005" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="condenserReturn" name="Cond. Return" stroke="#FAB005" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Power Draw vs Cooling Output (full width, chiller only) */}
      {isChiller && powerCoolingSeries && powerCoolingSeries.length > 0 && (
        <div className="card-surface p-5">
          <h4 className="mb-3 text-center text-sm font-semibold text-slate-900 dark:text-white">Power Draw vs Cooling Output</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerCoolingSeries} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  {...getXAxisProps(powerCoolingSeries.length)}
                />
                <YAxis
                  yAxisId="left"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={56}
                  label={{ value: 'kW', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--grid-stroke)' }}
                  width={60}
                  label={{ value: 'Tons', angle: 90, position: 'insideRight', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                />
                <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                <Legend
                  wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }}
                  iconSize={12}
                />
                <Line yAxisId="left" type="monotone" dataKey="power" name="Power (kW)" stroke="#1A365D" strokeWidth={2} dot={powerCoolingSeries.length <= 30 ? { r: 3 } : false} />
                <Line yAxisId="right" type="monotone" dataKey="coolingTons" name="Cooling (Tons)" stroke="#82C91E" strokeWidth={2} dot={powerCoolingSeries.length <= 30 ? { r: 3 } : false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Cooling Tower: Temperature Graph ───────────────────── */}
      {isTower && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-center text-lg font-semibold text-slate-900 dark:text-white">Condenser Water Temperature</h3>
            <TimeResolutionSelector value={chartResolution} onChange={setChartResolution} />
          </div>

          {towerTempSeries.length > 0 ? (
            <div className="card-surface p-5">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={towerTempSeries} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis
                      dataKey="label"
                      tick={tickStyle}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--grid-stroke)' }}
                      {...getXAxisProps(towerTempSeries.length)}
                    />
                    <YAxis
                      tick={tickStyle}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--grid-stroke)' }}
                      width={44}
                      domain={['auto', 'auto']}
                      label={{ value: '°C', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                    />
                    <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                    <Legend
                      wrapperStyle={{ color: 'var(--muted-text)', fontSize: 10, paddingTop: 8 }}
                      iconSize={10}
                    />
                    <Line type="monotone" dataKey="condenserSupply" name="Cond. Supply" stroke="#FAB005" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="condenserReturn" name="Cond. Return" stroke="#FAB005" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                    {towerTempSeries.some(p => p.ambientTemp != null) && (
                      <Line type="monotone" dataKey="ambientTemp" name="Ambient Temp" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card-surface flex h-48 items-center justify-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No temperature data available</p>
            </div>
          )}
        </>
      )}

      {/* ── Pump: Flow Rate & Power Graph ──────────────────────── */}
      {isPump && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-center text-lg font-semibold text-slate-900 dark:text-white">Flow Rate & Power</h3>
            <TimeResolutionSelector value={chartResolution} onChange={setChartResolution} />
          </div>

          {pumpSeries.length > 0 ? (
            <div className="card-surface p-5">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pumpSeries} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-stroke)" />
                    <XAxis
                      dataKey="label"
                      tick={tickStyle}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--grid-stroke)' }}
                      {...getXAxisProps(pumpSeries.length)}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={tickStyle}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--grid-stroke)' }}
                      width={52}
                      label={{ value: 'm³/s', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={tickStyle}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--grid-stroke)' }}
                      width={52}
                      label={{ value: 'kW', angle: 90, position: 'insideRight', offset: 0, fill: 'var(--muted-text)', fontSize: 11 }}
                    />
                    <Tooltip contentStyle={tooltipStyles} labelStyle={{ color: 'var(--muted-text)' }} />
                    <Legend
                      wrapperStyle={{ color: 'var(--muted-text)', paddingTop: 8 }}
                      iconSize={12}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="flowRate" name="Flow Rate (m³/s)" stroke="#1A365D" strokeWidth={2} dot={pumpSeries.length <= 30 ? { r: 3 } : false} />
                    <Line yAxisId="right" type="monotone" dataKey="power" name="Power (kW)" stroke="#82C91E" strokeWidth={2} dot={pumpSeries.length <= 30 ? { r: 3 } : false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card-surface flex h-48 items-center justify-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No pump time series data available</p>
            </div>
          )}
        </>
      )}

      {/* ── Anomaly Panel (chiller only) ───────────────────────── */}
      {isChiller && (
        <AnomalyPanel
          data={anomalyData}
          title="Equipment Anomaly Detection"
          resolution={anomalyResolution}
          onResolutionChange={setAnomalyResolution}
        />
      )}
    </section>
  );
};

// ── Small KPI card component ────────────────────────────────────
const KpiCard: FC<{
  label: string;
  value: number;
  unit: string;
  sub?: string;
  accent?: string;
}> = ({ label, value, unit, sub, accent }) => (
  <div className="card-surface p-5">
    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-3 text-3xl font-semibold ${accent ?? 'text-slate-900 dark:text-white'}`}>
      {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
      <span className="ml-1 text-base font-normal text-slate-500">{unit}</span>
    </p>
    {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);

export default EquipmentPage;
