/**
 * mockPortfolioData.ts
 *
 * Re-exports from realPortfolioData.ts which uses actual preprocessed CSV data.
 * All existing component imports continue to work unchanged.
 *
 * To regenerate the underlying data:  node scripts/preprocess-csv.mjs
 */

export {
  portfolioWarnings,
  portfolioNotifications,
  portfolioMeta,
  todaysProduction,
  todaysConsumption,
  buildings,
  monthComparisons,
  comparisonsByResolution,
  buildingConsumptionBreakdown,
  portfolioAnomaly,
  portfolioAnomalyByResolution,
  buildingAnomalyByResolution,
  buildingDetails,
  equipmentDetails,
  getChillerTimeSeries,
  getChillerAnomaly,
} from './realPortfolioData.ts';

export type { ChillerTimeSeriesBundle } from './realPortfolioData.ts';
