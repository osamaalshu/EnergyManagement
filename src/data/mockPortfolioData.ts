import type {
  PortfolioWarning,
  PortfolioNotification,
  PortfolioMeta,
  KpiValue,
  Building,
  MonthComparison,
  ConsumptionBreakdownEntry,
  AnomalyData,
  AnomalyPoint,
  Equipment,
  BuildingDetail,
  BuildingAggregateKPIs,
  EquipmentDetail,
  ChillerKPIs,
  TimeSeriesPoint,
  TemperatureLoopPoint,
  PowerCoolingPoint,
} from '../types/portfolio';

// ═══════════════════════════════════════════════════════════════════
//  PORTFOLIO-LEVEL
// ═══════════════════════════════════════════════════════════════════

export const portfolioWarnings: PortfolioWarning[] = [
  {
    id: 'w1',
    severity: 'critical',
    message: 'Chiller 3 efficiency degraded — kW/ton at 0.85 (threshold: 0.70)',
    timestamp: '2026-02-12T08:14:00',
  },
  {
    id: 'w2',
    severity: 'warning',
    message: 'Cooling Tower 9 condenser supply temp 56.7°C (above 50°C limit)',
    timestamp: '2026-02-12T07:45:00',
  },
  {
    id: 'w3',
    severity: 'info',
    message: 'System OFF detected for 6.5 hrs on Building A3 — scheduled maintenance?',
    timestamp: '2026-02-11T22:30:00',
  },
];

export const portfolioNotifications: PortfolioNotification[] = [
  { id: 'n1', title: 'Monthly report ready for January 2026', read: false },
  { id: 'n2', title: 'New tariff schedule effective March 1', read: false },
  { id: 'n3', title: 'Building C1 maintenance window confirmed', read: true },
  { id: 'n4', title: 'Anomaly detected in Building A1 Chiller 3', read: false },
];

export const portfolioMeta: PortfolioMeta = {
  name: 'OQAE',
  buildingCount: 8,
  score: 78,
  savingsPotentialPercent: 12,
};

export const todaysProduction: KpiValue = { kWh: 4820, omr: 58.5 };
export const todaysConsumption: KpiValue = { kWh: 6140, omr: 74.2 };

// ═══════════════════════════════════════════════════════════════════
//  BUILDING-LEVEL
// ═══════════════════════════════════════════════════════════════════

export const buildings: Building[] = [
  { id: 'A1', name: 'Building A1', sector: 'Commercial', surfaceArea: 2400, normalizedConsumption: 85,  performanceBand: 'Exceeded', category: 'Office' },
  { id: 'A2', name: 'Building A2', sector: 'Commercial', surfaceArea: 1800, normalizedConsumption: 110, performanceBand: 'Average',  category: 'Office' },
  { id: 'A3', name: 'Building A3', sector: 'Commercial', surfaceArea: 1200, normalizedConsumption: 95,  performanceBand: 'Average',  category: 'Office' },
  { id: 'B1', name: 'Building B1', sector: 'Retail',     surfaceArea: 3200, normalizedConsumption: 72,  performanceBand: 'Exceeded', category: 'Mall' },
  { id: 'B2', name: 'Building B2', sector: 'Retail',     surfaceArea: 1500, normalizedConsumption: 60,  performanceBand: 'Exceeded', category: 'Mall' },
  { id: 'C1', name: 'Building C1', sector: 'Industrial', surfaceArea: 4500, normalizedConsumption: 180, performanceBand: 'Lower',    category: 'Warehouse' },
  { id: 'C2', name: 'Building C2', sector: 'Industrial', surfaceArea: 3000, normalizedConsumption: 140, performanceBand: 'Lower',    category: 'Warehouse' },
  { id: 'D1', name: 'Building D1', sector: 'Hospitality',surfaceArea: 3800, normalizedConsumption: 155, performanceBand: 'Average',  category: 'Hotel' },
];

