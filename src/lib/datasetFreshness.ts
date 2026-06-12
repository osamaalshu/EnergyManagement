import type { DatasetMeta } from '../types/portfolio';

// How recent a `live` feed must be before it's considered stale.
export const LIVE_MAX_AGE_HOURS = 6;

/**
 * Derived, NOT stored: a dataset is "live" only if its mode says so AND its
 * latest reading is fresh. Keeping this a function (rather than an `isLive`
 * field) means the answer can never silently disagree with `mode`.
 */
export function isLiveDataset(meta: DatasetMeta): boolean {
  if (meta.mode !== 'live') return false;
  const t = Date.parse(meta.asOf);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= LIVE_MAX_AGE_HOURS * 3_600_000;
}
