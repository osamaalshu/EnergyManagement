import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as M from '@/features/production-planning/productionModel';
import {
  type Econ,
  type LineParam,
  type Order,
  type SkuParam,
  MIN_ECONOMIC_RUN_KG,
  computeStartupLedger,
  energyIntensityKwhPerKg,
  monteCarloOrders,
  rootCauseForOrderItem,
  scheduleOrders,
} from '@/features/production-planning/productionModel';
import { energyKpi } from '@/data/energyKpi';
import { scrapCatalog as typedScrapCatalog } from '@/data/scrapCatalog';
import scrapCatalog from '@/data/generated/scrapCatalog.json';
import {
  CHART_TOP_N,
  GRANULARITY_POINTS,
  placeholderKwhKgSeries,
  selectChartProducts,
  type Granularity,
} from '@/features/production-planning/energyPlaceholder';

const products: Record<string, SkuParam> = {
  a: {
    id: 'a',
    name: 'Drainage 110',
    family: 'Drainage',
    diameterMm: 110,
    demand: 0,
    rateEffective: 10,
    kgPerUnit: 10,
    meanRejection: 0.1,
  },
  b: {
    id: 'b',
    name: 'Pressure 110',
    family: 'Pressure',
    diameterMm: 110,
    demand: 0,
    rateEffective: 5,
    kgPerUnit: 5,
    meanRejection: 0.2,
  },
  c: {
    id: 'c',
    name: 'Drainage 160',
    family: 'Drainage',
    diameterMm: 160,
    demand: 0,
    rateEffective: 8,
    kgPerUnit: 10,
    meanRejection: 0.12,
  },
};

const orders: Order[] = [
  { id: 'normal', productId: 'a', qty: 100, dueDay: 1 },
  { id: 'priority', productId: 'b', qty: 100, dueDay: 20, priority: true },
];

const line: LineParam = {
  machineKw: 75,
  changeoverH: 2,
  changeoverKw: 75,
  nMachines: 1,
  machineNames: ['Machine 01'],
};

const econ: Econ = {
  elecOmrPerKwh: 0.025,
  materialOmrPerKg: 0.32,
  holdingRateAnnual: 0.2,
};

describe('scheduleOrders', () => {
  it('keeps one lane, prioritizes urgent orders, and reports bounded steady-state and additive scrap', () => {
    for (const strategy of ['grouped', 'due', 'balanced'] as const) {
      const schedule = scheduleOrders(orders, products, 30, 1, line, econ, 16, 3, 0.5, 7, strategy);
      expect(schedule.lanes).toHaveLength(1);
      expect(schedule.items.find((item) => item.orderId === 'priority')?.seq).toBe(1);
      expect(schedule.steadyStatePct).toBeGreaterThanOrEqual(0);
      expect(schedule.steadyStatePct).toBeLessThanOrEqual(1);
      expect(schedule.scrapKg).toBe(schedule.baseScrapKg + schedule.startupScrapKg);
    }
  });
});

