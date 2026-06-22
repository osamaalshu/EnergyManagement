import { describe, expect, it } from 'vitest';
import { estimateCoolingEnergy } from '../coolingEnergy';

describe('estimateCoolingEnergy', () => {
  it('estimates cooling energy from default placeholder assumptions', () => {
    const thermalKw = 1.5 * 4.18 * 4;
    const coolingKw = thermalKw / 3.0;

    expect(estimateCoolingEnergy({ runHours: 100 })).toEqual({
      thermalKw,
      coolingKw,
      coolingKwh: coolingKw * 100,
    });
  });

  it('applies cooling input overrides', () => {
    const estimate = estimateCoolingEnergy({
      runHours: 12,
      flowLps: 2,
      deltaTC: 5,
      cop: 4,
      cpKjKgK: 4.2,
    });
    const thermalKw = 2 * 4.2 * 5;
    const coolingKw = thermalKw / 4;

    expect(estimate).toEqual({
      thermalKw,
      coolingKw,
      coolingKwh: coolingKw * 12,
    });
  });

  it('guards zero COP to avoid dividing by zero', () => {
    expect(estimateCoolingEnergy({ runHours: 100, cop: 0 })).toEqual({
      thermalKw: 1.5 * 4.18 * 4,
      coolingKw: 0,
      coolingKwh: 0,
    });
  });
});
