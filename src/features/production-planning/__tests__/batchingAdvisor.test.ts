import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyBatchSuggestion,
  suggestBatches,
  type BatchSuggestion,
} from '@/features/production-planning/batchingAdvisor';
import {
  MIN_ECONOMIC_RUN_KG,
  computeStartupLedger,
  scheduleOrders,
  type Econ,
  type LineParam,
  type Order,
  type SkuParam,
} from '@/features/production-planning/productionModel';

const products: Record<string, SkuParam> = {
  a: {
    id: 'a',
    name: 'Drainage 160',
    family: 'Drainage',
    diameterMm: 160,
    demand: 0,
    rateEffective: 10,
    kgPerUnit: 10,
    meanRejection: 0.02,
  },
  b: {
    id: 'b',
    name: 'Drainage 110',
    family: 'Drainage',
    diameterMm: 110,
    demand: 0,
    rateEffective: 10,
    kgPerUnit: 10,
    meanRejection: 0.02,
  },
};

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

const splitSameProductOrders: Order[] = [
  { id: 'a-priority', productId: 'a', qty: 100, dueDay: 1, priority: true },
  { id: 'b-middle', productId: 'b', qty: 100, dueDay: 30 },
  { id: 'a-later', productId: 'a', qty: 100, dueDay: 7 },
];

const suggestionsFor = (orders: Order[], opts?: Parameters<typeof suggestBatches>[5]): BatchSuggestion[] =>
  suggestBatches(orders, products, line, econ, 16, opts);

describe('suggestBatches', () => {
  it('suggests batching two sub-economic same-product orders within the due window', () => {
    const suggestions = suggestionsFor(splitSameProductOrders);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      productId: 'a',
      orderIds: ['a-priority', 'a-later'],
      startupsSaved: 1,
      scrapSavedKg: 10,
    });
    expect(suggestions[0].startupsSaved).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].scrapSavedKg).toBeGreaterThan(0);
    expect(suggestions[0].energySavedKwh).toBeUndefined();
  });

  it('prices saved startup scrap directly from the material OMR rate', () => {
    const [suggestion] = suggestionsFor(splitSameProductOrders);

    expect(suggestion.scrapSavedOmr).toBe(suggestion.scrapSavedKg * econ.materialOmrPerKg);
  });

  it('does not suggest same-product orders outside the due window', () => {
    const suggestions = suggestionsFor([
      { id: 'a-priority', productId: 'a', qty: 100, dueDay: 1, priority: true },
      { id: 'b-middle', productId: 'b', qty: 100, dueDay: 30 },
      { id: 'a-later', productId: 'a', qty: 100, dueDay: 20 },
    ]);

    expect(suggestions).toEqual([]);
  });

  it('does not suggest batching when every candidate order is already economic', () => {
    const economicQty = MIN_ECONOMIC_RUN_KG / products.a.kgPerUnit;
    const suggestions = suggestionsFor([
      { id: 'a-priority', productId: 'a', qty: economicQty, dueDay: 1, priority: true },
      { id: 'b-middle', productId: 'b', qty: economicQty, dueDay: 30 },
      { id: 'a-later', productId: 'a', qty: economicQty, dueDay: 7 },
    ]);

    expect(suggestions).toEqual([]);
  });

  it('uses the earliest merged due day and still returns infeasible override candidates', () => {
    const tightOrders: Order[] = [
      { id: 'a-priority', productId: 'a', qty: 100, dueDay: 0.5, priority: true },
      { id: 'b-middle', productId: 'b', qty: 100, dueDay: 30 },
      { id: 'a-later', productId: 'a', qty: 100, dueDay: 7 },
    ];
    const [suggestion] = suggestionsFor(tightOrders, { maxAddedLateDays: 0 });
    const merged = applyBatchSuggestion(tightOrders, suggestion).find((order) => order.id === 'batch:a');

    expect(merged?.dueDay).toBe(0.5);
    expect(suggestion.addedLateDays).toBeGreaterThan(0);
    expect(suggestion.feasible).toBe(false);
  });

  it('returns deterministic ranked suggestions for identical inputs', () => {
    expect(suggestionsFor(splitSameProductOrders)).toEqual(suggestionsFor(splitSameProductOrders));
  });

  it('reconciles startup savings with computeStartupLedger on the direct candidate schedule', () => {
    const [suggestion] = suggestionsFor(splitSameProductOrders);
    const base = scheduleOrders(splitSameProductOrders, products, 30, 1, line, econ, 16, 3, 0.5, 10, 'grouped');
    const candidateOrders = applyBatchSuggestion(splitSameProductOrders, suggestion);
    const candidate = scheduleOrders(candidateOrders, products, 30, 1, line, econ, 16, 3, 0.5, 10, 'grouped');
    const ledgerBase = computeStartupLedger(base, products, econ.materialOmrPerKg);
    const ledgerCandidate = computeStartupLedger(candidate, products, econ.materialOmrPerKg);

    expect(suggestion.startupsSaved).toBe(ledgerBase.startups - ledgerCandidate.startups);
  });

  it('does not use wall-clock time or random sources', () => {
    const source = readFileSync(new URL('../batchingAdvisor.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/Date\.now|Math\.random|\brandom\b/i);
  });
});
