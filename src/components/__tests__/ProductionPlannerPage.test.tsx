import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductionPlannerPage from '../ProductionPlannerPage';
import { productionData } from '../../data/productionData';

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
});
