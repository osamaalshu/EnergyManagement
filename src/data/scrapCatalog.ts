import raw from './generated/scrapCatalog.json';

// Real per-product scrap catalogue, aggregated from MC01 shift records.
// `samples` = how many shift-records back the row (low → noisy, flag it).
// `scrapKgObs` = scrap actually recorded over the period (real, total — includes
// any startup/purge scrap; the records don't tag startup vs in-run separately).
export interface ScrapProduct {
  id: string; name: string; family: string; diameterMm: number;
  demand: number; kgPerUnit: number; meanRejection: number; rateEffective: number;
  samples: number; scrapKgObs: number;
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
