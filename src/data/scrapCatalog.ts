import raw from './generated/scrapCatalog.json';

// Real per-product scrap catalogue, aggregated from Extrusion Line 1 shift records
// (Machines 01 & 03 — the records can't be split by machine).
// `samples` = how many shift-records back the row (low → noisy, flag it).
// `scrapKgObs` = scrap actually recorded over the period (real, total — includes
// any startup/purge scrap; the records don't tag startup vs in-run separately).
export interface ScrapProduct {
  id: string; name: string; family: string; diameterMm: number;
  demand: number; kgPerUnit: number; meanRejection: number; rateEffective: number;
  samples: number; scrapKgObs: number;
  // Own best-demonstrated reject = this product's P25 across its own shift records
  // (achievable, because it has hit it). null when <5 records (too few to trust).
  bestRejectOwn: number | null;
}
export interface ScrapCatalog {
  meta: {
    facility: string; machine: string; source: string;
    periodStart: string; periodEnd: string; spanDays: number;
    annualiseFactor: number; products: number; overallRejectPct: number; note: string;
    changeoversObservedTotal: number; changeoversObservedFamily: number;
    changeoversObservedDiameter: number; changeoversPerYear: number;
  };
  products: ScrapProduct[];
}

export const scrapCatalog = raw as unknown as ScrapCatalog;