export const monthComparisons: MonthComparison[] = [
  { month: 'Mar',  status: 'Exceeded', portfolioValue: 680, sectorValue: 720 },
  { month: 'Apr',  status: 'Average',  portfolioValue: 710, sectorValue: 700 },
  { month: 'May',  status: 'Exceeded', portfolioValue: 690, sectorValue: 740 },
  { month: 'Jun',  status: 'Exceeded', portfolioValue: 750, sectorValue: 810 },
  { month: 'Jul',  status: 'Average',  portfolioValue: 820, sectorValue: 830 },
  { month: 'Aug',  status: 'Lower',    portfolioValue: 860, sectorValue: 800 },
  { month: 'Sep',  status: 'Average',  portfolioValue: 780, sectorValue: 770 },
  { month: 'Oct',  status: 'Exceeded', portfolioValue: 700, sectorValue: 750 },
  { month: 'Nov',  status: 'Average',  portfolioValue: 660, sectorValue: 670 },
  { month: 'Dec',  status: 'Lower',    portfolioValue: 720, sectorValue: 680 },
  { month: 'Jan',  status: 'Exceeded', portfolioValue: 640, sectorValue: 710 },
  { month: 'Feb',  status: 'Average',  portfolioValue: 670, sectorValue: 680 },
];

export const buildingConsumptionBreakdown: ConsumptionBreakdownEntry[] = [
  { name: 'Chillers',        value: 44, color: '#38bdf8' },
  { name: 'Cooling Towers',  value: 22, color: '#818cf8' },
  { name: 'Pumps',           value: 18, color: '#f472b6' },
  { name: 'Lighting',        value: 10, color: '#34d399' },
  { name: 'Other',           value: 6,  color: '#94a3b8' },
];

// ── Portfolio anomaly (aggregated across buildings) ──────────────
const portfolioAnomalySeries: AnomalyPoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const baseline = 0.42 + Math.sin(day / 5) * 0.04;
  const spike = (day >= 15 && day <= 19) ? 0.15 + (day === 17 ? 0.2 : 0) : 0;
  return {
    label: `Day ${day}`,
    baseline: Number(baseline.toFixed(3)),
    actual: Number((baseline + spike + (Math.random() - 0.5) * 0.02).toFixed(3)),
  };
});

export const portfolioAnomaly: AnomalyData = {
  anomalyCount: 5,
  inefficiencyCost: 342,
  series: portfolioAnomalySeries,
};

// ═══════════════════════════════════════════════════════════════════
//  EQUIPMENT HELPERS
// ═══════════════════════════════════════════════════════════════════

const makeChillerEquipment = (buildingId: string, n: number, status: Equipment['status'], kW: number, eff: number): Equipment => ({
  id: `${buildingId}-chiller-${n}`,
  buildingId,
  name: `Chiller ${n}`,
  type: 'chiller',
  status,
  primaryValue: kW,
  primaryUnit: 'kW',
  secondaryValue: eff,
  secondaryUnit: 'kW/ton',
});

const makeTowerEquipment = (buildingId: string, n: number, status: Equipment['status'], temp: number): Equipment => ({
  id: `${buildingId}-tower-${n}`,
  buildingId,
  name: `Cooling Tower ${n}`,
  type: 'coolingTower',
  status,
  primaryValue: temp,
  primaryUnit: '°C',
});

const makePumpEquipment = (buildingId: string, status: Equipment['status'], kW: number): Equipment => ({
  id: `${buildingId}-pump-1`,
  buildingId,
  name: 'Chilled Water Pump',
  type: 'pump',
  status,
  primaryValue: kW,
  primaryUnit: 'kW',
});

// ── Equipment for Building A1 (the primary demo building) ────────
const a1Equipment: Equipment[] = [
  makeChillerEquipment('A1', 1, 'running', 142, 0.38),
  makeChillerEquipment('A1', 2, 'running', 158, 0.42),
  makeChillerEquipment('A1', 3, 'warning', 180, 0.85),
  makeTowerEquipment('A1', 1, 'running', 28.5),
  makeTowerEquipment('A1', 2, 'running', 27.8),
  makeTowerEquipment('A1', 3, 'running', 28.1),
  makeTowerEquipment('A1', 4, 'running', 27.6),
  makeTowerEquipment('A1', 5, 'running', 28.3),
  makeTowerEquipment('A1', 6, 'running', 27.9),
  makeTowerEquipment('A1', 7, 'running', 28.0),
  makeTowerEquipment('A1', 8, 'running', 27.7),
  makeTowerEquipment('A1', 9, 'warning', 56.7),
  makePumpEquipment('A1', 'running', 45),
];

