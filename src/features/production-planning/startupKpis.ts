import startupKpisJson from '../../data/startupKpis.json';

export interface StartupKpis {
  meta: {
    generated: string;
    window: [string, string];
    minEconomicRunKg: number;
    coldStartGapDays: number;
    materialOmrPerKg: number;
    provenance: string;
    source: string;
  };
  summary: {
    totalRuns: number;
    startups: number;
    coldStarts: number;
    subEconomicRuns: number;
    subEconomicPct: number;
    scrapPerStartupKg: number;
    totalScrapKg: number;
    totalScrapOmr: number;
  };
  mechanismScrap: {
    coldStartKg: number;
    coldStartOmr: number;
    warmStartupKg: number;
    warmStartupOmr: number;
    continuationKg: number;
    continuationOmr: number;
  };
  productStartups: Array<{
    product: string;
    startups: number;
    coldStarts: number;
    subEconomicRuns: number;
    startupScrapKg: number;
  }>;
  weekly: {
    week: string;
    startups: number;
    coldStarts: number;
    subEconomicRuns: number;
    subEconomicPct: number;
    scrapPerStartupKg: number;
    totalScrapKg: number;
  }[];
  worstStartupRuns: {
    product: string;
    startDate: string;
    runKg: number;
    scrapKg: number;
    coldStart: boolean;
  }[];
}

export const startupKpis = startupKpisJson as StartupKpis;
