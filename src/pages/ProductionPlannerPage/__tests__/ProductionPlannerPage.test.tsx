import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ProductionPlannerPage from '../ProductionPlannerPage';
import { productionData } from '@/data/productionData';

describe('ProductionPlannerPage', () => {
  it('renders the reset-heavy action card near the top and removes duplicate startup summaries', () => {
    const drainage = productionData.model.skus.find((sku) => sku.family === 'Drainage')!;
    const pressure = productionData.model.skus.find((sku) => sku.family === 'Pressure')!;
    const html = renderToStaticMarkup(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[
          { id: 'drain-urgent', productId: drainage.id, qty: 200, dueDay: 0.5, priority: true },
          { id: 'pressure-middle', productId: pressure.id, qty: 1000, dueDay: 30 },
          { id: 'drain-later', productId: drainage.id, qty: 200, dueDay: 7 },
        ]}
      />,
    );

    expect(html).toContain('This plan is reset-heavy.');
    expect(html.indexOf('This plan is reset-heavy.')).toBeLessThan(html.indexOf('Schedule — grouped by family'));
    expect(html).toContain('Estimated avoidable scrap:');
    expect(html).toContain('estimated');
    expect(html).toContain('sub-economic runs');
    expect(html).not.toContain('This plan creates');
    expect(html).not.toContain('This plan (estimated)');
  });

  it('renders Batching Advisor suggestions with preview apply, estimated chip, and override note', () => {
    const drainage = productionData.model.skus.find((sku) => sku.family === 'Drainage')!;
    const pressure = productionData.model.skus.find((sku) => sku.family === 'Pressure')!;
    const { container } = render(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[
          { id: 'drain-urgent', productId: drainage.id, qty: 200, dueDay: 0.5, priority: true },
          { id: 'pressure-middle', productId: pressure.id, qty: 1000, dueDay: 30 },
          { id: 'drain-later', productId: drainage.id, qty: 200, dueDay: 7 },
        ]}
      />,
    );

    expect(screen.getByText('Batching Advisor')).toBeInTheDocument();
    expect(container.textContent).toContain('estimated');
    expect(container.textContent).toContain('Batch 2 Drainage orders');
    expect(container.textContent).toContain('override');
    expect(container.textContent).not.toContain('This plan creates');

    fireEvent.click(screen.getByRole('button', { name: /Apply batch preview/i }));

    expect(container.textContent).not.toContain('This plan creates');
    expect(screen.getByRole('button', { name: /Revert batch preview/i })).toBeInTheDocument();
  });

  it('renders the Fragility column, badges, rules card, and estimate framing', () => {
    const drainage = productionData.model.skus.find((sku) => sku.family === 'Drainage')!;
    const pressure = productionData.model.skus.find((sku) => sku.family === 'Pressure')!;
    const { container } = render(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[
          { id: 'drain-urgent', productId: drainage.id, qty: 200, dueDay: 0.5, priority: true },
          { id: 'pressure-middle', productId: pressure.id, qty: 1000, dueDay: 30 },
          { id: 'drain-later', productId: drainage.id, qty: 200, dueDay: 7 },
        ]}
      />,
    );

    expect(screen.getAllByRole('columnheader', { name: 'Fragility' }).length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/\d+ (critical|high|moderate|low)/);
    expect(container.textContent).toContain('This plan is reset-heavy.');
    expect(container.textContent).toMatch(/Estimated avoidable scrap:\s*~\d+ OMR this month/);
    expect(container.textContent).toContain('DEFERRED');
    expect(container.textContent).toContain('Score uses planning data only');
    expect(container.textContent).toContain('ESTIMATE · confidence');
    expect(container.textContent).toContain('planning-stage risk estimate based on schedule and run-pattern factors, not live process data');
    expect(container.textContent).toContain('Best used structurally');
  });

  it('hides Prove content until Details drawer expansion and trims the run table', () => {
    const drainage = productionData.model.skus.find((sku) => sku.family === 'Drainage')!;
    const pressure = productionData.model.skus.find((sku) => sku.family === 'Pressure')!;
    const { container } = render(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[
          { id: 'drain-urgent', productId: drainage.id, qty: 200, dueDay: 0.5, priority: true },
          { id: 'pressure-middle', productId: pressure.id, qty: 1000, dueDay: 30 },
          { id: 'drain-later', productId: drainage.id, qty: 200, dueDay: 7 },
        ]}
      />,
    );
    const view = within(container);

    expect(view.queryByText('Startup Ledger')).not.toBeInTheDocument();
    expect(view.queryByText(/When will it finish/i)).not.toBeInTheDocument();
    expect(view.queryByRole('columnheader', { name: 'kWh/kg' })).not.toBeInTheDocument();
    expect(view.getAllByRole('columnheader', { name: 'Fragility' }).length).toBeGreaterThan(0);
    expect(view.getAllByRole('columnheader', { name: 'Scrap kg' }).length).toBeGreaterThan(0);
    expect(view.getAllByRole('columnheader', { name: 'Finish d' }).length).toBeGreaterThan(0);

    const drawer = view.getByRole('button', { name: /Details & evidence/i });
    expect(drawer).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(drawer);

    expect(drawer).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByText('Startup Ledger')).toBeInTheDocument();
    expect(view.getByText(/When will it finish/i)).toBeInTheDocument();
  });

  it('expands a Fragility badge into a worked example and collapses it again', () => {
    const drainage = productionData.model.skus.find((sku) => sku.family === 'Drainage')!;
    const pressure = productionData.model.skus.find((sku) => sku.family === 'Pressure')!;
    const { container } = render(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[
          { id: 'drain-urgent', productId: drainage.id, qty: 200, dueDay: 0.5, priority: true },
          { id: 'pressure-middle', productId: pressure.id, qty: 1000, dueDay: 30 },
          { id: 'drain-later', productId: drainage.id, qty: 200, dueDay: 7 },
        ]}
      />,
    );
    const view = within(container);

    expect(view.getAllByRole('columnheader', { name: 'Fragility' }).length).toBeGreaterThan(0);
    expect(view.queryByText(/Why this run scored/i)).not.toBeInTheDocument();

    const startupBadge = view.getAllByRole('button', { name: /\d+ (critical|high|moderate|low)/i }).find((button) =>
      button.getAttribute('title')?.includes('Family change'),
    );

    expect(startupBadge).toBeDefined();
    expect(startupBadge).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(startupBadge!);

    expect(startupBadge).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByText(/Why this run scored \d+ \((critical|high|moderate|low)\)/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/\+\d+\s*·\s*Family change/);
    expect(container.textContent).toContain('Group with same-family runs into one campaign');
    expect(container.textContent).toMatch(/This run's startup scrap ≈ \d+ kg ≈ \d+ OMR/);

    fireEvent.click(startupBadge!);

    expect(startupBadge).toHaveAttribute('aria-expanded', 'false');
    expect(view.queryByText(/Why this run scored/i)).not.toBeInTheDocument();
  });
});