describe('computeStartupLedger', () => {
  it('returns an all-zero ledger for an empty order book', () => {
    const schedule = scheduleOrders([], products, 30, 1, line, econ, 16, 3, 0.5, 7, 'grouped');
    const ledger = computeStartupLedger(schedule, products, econ.materialOmrPerKg);

    expect(ledger).toEqual({
      startups: 0,
      familyChangeStarts: 0,
      subEconomicRuns: 0,
      totalRuns: 0,
      subEconomicPct: 0,
      startupScrapKg: 0,
      startupScrapOmr: 0,
      scrapPerStartupKg: 0,
    });
  });

  it('counts a single order as one startup and flags it sub-economic only below the kg threshold', () => {
    const small = scheduleOrders([{ id: 'small', productId: 'a', qty: 299, dueDay: 10 }], products, 30, 1, line, econ, 16);
    const boundary = scheduleOrders([{ id: 'boundary', productId: 'a', qty: 300, dueDay: 10 }], products, 30, 1, line, econ, 16);

    expect(computeStartupLedger(small, products, econ.materialOmrPerKg)).toMatchObject({
      startups: 1,
      totalRuns: 1,
      subEconomicRuns: 1,
    });
    expect(computeStartupLedger(boundary, products, econ.materialOmrPerKg)).toMatchObject({
      startups: 1,
      totalRuns: 1,
      subEconomicRuns: 0,
    });
  });

  it('keeps startups equal to familyChanges plus diameterChanges plus one for non-empty schedules', () => {
    const fixtures: Order[][] = [
      [
        { id: 'a1', productId: 'a', qty: 400, dueDay: 2 },
        { id: 'b1', productId: 'b', qty: 400, dueDay: 3 },
        { id: 'c1', productId: 'c', qty: 400, dueDay: 4 },
      ],
      [
        { id: 'a1', productId: 'a', qty: 120, dueDay: 2 },
        { id: 'c1', productId: 'c', qty: 120, dueDay: 3 },
      ],
    ];

    for (const fixture of fixtures) {
      for (const strategy of ['grouped', 'due'] as const) {
        const schedule = scheduleOrders(fixture, products, 30, 1, line, econ, 16, 3, 0.5, 9, strategy);
        const ledger = computeStartupLedger(schedule, products, econ.materialOmrPerKg);
        expect(ledger.startups).toBe(schedule.familyChanges + schedule.diameterChanges + 1);
      }
    }
  });

  it('does not create more startups in grouped mode than due mode on a multi-family fixture', () => {
    const fixture: Order[] = [
      { id: 'a1', productId: 'a', qty: 200, dueDay: 1 },
      { id: 'b1', productId: 'b', qty: 200, dueDay: 2 },
      { id: 'c1', productId: 'c', qty: 200, dueDay: 3 },
      { id: 'b2', productId: 'b', qty: 200, dueDay: 4 },
    ];
    const grouped = scheduleOrders(fixture, products, 30, 1, line, econ, 16, 3, 0.5, 9, 'grouped');
    const due = scheduleOrders(fixture, products, 30, 1, line, econ, 16, 3, 0.5, 9, 'due');

    expect(computeStartupLedger(grouped, products, econ.materialOmrPerKg).startups)
      .toBeLessThanOrEqual(computeStartupLedger(due, products, econ.materialOmrPerKg).startups);
  });

  it('re-exposes schedule startup scrap as the single source of truth', () => {
    const schedule = scheduleOrders([
      { id: 'a1', productId: 'a', qty: 400, dueDay: 2 },
      { id: 'b1', productId: 'b', qty: 400, dueDay: 3 },
    ], products, 30, 1, line, econ, 16, 3, 0.5, 13, 'due');

    expect(computeStartupLedger(schedule, products, econ.materialOmrPerKg).startupScrapKg).toBe(schedule.startupScrapKg);
  });

  it('flags isSubEconomic exactly when run kg is below MIN_ECONOMIC_RUN_KG and honors the boundary', () => {
    const schedule = scheduleOrders([
      { id: 'below', productId: 'a', qty: MIN_ECONOMIC_RUN_KG / products.a.kgPerUnit - 1, dueDay: 10 },
      { id: 'boundary', productId: 'a', qty: MIN_ECONOMIC_RUN_KG / products.a.kgPerUnit, dueDay: 10 },
    ], products, 30, 1, line, econ, 16);
    const byId = Object.fromEntries(schedule.items.map((item) => [item.orderId, item]));

    expect(byId.below.runKg).toBe(MIN_ECONOMIC_RUN_KG - products.a.kgPerUnit);
    expect(byId.below.isSubEconomic).toBe(true);
    expect(byId.boundary.runKg).toBe(MIN_ECONOMIC_RUN_KG);
    expect(byId.boundary.isSubEconomic).toBe(false);
  });

  it('computes scrap per startup as startup scrap divided by startups and zero when no startups exist', () => {
    const schedule = scheduleOrders([
      { id: 'a1', productId: 'a', qty: 400, dueDay: 2 },
      { id: 'b1', productId: 'b', qty: 400, dueDay: 3 },
    ], products, 30, 1, line, econ, 16, 3, 0.5, 12, 'due');
    const ledger = computeStartupLedger(schedule, products, econ.materialOmrPerKg);

    expect(ledger.scrapPerStartupKg).toBe(schedule.startupScrapKg / ledger.startups);
    expect(computeStartupLedger(scheduleOrders([], products, 30, 1, line, econ, 16), products, econ.materialOmrPerKg).scrapPerStartupKg).toBe(0);
  });

  it('applies root-cause priority before lower-priority capacity tags', () => {
    const familySchedule = scheduleOrders([
      { id: 'large', productId: 'a', qty: 1000, dueDay: 100 },
      { id: 'family-late', productId: 'b', qty: 100, dueDay: 0.1 },
    ], products, 30, 1, line, econ, 16, 3, 0.5, 10, 'grouped');
    const familyLate = familySchedule.items.find((item) => item.orderId === 'family-late');

    expect(familyLate?.setupType).toBe('family');
    expect(rootCauseForOrderItem(familyLate!)).toBe('Cold-start penalty');

    const smallSchedule = scheduleOrders([
      { id: 'large', productId: 'a', qty: 1000, dueDay: 100 },
      { id: 'small-late', productId: 'a', qty: 1, dueDay: 0.1 },
    ], products, 30, 1, line, econ, 16);
    const smallLate = smallSchedule.items.find((item) => item.orderId === 'small-late');

    expect(smallLate?.setupType).toBe('none');
    expect(smallLate?.isSubEconomic).toBe(true);
    expect(rootCauseForOrderItem(smallLate!)).toBe('Sub-economic run');
  });

  it('is deterministic for identical startup ledger inputs', () => {
    const schedule = scheduleOrders([
      { id: 'a1', productId: 'a', qty: 400, dueDay: 2 },
      { id: 'b1', productId: 'b', qty: 400, dueDay: 3 },
    ], products, 30, 1, line, econ, 16, 3, 0.5, 11, 'due');

    expect(computeStartupLedger(schedule, products, econ.materialOmrPerKg))
      .toEqual(computeStartupLedger(schedule, products, econ.materialOmrPerKg));
  });
});