// Simple equipment for other buildings (shorter lists for brevity)
const makeSimpleEquipmentList = (buildingId: string): Equipment[] => [
  makeChillerEquipment(buildingId, 1, 'running', 120 + Math.round(Math.random() * 40), 0.35 + Number((Math.random() * 0.15).toFixed(2))),
  makeChillerEquipment(buildingId, 2, 'running', 130 + Math.round(Math.random() * 40), 0.38 + Number((Math.random() * 0.15).toFixed(2))),
  makeChillerEquipment(buildingId, 3, 'running', 125 + Math.round(Math.random() * 40), 0.36 + Number((Math.random() * 0.15).toFixed(2))),
  makeTowerEquipment(buildingId, 1, 'running', 27 + Number((Math.random() * 2).toFixed(1))),
  makeTowerEquipment(buildingId, 2, 'running', 27 + Number((Math.random() * 2).toFixed(1))),
  makeTowerEquipment(buildingId, 3, 'running', 27 + Number((Math.random() * 2).toFixed(1))),
  makePumpEquipment(buildingId, 'running', 40 + Math.round(Math.random() * 15)),
];

// ── Building anomaly data factory ────────────────────────────────
const makeBuildingAnomaly = (count: number, cost: number): AnomalyData => ({
  anomalyCount: count,
  inefficiencyCost: cost,
  series: Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const baseline = 0.40 + Math.sin(day / 6) * 0.03;
    const spike = (day >= 12 && day <= 15) ? 0.1 + (day === 13 ? 0.15 : 0) : 0;
    return {
      label: `Day ${day}`,
      baseline: Number(baseline.toFixed(3)),
      actual: Number((baseline + spike + (Math.random() - 0.5) * 0.015).toFixed(3)),
    };
  }),
});

// ═══════════════════════════════════════════════════════════════════
//  BUILDING DETAILS MAP
// ═══════════════════════════════════════════════════════════════════

const makeBuildingDetail = (
  building: Building,
  kpis: BuildingAggregateKPIs,
  equipment: Equipment[],
  anomaly: AnomalyData,
): BuildingDetail => ({
  building,
  aggregateKPIs: kpis,
  equipment,
  anomaly,
});

export const buildingDetails: Record<string, BuildingDetail> = {
  A1: makeBuildingDetail(
    buildings[0],
    { systemDeltaT: 4.8, totalFlowRate: 385, systemKwPerTon: 0.45 },
    a1Equipment,
    makeBuildingAnomaly(3, 128),
  ),
  A2: makeBuildingDetail(
    buildings[1],
    { systemDeltaT: 4.5, totalFlowRate: 340, systemKwPerTon: 0.48 },
    makeSimpleEquipmentList('A2'),
    makeBuildingAnomaly(1, 54),
  ),
  A3: makeBuildingDetail(
    buildings[2],
    { systemDeltaT: 4.2, totalFlowRate: 290, systemKwPerTon: 0.52 },
    makeSimpleEquipmentList('A3'),
    makeBuildingAnomaly(2, 87),
  ),
  B1: makeBuildingDetail(
    buildings[3],
    { systemDeltaT: 5.1, totalFlowRate: 420, systemKwPerTon: 0.40 },
    makeSimpleEquipmentList('B1'),
    makeBuildingAnomaly(0, 0),
  ),
  B2: makeBuildingDetail(
    buildings[4],
    { systemDeltaT: 5.3, totalFlowRate: 310, systemKwPerTon: 0.38 },
    makeSimpleEquipmentList('B2'),
    makeBuildingAnomaly(0, 0),
  ),
  C1: makeBuildingDetail(
    buildings[5],
    { systemDeltaT: 3.8, totalFlowRate: 510, systemKwPerTon: 0.62 },
    makeSimpleEquipmentList('C1'),
    makeBuildingAnomaly(4, 210),
  ),
  C2: makeBuildingDetail(
    buildings[6],
    { systemDeltaT: 3.5, totalFlowRate: 440, systemKwPerTon: 0.58 },
    makeSimpleEquipmentList('C2'),
    makeBuildingAnomaly(2, 95),
  ),
  D1: makeBuildingDetail(
    buildings[7],
    { systemDeltaT: 4.0, totalFlowRate: 380, systemKwPerTon: 0.50 },
    makeSimpleEquipmentList('D1'),
    makeBuildingAnomaly(1, 62),
  ),
};

