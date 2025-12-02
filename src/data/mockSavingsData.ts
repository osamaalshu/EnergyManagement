export const savingsSummary = {
  baselineKwh: 4195.77,
  actualKwh: 3151.0,
  savingsPercent: 24.9,
};

export const savingsTimeseries = [
  { month: 'Jan', baseline: 720, actual: 610 },
  { month: 'Feb', baseline: 680, actual: 540 },
  { month: 'Mar', baseline: 710, actual: 550 },
  { month: 'Apr', baseline: 690, actual: 520 },
  { month: 'May', baseline: 730, actual: 560 },
  { month: 'Jun', baseline: 740, actual: 590 },
  { month: 'Jul', baseline: 760, actual: 600 },
  { month: 'Aug', baseline: 780, actual: 630 },
  { month: 'Sep', baseline: 700, actual: 520 },
  { month: 'Oct', baseline: 690, actual: 510 },
  { month: 'Nov', baseline: 660, actual: 495 },
  { month: 'Dec', baseline: 640, actual: 480 },
];

export const savingsPercentTrend = savingsTimeseries.map((entry) => ({
  month: entry.month,
  percent: Number((((entry.baseline - entry.actual) / entry.baseline) * 100).toFixed(1)),
}));
