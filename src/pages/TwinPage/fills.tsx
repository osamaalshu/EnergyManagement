import type { FC } from 'react';
import { COLOUR, patternId, type ColourKey } from '@/features/spatial-twin/paint';

/**
 * SVG pattern definitions for the provenance fills (see features/spatial-twin/paint.ts).
 * `unit` is the hatch spacing in user units, so a map in metres and a tree in
 * pixels each pass what reads well on their own scale.
 */
export const FillDefs: FC<{ prefix: string; unit: number }> = ({ prefix, unit }) => (
  <defs>
    {(['ok', 'attention', 'navy'] as ColourKey[]).map((c) => (
      <g key={c}>
        <pattern id={patternId(prefix, 'DERIVED', c)} patternUnits="userSpaceOnUse" width={unit} height={unit} patternTransform="rotate(45)">
          <rect width={unit} height={unit} fill={COLOUR[c]} fillOpacity={0.22} />
          <line x1="0" y1="0" x2="0" y2={unit} stroke={COLOUR[c]} strokeWidth={unit * 0.28} />
        </pattern>
        <pattern id={patternId(prefix, 'ESTIMATED', c)} patternUnits="userSpaceOnUse" width={unit} height={unit}>
          <rect width={unit} height={unit} fill={COLOUR[c]} fillOpacity={0.12} />
          <circle cx={unit / 2} cy={unit / 2} r={unit * 0.18} fill={COLOUR[c]} />
        </pattern>
        <pattern id={patternId(prefix, 'SIMULATED', c)} patternUnits="userSpaceOnUse" width={unit} height={unit}>
          <rect width={unit} height={unit} fill={COLOUR[c]} fillOpacity={0.14} />
          <line x1="0" y1="0" x2={unit} y2={unit} stroke={COLOUR[c]} strokeWidth={unit * 0.16} />
          <line x1={unit} y1="0" x2="0" y2={unit} stroke={COLOUR[c]} strokeWidth={unit * 0.16} />
        </pattern>
      </g>
    ))}
  </defs>
);