// ═══════════════════════════════════════════════════════════════════
//  EQUIPMENT DETAILS (for the Equipment page drill-down)
// ═══════════════════════════════════════════════════════════════════

const weeks = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8','Wk 9','Wk 10','Wk 11','Wk 12'];

const makeEfficiencySeries = (base: number, variance: number): TimeSeriesPoint[] =>
  weeks.map((label) => ({
    label,
    value: Number((base + (Math.random() - 0.5) * variance).toFixed(3)),
  }));

const makeTempLoopSeries = (
  csBase: number, crBase: number, cdBase: number, cdrBase: number,
): TemperatureLoopPoint[] =>
  weeks.map((label) => ({
    label,
    chilledSupply:   Number((csBase  + (Math.random() - 0.5) * 1.5).toFixed(1)),
    chilledReturn:   Number((crBase  + (Math.random() - 0.5) * 2.0).toFixed(1)),
    condenserSupply: Number((cdBase  + (Math.random() - 0.5) * 1.5).toFixed(1)),
    condenserReturn: Number((cdrBase + (Math.random() - 0.5) * 1.5).toFixed(1)),
  }));

const makePowerCoolingSeries = (pBase: number, cBase: number): PowerCoolingPoint[] =>
  weeks.map((label) => ({
    label,
    power:       Number((pBase + (Math.random() - 0.5) * 30).toFixed(0)),
    coolingTons: Number((cBase + (Math.random() - 0.5) * 40).toFixed(0)),
  }));

const makeEquipmentAnomaly = (count: number, cost: number): AnomalyData => ({
  anomalyCount: count,
  inefficiencyCost: cost,
  series: Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const base = 0.38 + Math.sin(day / 7) * 0.03;
    const spike = (day >= 20 && day <= 22) ? 0.12 : 0;
    return {
      label: `Day ${day}`,
      baseline: Number(base.toFixed(3)),
      actual: Number((base + spike + (Math.random() - 0.5) * 0.01).toFixed(3)),
    };
  }),
});

// A1 equipment details (the building with full detail)
const a1ChillerDetails: Record<string, EquipmentDetail> = {
  'A1-chiller-1': {
    equipment: a1Equipment[0],
    chillerKPIs: {
      deltaT: 4.2, chilledWaterFlowRate: 186, condenserWaterFlowRate: 42,
      coolingTons: 156, efficiency: 0.38, powerDraw: 142,
      chilledWaterSupplyTemp: 7.0, chilledWaterReturnTemp: 11.2,
      condenserWaterSupplyTemp: 26.8, condenserWaterReturnTemp: 29.5,
    } as ChillerKPIs,
    efficiencySeries: makeEfficiencySeries(0.38, 0.08),
    temperatureLoopSeries: makeTempLoopSeries(7.0, 11.2, 26.8, 29.5),
    powerCoolingSeries: makePowerCoolingSeries(142, 156),
    anomaly: makeEquipmentAnomaly(1, 42),
  },
  'A1-chiller-2': {
    equipment: a1Equipment[1],
    chillerKPIs: {
      deltaT: 4.5, chilledWaterFlowRate: 198, condenserWaterFlowRate: 45,
      coolingTons: 172, efficiency: 0.42, powerDraw: 158,
      chilledWaterSupplyTemp: 7.2, chilledWaterReturnTemp: 11.7,
      condenserWaterSupplyTemp: 27.1, condenserWaterReturnTemp: 30.0,
    } as ChillerKPIs,
    efficiencySeries: makeEfficiencySeries(0.42, 0.08),
    temperatureLoopSeries: makeTempLoopSeries(7.2, 11.7, 27.1, 30.0),
    powerCoolingSeries: makePowerCoolingSeries(158, 172),
    anomaly: makeEquipmentAnomaly(0, 0),
  },
  'A1-chiller-3': {
    equipment: a1Equipment[2],
    chillerKPIs: {
      deltaT: 3.1, chilledWaterFlowRate: 145, condenserWaterFlowRate: 38,
      coolingTons: 98, efficiency: 0.85, powerDraw: 180,
      chilledWaterSupplyTemp: 8.5, chilledWaterReturnTemp: 11.6,
      condenserWaterSupplyTemp: 28.4, condenserWaterReturnTemp: 31.2,
    } as ChillerKPIs,
    efficiencySeries: weeks.map((label, i) => ({
      label,
      value: Number((0.55 + (i > 7 ? 0.25 : 0) + (Math.random() - 0.5) * 0.06).toFixed(3)),
    })),
    temperatureLoopSeries: makeTempLoopSeries(8.5, 11.6, 28.4, 31.2),
    powerCoolingSeries: makePowerCoolingSeries(180, 98),
    anomaly: makeEquipmentAnomaly(2, 86),
  },
};

