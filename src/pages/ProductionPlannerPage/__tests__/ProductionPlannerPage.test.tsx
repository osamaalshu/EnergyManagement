import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductionPlannerPage from '../ProductionPlannerPage';
import { productionData } from '@/data/productionData';

describe('ProductionPlannerPage', () => {
  it('renders startup-first estimated verdict and a sub-economic run flag', () => {
    const productId = productionData.model.skus[0].id;
    const html = renderToStaticMarkup(
      <ProductionPlannerPage
        onBack={() => undefined}
        initialOrders={[{ id: 'sub-economic-order', productId, qty: 1, dueDay: 30 }]}
      />,
    );

    expect(html).toContain('This plan creates');
    expect(html).toContain('1</span> startups');
    expect(html).toContain('estimated');
    expect(html).toContain('sub-economic?');
    expect(html).toContain('exception');
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
    expect(container.textContent).toMatch(/This plan creates\s*3\s*startups/);

    fireEvent.click(screen.getByRole('button', { name: /Apply batch preview/i }));

    expect(container.textContent).toMatch(/This plan creates\s*2\s*startups/);
    expect(screen.getByRole('button', { name: /Revert batch preview/i })).toBeInTheDocument();
  });
});
