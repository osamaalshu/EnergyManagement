import { describe, expect, it } from 'vitest';
import { startupKpis } from '../startupKpis';

describe('startupKpis loader mechanism fields', () => {
  it('keeps mechanism scrap equal to total summary scrap', () => {
    const mechanismTotal =
      startupKpis.mechanismScrap.coldStartKg +
      startupKpis.mechanismScrap.warmStartupKg +
      startupKpis.mechanismScrap.continuationKg;

    expect(mechanismTotal).toBe(startupKpis.summary.totalScrapKg);
  });

  it('loads product startup rows with required fields', () => {
    expect(startupKpis.productStartups.length).toBeGreaterThan(0);

    for (const row of startupKpis.productStartups) {
      expect(typeof row.product).toBe('string');
      expect(row.product.length).toBeGreaterThan(0);
      expect(typeof row.startups).toBe('number');
      expect(typeof row.coldStarts).toBe('number');
      expect(typeof row.subEconomicRuns).toBe('number');
      expect(typeof row.startupScrapKg).toBe('number');
    }
  });
});
