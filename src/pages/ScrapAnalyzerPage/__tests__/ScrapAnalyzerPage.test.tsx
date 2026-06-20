import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScrapAnalyzerPage from '../ScrapAnalyzerPage';
import { startupKpis } from '@/features/production-planning/startupKpis';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

describe('ScrapAnalyzerPage', () => {
  it('renders measured startup KPIs, floor-walk runs, and real cold-start badges', () => {
    const html = renderToStaticMarkup(<ScrapAnalyzerPage onBack={() => undefined} />);
    const measuredPanel = html.slice(
      html.indexOf('This week (measured)'),
      html.indexOf('This period&#x27;s 5 worst startup-only runs'),
    );

    expect(measuredPanel).toContain('MEASURED');
    expect(measuredPanel).not.toContain('estimated');
    expect(measuredPanel).not.toContain('proxy');
    expect(measuredPanel).toContain('startups');
    expect(measuredPanel).toContain('cold-starts');
    expect(measuredPanel).toContain('sub-economic runs');
    expect(measuredPanel).toContain('scrap per startup');
    expect(measuredPanel).toContain('Weekly startup trend');
    expect(measuredPanel).toContain(startupKpis.meta.provenance);
    expect(measuredPanel).toContain(startupKpis.meta.source);

    for (const run of startupKpis.worstStartupRuns) {
      expect(html).toContain(escapeHtml(run.product));
    }
    expect(html).toContain('cold-start');
  });
});
