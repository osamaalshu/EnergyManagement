import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productionData } from '@/data/productionData';
import { suggestBatches } from '@/features/production-planning/batchingAdvisor';
import type { Econ, LineParam, Order, SkuParam } from '@/features/production-planning/productionModel';
import AnalyseHubPage from '@/pages/AnalyseHubPage/AnalyseHubPage';

const HORIZON_DAYS = 30;
const HOURS_PER_DAY = 16;

const noop = () => {};

const buildOrders = (skus: SkuParam[]): Order[] =>
  skus.map((sku, index) => ({
    id: `hub-o${index + 1}`,
    productId: sku.id,
    qty: Math.round((sku.demand * HORIZON_DAYS) / 365),
    dueDay: Math.max(2, Math.round(((index + 1) / skus.length) * HORIZON_DAYS)),
  }));

const planningInputs = () => {
  const { model } = productionData;
  const skus = model.skus as SkuParam[];
  const products = Object.fromEntries(skus.map((sku) => [sku.id, sku])) as Record<string, SkuParam>;
  const line: LineParam = {
    machineKw: model.line.machineKw,
    changeoverH: model.line.changeoverH,
    changeoverKw: model.line.changeoverKw,
    nMachines: 1,
    machineNames: ['MC01'],
  };
  const econ: Econ = model.economics;
  return { orders: buildOrders(skus), products, line, econ };
};

const fixed = (value: number, digits = 1) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (value: number, digits = 0) => `${fixed(value * 100, digits)}%`;
const num = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });

const renderHub = (onPlanner = noop) => render(<AnalyseHubPage onPlanner={onPlanner} onDelivery={noop} onScrap={noop} />);

afterEach(() => {
  cleanup();
});

describe('AnalyseHubPage weekly board', () => {
  it('renders four measured KPI tiles from trailing weekly data with MEASURED chips and window label', () => {
    renderHub();

    expect(screen.getByText('Last 4 weeks')).toBeInTheDocument();
    expect(screen.getByText('measured · last 4 weeks (2026-W16–2026-W19)')).toBeInTheDocument();

    const measuredKpis = screen.getByRole('region', { name: 'Measured weekly KPIs' });
    expect(within(measuredKpis).getAllByText('MEASURED')).toHaveLength(4);
    expect(within(measuredKpis).getByText('21')).toBeInTheDocument();
    expect(within(measuredKpis).getByText('3')).toBeInTheDocument();
    expect(within(measuredKpis).getByText('185.4 kg')).toBeInTheDocument();
    expect(within(measuredKpis).getByText('19.0%')).toBeInTheDocument();
  });

  it('sets the ignition tally accessible label from startups and cold-starts', () => {
    renderHub();

    expect(screen.getByLabelText('21 startups, 3 cold-starts')).toBeInTheDocument();
  });

  it('renders the top one-move suggestion with a SCENARIO chip or the empty state', () => {
    const inputs = planningInputs();
    const [suggestion] = suggestBatches(inputs.orders, inputs.products, inputs.line, inputs.econ, HOURS_PER_DAY);
    const onPlanner = vi.fn();

    renderHub(onPlanner);

    const oneMove = screen.getByRole('region', { name: 'The one move' });
    expect(within(oneMove).getByText('SCENARIO')).toBeInTheDocument();

    if (!suggestion) {
      expect(within(oneMove).getByText('No same-product orders small enough to batch this week.')).toBeInTheDocument();
      return;
    }

    expect(within(oneMove).getByText(new RegExp(`Batch ${suggestion.orderIds.length} ${suggestion.family} orders`))).toBeInTheDocument();
    expect(within(oneMove).getByText(new RegExp(`cut ${suggestion.startupsSaved} startups`))).toBeInTheDocument();
    expect(within(oneMove).getByText(new RegExp(`${num(suggestion.scrapSavedOmr, 1)} OMR`))).toBeInTheDocument();
    expect(within(oneMove).getByText(new RegExp(`OTIF ${pct(suggestion.otifBefore)}→${pct(suggestion.otifAfter)}`))).toBeInTheDocument();

    fireEvent.click(within(oneMove).getByRole('button', { name: 'Open in Planner →' }));
    expect(onPlanner).toHaveBeenCalledTimes(1);
  });

  it('keeps measured and scenario evidence tiers separated', () => {
    renderHub();

    const measuredTally = screen.getByRole('region', { name: 'Measured startup tally' });
    const measuredKpis = screen.getByRole('region', { name: 'Measured weekly KPIs' });
    const oneMove = screen.getByRole('region', { name: 'The one move' });

    expect(within(measuredTally).queryByText(/scenario/i)).not.toBeInTheDocument();
    expect(within(measuredKpis).queryByText(/scenario/i)).not.toBeInTheDocument();
    expect(within(oneMove).queryByText(/measured/i)).not.toBeInTheDocument();
  });
});
