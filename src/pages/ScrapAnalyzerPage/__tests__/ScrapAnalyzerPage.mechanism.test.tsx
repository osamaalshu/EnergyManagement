import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScrapAnalyzerPage from '../ScrapAnalyzerPage';

describe('ScrapAnalyzerPage mechanism sections', () => {
  it('renders measured mechanism split, product-startup table, and estimate line', () => {
    const html = renderToStaticMarkup(<ScrapAnalyzerPage onBack={() => undefined} />);

    expect(html).toContain('Where the scrap comes from (mechanism)');
    expect(html).toMatch(/\d+% of scrap is startup-driven/);
    expect(html).toContain('association (run-episode classification), not proven cause; part of the small-run penalty is product/job mix, not startup alone.');
    expect(html).toContain('Product');
    expect(html).toContain('Total Startups');
    expect(html).toContain('Cold Starts');
    expect(html).toContain('Sub-economic Runs');
    expect(html).toContain('Startup Scrap (kg)');
    expect(html).toContain('Batching-addressable pool');
    expect(html).toContain('ESTIMATE');
  });
});
