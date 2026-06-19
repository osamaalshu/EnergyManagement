import { useMemo } from 'react';
import { energyKpi } from '../data/energyKpi';
import { productionData } from '../data/productionData';
import { scrapCatalog } from '../data/scrapCatalog';
import {
  scheduleOrders,
  monteCarloOrders,
  type Econ,
  type LineParam,
  type Order,
  type SkuParam,
} from '../lib/productionModel';
import ScenarioBanner from './ScenarioBanner';

const SCENARIO_BANNER_TEXT = 'Scenario — figures use a generated order book, not your live orders. Connect the order book to make this operational.';

interface AnalyseHubPageProps {
  onPlanner: () => void;
  onDelivery: () => void;
  onScrap: () => void;
}

const HORIZON_DAYS = 30;
const HOURS_PER_DAY = 16;
const MATERIAL_OMR_PER_KG = 0.32;

let uid = 0;
const buildOrders = (skus: SkuParam[]): Order[] =>
  skus.map((sku, index) => ({
    id: `hub-o${++uid}`,
    productId: sku.id,
    qty: Math.round((sku.demand * HORIZON_DAYS) / 365),
    dueDay: Math.max(2, Math.round(((index + 1) / skus.length) * HORIZON_DAYS)),
  }));

const num = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const energyTrendMax = Math.max(...energyKpi.months.map((month) => month.kwhPerKg));

const verdictClasses = (pct: number) => {
  if (pct >= 85) return 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10';
  if (pct >= 50) return 'border-amber-300/60 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10';
  return 'border-rose-300/60 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10';
};

const verdictTextClasses = (pct: number) => {
  if (pct >= 85) return 'text-emerald-700 dark:text-emerald-300';
  if (pct >= 50) return 'text-amber-700 dark:text-amber-300';
  return 'text-rose-700 dark:text-rose-300';
};

const AnalyseHubPage = ({ onPlanner, onDelivery, onScrap }: AnalyseHubPageProps) => {
  const deliveryDecision = useMemo(() => {
    const { model } = productionData;
    const skus = model.skus as SkuParam[];
    const products = Object.fromEntries(skus.map((sku) => [sku.id, sku])) as Record<string, SkuParam>;
    const orders = buildOrders(skus);
    const line: LineParam = {
      machineKw: model.line.machineKw,
      changeoverH: model.line.changeoverH,
      changeoverKw: model.line.changeoverKw,
      nMachines: 1,
      machineNames: ['MC01'],
    };
    const econ: Econ = model.economics;
    const schedule = scheduleOrders(orders, products, HORIZON_DAYS, 1, line, econ, HOURS_PER_DAY, 3, 0.5, 10, 'balanced');
    const mc = monteCarloOrders(schedule, HOURS_PER_DAY);
    return {
      percent: Math.round(mc.pAllOnTime * 100),
      onTime: schedule.onTime,
      total: schedule.total,
    };
  }, []);

  const scrapDecision = useMemo(() => {
    const rows = scrapCatalog.products.map((product) => {
      const scrapKg = product.demand * product.kgPerUnit * product.meanRejection;
      const scrapOmr = scrapKg * MATERIAL_OMR_PER_KG;
      return { ...product, scrapKg, scrapOmr };
    });
    const totalKg = rows.reduce((sum, row) => sum + row.scrapKg, 0);
    const totalOmr = rows.reduce((sum, row) => sum + row.scrapOmr, 0);
    const recoverable = rows
      .filter((row) => row.samples >= 5 && row.scrapKg >= totalKg * 0.02 && row.bestRejectOwn != null && row.meanRejection > row.bestRejectOwn)
      .reduce((sum, row) => sum + (row.meanRejection - row.bestRejectOwn!) * row.demand * row.kgPerUnit * MATERIAL_OMR_PER_KG, 0);
    return { totalOmr, recoverable };
  }, []);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Analyse</p>
        <h2 className="mt-1 text-3xl font-semibold text-primary dark:text-white">What do I do today?</h2>
      </div>

      <ScenarioBanner text={SCENARIO_BANNER_TEXT} />

      <div className="grid gap-5 lg:grid-cols-3">
        <article className={`rounded-2xl border p-5 ${verdictClasses(deliveryDecision.percent)}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${verdictTextClasses(deliveryDecision.percent)}`}>Will we ship on time?</p>
          <p className="mt-3 font-mono text-5xl font-semibold text-slate-900 dark:text-white">{deliveryDecision.percent}%</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {deliveryDecision.onTime} of {deliveryDecision.total} orders on time (scenario)
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onPlanner} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90">
              Open Planner
            </button>
            <button type="button" onClick={onDelivery} className="rounded-lg border border-slate-300/70 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent/60 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-white">
              Delivery view
            </button>
          </div>
        </article>

        <article className="card-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">Where am I losing money to scrap?</p>
          <p className="mt-3 font-mono text-5xl font-semibold text-slate-900 dark:text-white">{num(scrapDecision.totalOmr)} OMR</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">≈ {num(scrapDecision.recoverable)} OMR recoverable</p>
          <div className="mt-5">
            <button type="button" onClick={onScrap} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90">
              Open Scrap Focus
            </button>
          </div>
        </article>

        <article className="card-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">How efficient are we? — energy per kg</p>
          <p className="mt-3 font-mono text-5xl font-semibold text-slate-900 dark:text-white">{energyKpi.summary.latestKwhPerKg} kWh/kg</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            best month {energyKpi.summary.bestKwhPerKg} ({energyKpi.summary.bestYm}) · worst {energyKpi.summary.worstKwhPerKg} ({energyKpi.summary.worstYm})
          </p>
          <div className="mt-5 flex h-12 items-end gap-1.5" aria-label="Energy intensity trend">
            {energyKpi.months.map((month) => {
              const isBestMonth = month.ym === energyKpi.summary.bestYm;
              const height = `${Math.max(16, Math.round((month.kwhPerKg / energyTrendMax) * 100))}%`;
              return (
                <div
                  key={month.ym}
                  className={`w-full rounded-t-sm ${isBestMonth ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600'}`}
                  style={{ height }}
                  title={`${month.ym}: ${month.kwhPerKg} kWh/kg`}
                />
              );
            })}
          </div>
          <p className="mt-4 text-xs font-medium text-slate-600 dark:text-slate-300" title={energyKpi.meta.driver}>
            Electricity is ~fixed, so kWh/kg is a UTILIZATION metric — idle months spike it.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Factory bills (all loads) ÷ MC01 production — not yet sub-metered; trend & benchmark are the signal. Per-product kWh/kg needs machine sub-metering.
          </p>
        </article>
      </div>
    </section>
  );
};

export default AnalyseHubPage;
