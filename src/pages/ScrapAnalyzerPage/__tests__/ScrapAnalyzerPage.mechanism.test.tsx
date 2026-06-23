import { describe, expect, it } from 'vitest';
import React from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import ScrapAnalyzerPage from '../ScrapAnalyzerPage';

describe('ScrapAnalyzerPage mechanism sections', () => {
  it('renders measured mechanism headline, then reveals split, product-startup table, and estimate line in the drawer', () => {
    const { container } = render(<ScrapAnalyzerPage onBack={() => undefined} />);
    const view = within(container);

    expect(container.textContent).toMatch(/\d+% of scrap is startup-driven/);
    expect(container.textContent).toContain('association (run-episode classification), not proven cause; part of the small-run penalty is product/job mix, not startup alone.');
    expect(view.queryByText('Products that most generate startup-only runs')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('Batching-addressable pool');

    fireEvent.click(view.getByRole('button', { name: /Details & evidence/i }));

    expect(view.getByText('Where the scrap comes from (mechanism)')).toBeInTheDocument();
    expect(view.getAllByText('Product').length).toBeGreaterThan(0);
    expect(view.getByText('Total Startups')).toBeInTheDocument();
    expect(view.getByText('Cold Starts')).toBeInTheDocument();
    expect(view.getByText('Sub-economic Runs')).toBeInTheDocument();
    expect(view.getByText('Startup Scrap (kg)')).toBeInTheDocument();
    expect(container.textContent).toContain('Batching-addressable pool');
    expect(container.textContent).toContain('ESTIMATE');
  });
});
