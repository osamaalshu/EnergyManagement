import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, within } from '@testing-library/react';
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

  it('renders Decide content first and hides Prove content until Details drawer expansion', () => {
    const { container } = render(<ScrapAnalyzerPage onBack={() => undefined} />);
    const view = within(container);
    const text = container.textContent ?? '';

    expect(view.getByText('This week (measured)')).toBeInTheDocument();
    expect(view.getByText('Scrap / year')).toBeInTheDocument();
    expect(view.getByText(/\d+% of scrap is startup-driven/)).toBeInTheDocument();
    expect(view.getByText('Focus here first — biggest recoverable savings')).toBeInTheDocument();
    expect(text.indexOf('This week (measured)')).toBeLessThan(text.indexOf('Scrap / year'));
    expect(text.indexOf('Scrap / year')).toBeLessThan(text.indexOf('of scrap is startup-driven'));
    expect(text.indexOf('of scrap is startup-driven')).toBeLessThan(text.indexOf('Focus here first — biggest recoverable savings'));

    expect(view.queryByText('Products that most generate startup-only runs')).not.toBeInTheDocument();
    expect(view.queryByText('Energy intensity over time — kWh/kg by product')).not.toBeInTheDocument();

    const drawer = view.getByRole('button', { name: /Details & evidence/i });
    expect(drawer).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(drawer);

    expect(drawer).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByText('Products that most generate startup-only runs')).toBeInTheDocument();
    expect(view.getByText('Where the scrap comes from (mechanism)')).toBeInTheDocument();
    expect(view.getByText('Energy intensity over time — kWh/kg by product')).toBeInTheDocument();
  });
});
