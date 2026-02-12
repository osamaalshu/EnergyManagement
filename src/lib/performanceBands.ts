import type { PerformanceBand } from '../types/portfolio';

/**
 * Centralized performance-band color map.
 * Reuse these colors everywhere: scatter plot dots, bar chart labels, badges, etc.
 */
export const BAND_COLORS: Record<PerformanceBand, string> = {
  Exceeded: '#34d399', // emerald-400 — better than sector
  Average:  '#facc15', // yellow-400  — within sector range
  Lower:    '#f87171', // red-400     — below sector average
} as const;

export const getBandColor = (band: PerformanceBand): string => BAND_COLORS[band];

/** Tailwind-friendly text color classes per band */
export const BAND_TEXT_CLASS: Record<PerformanceBand, string> = {
  Exceeded: 'text-emerald-400',
  Average:  'text-yellow-400',
  Lower:    'text-red-400',
};

/** Tailwind-friendly bg color classes per band (with opacity) */
export const BAND_BG_CLASS: Record<PerformanceBand, string> = {
  Exceeded: 'bg-emerald-400/20',
  Average:  'bg-yellow-400/20',
  Lower:    'bg-red-400/20',
};
