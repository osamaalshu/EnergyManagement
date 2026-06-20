import { describe, expect, it } from 'vitest';
import { startupKpis, type StartupKpis } from '../startupKpis';

describe('startupKpis loader', () => {
  it('returns a well-formed StartupKpis object', () => {
    const loaded: StartupKpis = startupKpis;

    expect(typeof loaded.summary.totalRuns).toBe('number');
    expect(typeof loaded.summary.startups).toBe('number');
    expect(typeof loaded.summary.coldStarts).toBe('number');
    expect(typeof loaded.summary.subEconomicRuns).toBe('number');
    expect(typeof loaded.summary.totalScrapKg).toBe('number');
    expect(loaded.weekly.length).toBeGreaterThan(0);
    expect(loaded.worstStartupRuns.length).toBeLessThanOrEqual(5);
  });

  it('keeps summary rates and scrap values in valid ranges', () => {
    expect(startupKpis.summary.subEconomicPct).toBeGreaterThanOrEqual(0);
    expect(startupKpis.summary.subEconomicPct).toBeLessThanOrEqual(1);
    expect(startupKpis.summary.scrapPerStartupKg).toBeGreaterThanOrEqual(0);
  });
});
