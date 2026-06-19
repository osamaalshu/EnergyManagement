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
  // Diagnostic decomposition (the only within-product cause dimensions in the records):
  // shift-1 vs shift-2 reject (mass-basis; null if no production that shift), and the
  // month-by-month reject trend. No process settings exist in the data.
  shift1Reject: number | null;
  shift2Reject: number | null;
  monthly: { m: string; r: number }[];
  // PLACEHOLDER kWh/kg — illustrative only (nameplate power over real daily output),
  // NOT measured energy. Swap-ready: when sub-metering arrives, refill this field and
  // flip meta.kwhPerKgProvenance to 'measured'; the UI badge keys off that flag.
  kwhPerKgPlaceholder: number;
}
export interface ScrapCatalog {
  meta: {
    facility: string; machine: string; source: string;
    periodStart: string; periodEnd: string; spanDays: number;
    annualiseFactor: number; products: number; overallRejectPct: number; note: string;
    changeoversObservedTotal: number; changeoversObservedFamily: number;
    changeoversObservedDiameter: number; changeoversPerYear: number;
    kwhPerKgProvenance: 'PLACEHOLDER' | 'measured'; kwhPerKgNote: string;
  };
  products: ScrapProduct[];
}

export const scrapCatalog = raw as unknown as ScrapCatalog;
