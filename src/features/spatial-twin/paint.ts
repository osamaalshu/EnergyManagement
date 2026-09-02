// How a node is painted. Colour says status; the pattern says how sure we are.
// The pattern is never dropped, whichever overlay is on — that is the point.
//
//   MEASURED    solid
//   DERIVED     diagonal hatch          (worked out from a measurement elsewhere)
//   ESTIMATED   dots                    (a reference, not this plant)
//   SIMULATED   cross-hatch + dashes    (demo scenario)
//   UNAVAILABLE outline only

import type { Provenance, Status } from './model';

export type Overlay = 'status' | 'certainty';

export type ColourKey = 'ok' | 'attention' | 'navy';

export const COLOUR: Record<ColourKey, string> = {
  ok: 'var(--twin-ok)',
  attention: 'var(--twin-attention)',
  navy: 'var(--series-navy)',
};

const PATTERNED: Provenance[] = ['DERIVED', 'ESTIMATED', 'SIMULATED'];

export function patternId(prefix: string, prov: Provenance, colour: ColourKey): string {
  return `${prefix}-${prov.toLowerCase()}-${colour}`;
}

export interface Paint {
  fill: string;
  stroke: string;
  strokeDasharray?: string;
}

export function paintFor(prefix: string, status: Status, prov: Provenance, overlay: Overlay): Paint {
  const colour: ColourKey = overlay === 'certainty' ? 'navy' : status === 'attention' ? 'attention' : 'ok';
  if (prov === 'UNAVAILABLE' || (overlay === 'status' && status === 'no_data')) {
    return { fill: 'var(--twin-empty)', stroke: 'var(--twin-outline)' };
  }
  const stroke = prov === 'SIMULATED' ? COLOUR[colour] : 'var(--twin-outline)';
  const fill = PATTERNED.includes(prov) ? `url(#${patternId(prefix, prov, colour)})` : COLOUR[colour];
  return { fill, stroke, strokeDasharray: prov === 'SIMULATED' ? '3 2' : undefined };
}
