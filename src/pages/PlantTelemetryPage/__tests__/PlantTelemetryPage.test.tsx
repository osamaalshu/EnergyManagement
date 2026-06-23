import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { productionData } from '@/data/productionData';
import { estimateCoolingEnergy } from '@/features/production-planning/coolingEnergy';
import PlantTelemetryPage from '../PlantTelemetryPage';

const num = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d });
const round = (v: number, d = 0) => {
  const factor = 10 ** d;
  return Math.round(v * factor) / factor;
};

describe('PlantTelemetryPage cooling energy placeholder', () => {
  it('renders the estimated cooling card, assumptions, swap note, and inclusive energy total', () => {
    const plant = productionData.plant!;
    const runHours = plant.real.hours_by_state.run;
    const cooling = estimateCoolingEnergy({ runHours });
    const inclCooling = round((plant.real.energy_kwh + cooling.coolingKwh) / plant.real.units, 3);

    const { container } = render(<PlantTelemetryPage onBack={() => undefined} />);
    const view = within(container);

    expect(screen.getByText('Cooling - estimated (placeholder)')).toBeInTheDocument();
    expect(screen.getByText('Energy/unit (incl. cooling, est.)')).toBeInTheDocument();
    expect(screen.getByText('ESTIMATED')).toBeInTheDocument();
    expect(screen.getByText('Q=flow*cp*dT -> /COP')).toBeInTheDocument();
    expect(container.textContent).toContain('flow 1.5 L/s');
    expect(container.textContent).toContain('dT 4C');
    expect(container.textContent).toContain('COP 3.0, air-cooled');
    expect(container.textContent).toContain('thermalKw');
    expect(container.textContent).toContain('coolingKw');
    expect(container.textContent).toContain('coolingKwh');
    expect(container.textContent).toContain('becomes measured from MC01 chilled-water supply/return + flow when sensors land');
    expect(container.textContent).toContain('COP calibrated with a temporary chiller-input meter');
    expect(container.textContent).toContain(`Energy/unit (incl. cooling, est.) = ${inclCooling} kWh/unit`);
    expect(container.textContent).toContain(`machine + cooling = ${num(plant.real.energy_kwh)} + ${num(cooling.coolingKwh)} kWh`);
    expect(container.textContent).toContain('Energy/unit (machine)');
    expect(container.textContent).toContain(`${plant.real.kwh_per_unit} kWh`);
    expect(view.queryByText('Power draw over the run')).not.toBeInTheDocument();
    expect(view.queryByText('Energy by machine state')).not.toBeInTheDocument();
    expect(view.queryByText('Validation — ideal vs realistic')).not.toBeInTheDocument();

    const drawer = view.getByRole('button', { name: /Details & evidence/i });
    expect(drawer).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(drawer);

    expect(drawer).toHaveAttribute('aria-expanded', 'true');
    expect(view.getByText('Power draw over the run')).toBeInTheDocument();
    expect(view.getByText('Energy by machine state')).toBeInTheDocument();
    expect(view.getByText('Validation — ideal vs realistic')).toBeInTheDocument();
  });
});
