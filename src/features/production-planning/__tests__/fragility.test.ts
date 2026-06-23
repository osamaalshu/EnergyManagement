import { describe, expect, it } from 'vitest';
import { planRules, runFragility } from '@/features/production-planning/fragility';
import type { OrderItem, OrderSchedule } from '@/features/production-planning/productionModel';

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  orderId: 'o1',
  machine: 0,
  machineName: 'Machine 01',
  seq: 2,
  productId: 'p1',
  name: 'Drainage 110 mm',
  family: 'Drainage',
  diameterMm: 110,
  qty: 500,
  runKg: 3200,
  isSubEconomic: false,
  runtimeH: 10,
  setupBeforeH: 0,
  setupType: 'none',
  startH: 0,
  endH: 10,
  finishDay: 1,
  dueDay: 10,
  onTime: true,
  lateDays: 0,
  ...overrides,
});

const schedule = (overrides: Partial<OrderSchedule> = {}): OrderSchedule => {
  const items = overrides.items ?? [];
  return {
    mode: 'grouped',
    items,
    lanes: [{ machine: 0, name: 'Machine 01', items, loadH: 0 }],
    productionH: 0,
    changeoverH: 0,
    familyChanges: 0,
    diameterChanges: 0,
    makespanH: 0,
    makespanDays: 0,
    capacityPerMachineH: 160,
    utilization: 0,
    fits: true,
    steadyStatePct: 1,
    onTime: items.length,
    total: items.length,
    lateOrders: [],
    baseScrapKg: 0,
    startupScrapKg: 0,
    scrapKg: 0,
    scrapOmr: 0,
    ...overrides,
  };
};

describe('runFragility', () => {
  it('scores a steady continuation run as low with no action required', () => {
    const result = runFragility(item({ setupType: 'none', seq: 2, isSubEconomic: false }));

    expect(result.score).toBe(0);
    expect(result.band).toBe('low');
    expect(result.confidence).toBe('planning-only');
    expect(result.reasons[0].code).toBe('steady');
    expect(result.actions[0].code).toBe('none');
  });

  it('scores a family-change cold-start sub-economic run as critical with actions', () => {
    const result = runFragility(item({ setupType: 'family', seq: 1, isSubEconomic: true }));

    expect(result.score).toBe(90);
    expect(result.band).toBe('critical');
    expect(result.reasons).toHaveLength(3);
    expect(result.actions.map((action) => action.code)).toEqual(expect.arrayContaining([
      'campaign',
      'consolidate',
      'warm-start',
    ]));
  });

  it('scores a diameter-only mid-sequence run as low', () => {
    const result = runFragility(item({ setupType: 'diameter', seq: 2, isSubEconomic: false }));

    expect(result.score).toBe(20);
    expect(result.band).toBe('low');
  });

  it('never reports a score above 100', () => {
    const result = runFragility(item({ setupType: 'family', seq: 1, isSubEconomic: true }));

    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('planRules', () => {
  it('counts bands and reports actionable family-change and sub-economic violations', () => {
    const result = planRules(schedule({
      familyChanges: 2,
      diameterChanges: 1,
      items: [
        item({ orderId: 'critical', setupType: 'family', seq: 1, isSubEconomic: true }),
        item({ orderId: 'high', setupType: 'family', seq: 2, isSubEconomic: true }),
        item({ orderId: 'moderate', setupType: 'diameter', seq: 1, isSubEconomic: false }),
        item({ orderId: 'low', setupType: 'none', seq: 2, isSubEconomic: false }),
      ],
    }));

    expect(result.bandCounts).toEqual({ low: 1, moderate: 1, high: 1, critical: 1 });
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'family-change', count: 2, action: expect.any(String) }),
      expect.objectContaining({ kind: 'sub-economic', count: 2, action: expect.any(String) }),
    ]));
    expect(result.violations.find((v) => v.kind === 'family-change')?.action).not.toHaveLength(0);
    expect(result.violations.find((v) => v.kind === 'sub-economic')?.action).not.toHaveLength(0);
  });

  it('fires reset-heavy when resets per run exceed 40%', () => {
    const result = planRules(schedule({
      familyChanges: 1,
      diameterChanges: 2,
      items: [
        item({ orderId: 'one', setupType: 'none', seq: 2 }),
        item({ orderId: 'two', setupType: 'none', seq: 2 }),
        item({ orderId: 'three', setupType: 'none', seq: 2 }),
        item({ orderId: 'four', setupType: 'none', seq: 2 }),
        item({ orderId: 'five', setupType: 'none', seq: 2 }),
      ],
    }));

    expect((1 + 2) / 5).toBeGreaterThan(0.4);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'reset-heavy', count: 3 }),
    ]));
  });

  it('returns no violations for a clean low-risk schedule', () => {
    const result = planRules(schedule({
      items: [
        item({ orderId: 'steady-one', setupType: 'none', seq: 2, isSubEconomic: false }),
        item({ orderId: 'steady-two', setupType: 'none', seq: 3, isSubEconomic: false }),
      ],
    }));

    expect(result.bandCounts).toEqual({ low: 2, moderate: 0, high: 0, critical: 0 });
    expect(result.violations).toEqual([]);
  });
});
