import { render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Cooling - estimated (placeholder)')).toBeInTheDocument();
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
  });
});
