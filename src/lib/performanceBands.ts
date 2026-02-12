import type { PerformanceBand } from '../types/portfolio';

/**
 * Centralized performance-band color map.
 * Reuse these colors everywhere: scatter plot dots, bar chart labels, badges, etc.
 */
export const BAND_COLORS: Record<PerformanceBand, string> = {
  Exceeded: '#82C91E', // brand green — better than sector
  Average:  '#FAB005', // brand amber — within sector range
  Lower:    '#f87171', // red-400     — below sector average
} as const;

export const getBandColor = (band: PerformanceBand): string => BAND_COLORS[band];

/** Tailwind-friendly text color classes per band */
export const BAND_TEXT_CLASS: Record<PerformanceBand, string> = {
  Exceeded: 'text-secondary',
  Average:  'text-accent',
  Lower:    'text-red-400',
};

/** Tailwind-friendly bg color classes per band (with opacity) */
export const BAND_BG_CLASS: Record<PerformanceBand, string> = {
  Exceeded: 'bg-secondary/20',
  Average:  'bg-accent/20',
  Lower:    'bg-red-400/20',
};
