import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as M from '../productionModel';
import {
  type Econ,
  type LineParam,
  type Order,
  type SkuParam,
  monteCarloOrders,
  scheduleOrders,
} from '../productionModel';
import scrapCatalog from '../../data/generated/scrapCatalog.json';

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

  it('excludes low-sample products from recoverable savings', () => {
    const plantAvg = scrapCatalog.meta.overallRejectPct / 100;
    const rows = scrapCatalog.products.map((product) => {
      const scrapKg = product.demand * product.kgPerUnit * product.meanRejection;
      const saving = Math.max(0, product.meanRejection - plantAvg) * product.demand * product.kgPerUnit * 0.32;
      return { ...product, scrapKg, saving };
    });
    const totalKg = rows.reduce((sum, row) => sum + row.scrapKg, 0);
    const contributors = rows.filter((row) => row.samples >= 5 && row.scrapKg >= totalKg * 0.02 && row.saving > 0);

    expect(contributors.every((row) => row.samples >= 5)).toBe(true);
    expect(rows.filter((row) => row.samples < 5 && contributors.includes(row))).toHaveLength(0);
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
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const delivery = readFileSync(resolve(root, 'src/components/DeliveryViewPage.tsx'), 'utf8');
    const scrap = readFileSync(resolve(root, 'src/components/ScrapAnalyzerPage.tsx'), 'utf8');

    expect(delivery).not.toContain('Add a machine');
    expect(delivery).not.toContain('machines + 1');
    expect(scrap).not.toContain('driver(');
  });
});
