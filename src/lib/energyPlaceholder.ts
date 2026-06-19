export type Granularity = 'day' | 'week' | 'month' | 'year';
export type ChartScope = 'top' | 'all';

export const CHART_TOP_N = 15;

export const GRANULARITY_POINTS: Record<Granularity, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 3,
};

const labelPrefix: Record<Granularity, string> = {
  day: 'D',
  week: 'W',
  month: 'M',
  year: 'Y',
};

function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;
  return (h >>> 0) / 4294967296;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function selectChartProducts<T extends { id: string; name: string; kwhPerKgPlaceholder: number }>(
  products: T[],
  scope: ChartScope,
  query: string,
): T[] {
  const base = scope === 'all'
    ? [...products]
    : [...products].sort((a, b) => b.kwhPerKgPlaceholder - a.kwhPerKgPlaceholder).slice(0, CHART_TOP_N);
  const q = query.trim().toLowerCase();
  if (q) {
    for (const product of products) {
      if (product.name.toLowerCase().includes(q) && !base.some((baseProduct) => baseProduct.id === product.id)) {
        base.push(product);
      }
    }
  }

  const seen = new Set<string>();
  return base.filter((product) => (seen.has(product.id) ? false : (seen.add(product.id), true)));
}

// Deterministic illustrative kWh/kg series. This is not measured energy data.
export function placeholderKwhKgSeries(base: number, granularity: Granularity, seedKey: string): { t: string; v: number }[] {
  const n = GRANULARITY_POINTS[granularity];
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0.05;

  return Array.from({ length: n }, (_, i) => {
    const rand = hashToUnit(`${seedKey}:${granularity}:${i}`);
    return {
      t: `${labelPrefix[granularity]}${i + 1}`,
      v: Math.max(0.05, round(safeBase * (0.8 + 0.4 * rand), 2)),
    };
  });
}
