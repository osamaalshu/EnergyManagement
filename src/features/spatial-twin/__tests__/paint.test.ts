import { describe, expect, it } from 'vitest';
import type { Provenance, Status } from '../model';
import { COLOUR, paintFor } from '../paint';

const provenances: Provenance[] = ['MEASURED', 'DERIVED', 'ESTIMATED', 'SIMULATED', 'UNAVAILABLE'];

describe('paintFor', () => {
  it('uses a solid fill for measured and patterns for derived, estimated, and simulated values', () => {
    expect(paintFor('test', 'ok', 'MEASURED', 'status').fill).toBe(COLOUR.ok);
    for (const provenance of ['DERIVED', 'ESTIMATED', 'SIMULATED'] as Provenance[]) {
      expect(paintFor('test', 'ok', provenance, 'status').fill).toMatch(/^url\(#.+\)$/);
    }
  });

  it('uses the empty paint for unavailable values and no-data status', () => {
    expect(paintFor('test', 'ok', 'UNAVAILABLE', 'status')).toEqual({ fill: 'var(--twin-empty)', stroke: 'var(--twin-outline)' });
    expect(paintFor('test', 'no_data', 'DERIVED', 'status')).toEqual({ fill: 'var(--twin-empty)', stroke: 'var(--twin-outline)' });
  });

  it('uses the navy colour key for certainty regardless of status', () => {
    for (const status of ['ok', 'attention', 'no_data'] as Status[]) {
      for (const provenance of ['MEASURED', 'DERIVED', 'ESTIMATED', 'SIMULATED'] as Provenance[]) {
        const paint = paintFor('test', status, provenance, 'certainty');
        if (provenance === 'MEASURED') expect(paint.fill, status).toBe(COLOUR.navy);
        else expect(paint.fill, `${status} ${provenance}`).toContain('-navy)');
        if (provenance === 'SIMULATED') expect(paint.stroke).toBe(COLOUR.navy);
      }
    }
  });

  it('only dashes simulated paint', () => {
    for (const provenance of provenances) {
      const paint = paintFor('test', 'ok', provenance, 'status');
      if (provenance === 'SIMULATED') expect(paint.strokeDasharray).toBe('3 2');
      else expect(paint.strokeDasharray).toBeUndefined();
    }
  });
});