const a1TowerDetails: Record<string, EquipmentDetail> = Object.fromEntries(
  a1Equipment.filter(e => e.type === 'coolingTower').map(equip => [
    equip.id,
    {
      equipment: equip,
      coolingTowerKPIs: { condenserWaterSupplyTemp: equip.primaryValue },
      anomaly: equip.status === 'warning'
        ? makeEquipmentAnomaly(1, 35)
        : makeEquipmentAnomaly(0, 0),
    } as EquipmentDetail,
  ]),
);

const a1PumpDetail: Record<string, EquipmentDetail> = {
  'A1-pump-1': {
    equipment: a1Equipment[12],
    pumpKPIs: { powerDraw: 45 },
    anomaly: makeEquipmentAnomaly(0, 0),
  },
};

// Merge all A1 equipment details
const a1AllEquipmentDetails: Record<string, EquipmentDetail> = {
  ...a1ChillerDetails,
  ...a1TowerDetails,
  ...a1PumpDetail,
};

// Generate simple equipment details for other buildings
const makeSimpleEquipmentDetails = (buildingId: string): Record<string, EquipmentDetail> => {
  const bd = buildingDetails[buildingId];
  if (!bd) return {};
  const result: Record<string, EquipmentDetail> = {};
  for (const equip of bd.equipment) {
    if (equip.type === 'chiller') {
      result[equip.id] = {
        equipment: equip,
        chillerKPIs: {
          deltaT: 3.5 + Math.random() * 2,
          chilledWaterFlowRate: 150 + Math.random() * 80,
          condenserWaterFlowRate: 35 + Math.random() * 20,
          coolingTons: 100 + Math.random() * 80,
          efficiency: equip.secondaryValue ?? 0.4,
          powerDraw: equip.primaryValue,
          chilledWaterSupplyTemp: 6.5 + Math.random() * 2,
          chilledWaterReturnTemp: 10 + Math.random() * 3,
          condenserWaterSupplyTemp: 26 + Math.random() * 3,
          condenserWaterReturnTemp: 29 + Math.random() * 2,
        },
        efficiencySeries: makeEfficiencySeries(equip.secondaryValue ?? 0.4, 0.08),
        temperatureLoopSeries: makeTempLoopSeries(7, 11, 27, 29.5),
        powerCoolingSeries: makePowerCoolingSeries(equip.primaryValue, 140),
        anomaly: makeEquipmentAnomaly(0, 0),
      };
    } else if (equip.type === 'coolingTower') {
      result[equip.id] = {
        equipment: equip,
        coolingTowerKPIs: { condenserWaterSupplyTemp: equip.primaryValue },
        anomaly: makeEquipmentAnomaly(0, 0),
      };
    } else {
      result[equip.id] = {
        equipment: equip,
        pumpKPIs: { powerDraw: equip.primaryValue },
        anomaly: makeEquipmentAnomaly(0, 0),
      };
    }
  }
  return result;
};

/** All equipment details indexed by equipment ID */
export const equipmentDetails: Record<string, EquipmentDetail> = {
  ...a1AllEquipmentDetails,
  ...makeSimpleEquipmentDetails('A2'),
  ...makeSimpleEquipmentDetails('A3'),
  ...makeSimpleEquipmentDetails('B1'),
  ...makeSimpleEquipmentDetails('B2'),
  ...makeSimpleEquipmentDetails('C1'),
  ...makeSimpleEquipmentDetails('C2'),
  ...makeSimpleEquipmentDetails('D1'),
};
