import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardPage from '../DashboardPage';
import PortfolioPage from '../PortfolioPage';
import BuildingPage from '../BuildingPage';
import TariffPage from '../TariffPage';
import AnalyseHubPage from '../AnalyseHubPage';
import CompressorPage from '../CompressorPage';
import {
  portfolioMeta,
  portfolioNotifications,
  buildingDetails,
  tariffHourlyData,
  hourlyProductionConsumption,
} from '../../data/mockPortfolioData';
import { energyKpi } from '../../data/energyKpi';
import { compressorData } from '../../data/compressorData';
import { calculateMonthlyDetailedBills } from '../../lib/tariffEngine';

const noop = () => {};

function last24ConsumptionKwh(): number {
  if (!tariffHourlyData || tariffHourlyData.length === 0) {
    return hourlyProductionConsumption.slice(-24).reduce((s, d) => s + d.consumption, 0);
  }
  return Math.round(tariffHourlyData.slice(-24).reduce((s, d) => s + d.kwh, 0) * 100) / 100;
}

function formatKwh(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

describe('page smoke tests (real adapter data)', () => {
  it('DashboardPage renders without throwing and shows last-24h kWh', () => {
    const expectedKwh = last24ConsumptionKwh().toLocaleString();

    render(
      <DashboardPage
        onNavigateToPortfolio={noop}
        onNavigateToBuilding={noop}
        onNavigateToEquipment={noop}
        onNavigateToTariff={noop}
      />,
    );

    expect(screen.getByText(expectedKwh)).toBeInTheDocument();
    expect(screen.getByText(String(portfolioNotifications.length))).toBeInTheDocument();
  });

  it('PortfolioPage renders without throwing and shows portfolio score', () => {
    render(<PortfolioPage onNavigateToBuilding={noop} />);

    expect(screen.getAllByText(String(portfolioMeta.score)).length).toBeGreaterThan(0);
    expect(screen.getByText(`${portfolioMeta.savingsPotentialPercent}%`)).toBeInTheDocument();
  });

  it('BuildingPage renders without throwing and shows system kW/ton', () => {
    const detail = buildingDetails.CP1;
    expect(detail).toBeDefined();

    render(
      <BuildingPage
        buildingId="CP1"
        crumbs={[]}
        onBack={noop}
        onNavigateToSubsystem={noop}
        onNavigateToEquipment={noop}
      />,
    );

    expect(screen.getByText('System kW/ton')).toBeInTheDocument();
    expect(
      screen.getAllByText(String(detail!.aggregateKPIs.systemKwPerTon)).length,
    ).toBeGreaterThan(0);
  });

  it('TariffPage renders without throwing and shows total kWh KPI', () => {
    const bills = calculateMonthlyDetailedBills(tariffHourlyData, { voltageLevel: '11kV' });
    const totalKwh = bills.reduce((s, b) => s + b.kwhTotal, 0);
    const expectedKwh = formatKwh(totalKwh);

    render(<TariffPage onBack={noop} />);

    expect(screen.getByText('Total kWh')).toBeInTheDocument();
    expect(screen.getAllByText(expectedKwh).length).toBeGreaterThan(0);
  });

  it('AnalyseHubPage renders without throwing and shows energy intensity KPI', () => {
    render(<AnalyseHubPage onPlanner={noop} onDelivery={noop} onScrap={noop} />);

    expect(screen.getByText(`${energyKpi.summary.latestKwhPerKg} kWh/kg`)).toBeInTheDocument();
    expect(screen.getByText('What do I do today?')).toBeInTheDocument();
  });

  it('CompressorPage renders without throwing and shows polytropic efficiency KPI', () => {
    const { meta, kpis } = compressorData;

    render(<CompressorPage crumbs={[]} onBack={noop} />);

    expect(screen.getByText(`Compressor ${meta.compressorTag}`)).toBeInTheDocument();
    expect(screen.getAllByText(kpis.etaPoly!.toFixed(3)).length).toBeGreaterThan(0);
  });
});