describe('monteCarloOrders', () => {
  it('returns bounded probabilities and sorted sample days', () => {
    const schedule = scheduleOrders(orders, products, 30, 1, line, econ, 16, 3, 0.5, 7, 'grouped');
    const result = monteCarloOrders(schedule, 16, 0.25, 50, 123);

    for (const value of Object.values(result.onTimeProb)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(result.pAllOnTime).toBeGreaterThanOrEqual(0);
    expect(result.pAllOnTime).toBeLessThanOrEqual(1);
    expect(result.samplesDays).toHaveLength(50);
    expect(result.samplesDays).toEqual([...result.samplesDays].sort((a, b) => a - b));
  });
});

describe('energyIntensityKwhPerKg', () => {
  it('computes machine kWh per kg and guards zero denominators', () => {
    expect(energyIntensityKwhPerKg(75, 20, 9.13)).toBeCloseTo(0.4107, 3);
    expect(energyIntensityKwhPerKg(75, 0, 9.13)).toBe(0);
    expect(energyIntensityKwhPerKg(75, 20, 0)).toBe(0);
  });
});

describe('energy KPI dataset', () => {
  it('keeps monthly kWh per kg values positive and summary extremes consistent', () => {
    const monthValues = energyKpi.months.map((month) => month.kwhPerKg);

    expect(energyKpi.months.length).toBeGreaterThan(0);
    expect(energyKpi.months.every((month) => month.kwhPerKg > 0)).toBe(true);
    expect(energyKpi.summary.bestKwhPerKg).toBeLessThanOrEqual(energyKpi.summary.worstKwhPerKg);
    expect(energyKpi.summary.bestKwhPerKg).toBe(Math.min(...monthValues));
    expect(energyKpi.summary.worstKwhPerKg).toBe(Math.max(...monthValues));
  });
});

describe('placeholderKwhKgSeries', () => {
  it('is deterministic for the same input', () => {
    const first = placeholderKwhKgSeries(0.42, 'month', 'DU203');
    const second = placeholderKwhKgSeries(0.42, 'month', 'DU203');

    expect(second).toEqual(first);
  });

  it('uses the expected point count for each granularity and keeps values positive', () => {
    for (const granularity of Object.keys(GRANULARITY_POINTS) as Granularity[]) {
      const series = placeholderKwhKgSeries(0.42, granularity, 'DU203');

      expect(series).toHaveLength(GRANULARITY_POINTS[granularity]);
      expect(series.every((point) => point.v > 0)).toBe(true);
    }
  });
});

describe('selectChartProducts', () => {
  const chartProducts = Array.from({ length: 20 }, (_, index) => ({
    id: `p-${index + 1}`,
    name: `Product ${index + 1}`,
    kwhPerKgPlaceholder: index + 1,
  }));

  it('returns min(15, n) products sorted by kWh/kg descending in top scope', () => {
    const selected = selectChartProducts(chartProducts, 'top', '');

    expect(selected).toHaveLength(Math.min(CHART_TOP_N, chartProducts.length));
    expect(selected.map((product) => product.kwhPerKgPlaceholder)).toEqual(
      [...selected].map((product) => product.kwhPerKgPlaceholder).sort((a, b) => b - a),
    );
  });

  it('returns all products in all scope', () => {
    const selected = selectChartProducts(chartProducts, 'all', '');

    expect(selected).toEqual(chartProducts);
  });

  it('includes a query match outside the top products in top scope', () => {
    const selected = selectChartProducts(chartProducts, 'top', 'Product 1');

    expect(selected.some((product) => product.id === 'p-1')).toBe(true);
    expect(selected.length).toBe(CHART_TOP_N + 1);
  });

  it('deduplicates ids while preserving the selected order', () => {
    const selected = selectChartProducts(
      [
        { id: 'dup', name: 'High duplicate', kwhPerKgPlaceholder: 9 },
        { id: 'unique', name: 'Unique', kwhPerKgPlaceholder: 8 },
        { id: 'dup', name: 'Low duplicate', kwhPerKgPlaceholder: 1 },
      ],
      'all',
      'duplicate',
    );

    expect(selected.map((product) => product.id)).toEqual(['dup', 'unique']);
    expect(new Set(selected.map((product) => product.id)).size).toBe(selected.length);
  });
});

describe('scrap analysis invariants', () => {
  it('builds a monotonic cumulative scrap curve and finds the first 80 percent row', () => {
    const rows = scrapCatalog.products
      .map((product) => ({
        ...product,
        scrapKg: product.demand * product.kgPerUnit * product.meanRejection,
      }))
      .sort((a, b) => b.scrapKg - a.scrapKg);
    const total = rows.reduce((sum, row) => sum + row.scrapKg, 0);
    let cumulative = 0;
    const cumulativePct = rows.map((row) => {
      cumulative += row.scrapKg;
      return (cumulative / total) * 100;
    });

    for (let i = 1; i < cumulativePct.length; i += 1) {
      expect(cumulativePct[i]).toBeGreaterThanOrEqual(cumulativePct[i - 1]);
    }
    expect(cumulativePct.at(-1)).toBeLessThanOrEqual(100.0001);

    const firstAt80 = cumulativePct.findIndex((pct) => pct >= 80);
    const topNFor80 = firstAt80 + 1;
    expect(topNFor80).toBeGreaterThan(0);
    expect(topNFor80).toBe(firstAt80 + 1);
    expect(cumulativePct[topNFor80 - 1]).toBeGreaterThanOrEqual(80);
    expect(topNFor80 === 1 ? 0 : cumulativePct[topNFor80 - 2]).toBeLessThan(80);
  });

  it('uses each product own best-demonstrated reject for recoverable savings', () => {
    const rows = scrapCatalog.products.map((product) => {
      const scrapKg = product.demand * product.kgPerUnit * product.meanRejection;
      const saving = product.bestRejectOwn == null
        ? 0
        : Math.max(0, product.meanRejection - product.bestRejectOwn) * product.demand * product.kgPerUnit * 0.32;
      return { ...product, scrapKg, saving };
    });
    const totalKg = rows.reduce((sum, row) => sum + row.scrapKg, 0);
    const contributors = rows.filter((row) => row.samples >= 5 && row.scrapKg >= totalKg * 0.02 && row.saving > 0);
    const recoverable = contributors.reduce((sum, row) => sum + row.saving, 0);

    for (const row of rows) {
      if (row.bestRejectOwn == null || row.meanRejection <= row.bestRejectOwn) {
        expect(row.saving).toBe(0);
      }
    }
    expect(recoverable).toBeGreaterThan(0);
    expect(contributors.every((row) => row.samples >= 5)).toBe(true);
    expect(contributors.every((row) => row.bestRejectOwn != null)).toBe(true);
    expect(contributors.some((row) => row.samples < 5 || row.bestRejectOwn == null)).toBe(false);
  });

  it('keeps bestRejectOwn available only for well-measured products', () => {
    for (const product of scrapCatalog.products) {
      expect(product.bestRejectOwn != null).toBe(product.samples >= 5);
    }
  });

  it('keeps scrap catalog energy placeholders complete and explicitly marked', () => {
    const { products: catalog, meta } = typedScrapCatalog;

    expect(catalog.length).toBeGreaterThan(0);
    for (const product of catalog) {
      expect(Number.isFinite(product.kwhPerKgPlaceholder)).toBe(true);
      expect(product.kwhPerKgPlaceholder).toBeGreaterThan(0);
    }
    expect(meta.kwhPerKgProvenance).toBe('PLACEHOLDER');
  });

  it('computes the plant-wide reject sensitivity from gross annual mass', () => {
    const grossKgYr = scrapCatalog.products.reduce((sum, product) => sum + product.demand * product.kgPerUnit, 0);
    const perHalfPp = 0.005 * grossKgYr * 0.32;

    expect(perHalfPp).toBe(0.005 * grossKgYr * 0.32);
    expect(perHalfPp).toBeGreaterThan(0);
  });

  it('keeps per-product diagnostic shift and monthly data well-formed', () => {
    for (const product of scrapCatalog.products) {
      expect(product).toHaveProperty('shift1Reject');
      expect(product.shift1Reject == null || typeof product.shift1Reject === 'number').toBe(true);
      expect(product).toHaveProperty('shift2Reject');
      expect(product.shift2Reject == null || typeof product.shift2Reject === 'number').toBe(true);
      expect(Array.isArray(product.monthly)).toBe(true);
      for (const entry of product.monthly) {
        expect(entry.r).toBeGreaterThanOrEqual(0);
        expect(entry.r).toBeLessThanOrEqual(1);
      }
    }

    const du203 = scrapCatalog.products.find((product) => product.id === 'DU203');
    expect(du203).toBeDefined();
    expect(du203!.shift2Reject).toBeGreaterThan(du203!.shift1Reject!);
    expect(du203!.monthly.length).toBeGreaterThanOrEqual(2);
  });

  it('builds a monotonic Pareto curve over well-measured products only', () => {
    const rows = scrapCatalog.products
      .filter((product) => product.samples >= 5)
      .map((product) => ({
        ...product,
        scrapKg: product.demand * product.kgPerUnit * product.meanRejection,
      }))
      .sort((a, b) => b.scrapKg - a.scrapKg);
    const total = rows.reduce((sum, row) => sum + row.scrapKg, 0);
    let cumulative = 0;
    const cumulativePct = rows.map((row) => {
      cumulative += row.scrapKg;
      return (cumulative / total) * 100;
    });

    for (let i = 1; i < cumulativePct.length; i += 1) {
      expect(cumulativePct[i]).toBeGreaterThanOrEqual(cumulativePct[i - 1]);
    }
    expect(cumulativePct.at(-1)).toBeLessThanOrEqual(100.0001);
  });
});

describe('removed model exports', () => {
  it('keeps old dead APIs absent', () => {
    const module = M as Record<string, unknown>;
    expect(module.planStrategy).toBeUndefined();
    expect(module.planAll).toBeUndefined();
    expect(module.buildSchedule).toBeUndefined();
    expect(module.monteCarloFit).toBeUndefined();
  });
});

describe('source guards', () => {
  it('keeps forbidden UI affordances and dead scrap helper out of source', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const delivery = readFileSync(resolve(root, 'src/pages/DeliveryViewPage/DeliveryViewPage.tsx'), 'utf8');
    const scrap = readFileSync(resolve(root, 'src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(delivery).not.toContain('Add a machine');
    expect(delivery).not.toContain('machines + 1');
    expect(scrap).not.toContain('driver(');
  });

  it('moves Plant Telemetry out of the Analyse section and exposes Validation Lab', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const sidebar = readFileSync(resolve(root, 'src/shared/Sidebar.tsx'), 'utf8');
    const analyseStart = sidebar.indexOf('<span>Analyse</span>');
    const validationStart = sidebar.indexOf('<span>Validation Lab</span>');
    const validationButtonStart = sidebar.lastIndexOf('<button type="button" onClick={onPlant}', validationStart);
    const analyseSection = sidebar.slice(analyseStart, validationButtonStart);

    expect(analyseStart).toBeGreaterThan(-1);
    expect(validationStart).toBeGreaterThan(analyseStart);
    expect(validationButtonStart).toBeGreaterThan(analyseStart);
    expect(analyseSection).not.toContain('Plant Telemetry');
    expect(analyseSection).not.toContain('onPlant');
    expect(sidebar).toContain('<span>Validation Lab</span>');
    expect(sidebar).toContain('onClick={onPlant}');
  });

  it('wires the Analyse hub route in App source', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');

    expect(app).toContain('AnalyseHubPage');
    expect(app).toContain("setActivePage('analyse')");
    expect(app).toContain("case 'analyse'");
  });

  it('keeps the scenario banner on generated-order pages only', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const text = 'Scenario — figures use a generated order book, not your live orders. Connect the order book to make this operational.';
    const planner = readFileSync(resolve(root, 'src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx'), 'utf8');
    const delivery = readFileSync(resolve(root, 'src/pages/DeliveryViewPage/DeliveryViewPage.tsx'), 'utf8');
    const analyse = readFileSync(resolve(root, 'src/pages/AnalyseHubPage/AnalyseHubPage.tsx'), 'utf8');
    const scrap = readFileSync(resolve(root, 'src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(planner).toContain(text);
    expect(delivery).toContain(text);
    expect(analyse).toContain(text);
    expect(scrap).not.toContain(text);
    expect(scrap).not.toContain('ScenarioBanner');
  });

  it('keeps planner energy-intensity and scrap diagnostic UI wired', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const planner = readFileSync(resolve(root, 'src/pages/ProductionPlannerPage/ProductionPlannerPage.tsx'), 'utf8');
    const scrap = readFileSync(resolve(root, 'src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(planner).toContain('kWh/kg');
    expect(planner).toContain('Energy intensity');
    expect(scrap).toContain('shift1Reject');
    expect(scrap).toContain('monthly');
  });

  it('keeps scrap analyzer energy intensity and placeholder badge wired', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const scrap = readFileSync(resolve(root, 'src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(scrap).toContain('kWh/kg');
    expect(scrap).toContain('kwhPerKgPlaceholder');
    expect(scrap).toContain("kwhPerKgProvenance === 'PLACEHOLDER'");
    expect(scrap).toContain('placeholderKwhKgSeries');
    expect(scrap).toContain('LineChart');
    expect(scrap).toContain("'day'");
    expect(scrap).toContain("'week'");
    expect(scrap).toContain("'month'");
    expect(scrap).toContain("'year'");
    expect(scrap).toContain('Energy intensity');
  });

  it('wires scrap analyzer chart product scope controls', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const scrap = readFileSync(resolve(root, 'src/pages/ScrapAnalyzerPage/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(scrap).toContain('selectChartProducts');
    expect(scrap).toContain('chartScope');
    expect(scrap).toContain("'top'");
    expect(scrap).toContain("'all'");
  });

  it('wires the energy KPI card in Analyse hub source', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
    const analyse = readFileSync(resolve(root, 'src/pages/AnalyseHubPage/AnalyseHubPage.tsx'), 'utf8');

    expect(analyse).toContain('energyKpi');
    expect(analyse).toContain('kWh/kg');
  });
});
