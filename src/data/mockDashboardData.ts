export const todaysBill = {
  amount: '12.50',
  currency: 'OMR',
  subtext: 'Grid import 1,037 kWh',
  deltaText: '1.8% lower vs yesterday',
};

export const outdoorTempSeries = [
  { day: 'Mon', temp: 36 },
  { day: 'Tue', temp: 37 },
  { day: 'Wed', temp: 38 },
  { day: 'Thu', temp: 37 },
  { day: 'Fri', temp: 39 },
  { day: 'Sat', temp: 38 },
  { day: 'Sun', temp: 36 },
];

export const energyBreakdown = [
  { name: 'HVAC', value: 44, color: '#38bdf8' },
  { name: 'Equipment', value: 22, color: '#818cf8' },
  { name: 'Lighting', value: 18, color: '#f472b6' },
  { name: 'Pumps', value: 16, color: '#34d399' },
];

export const energyBySystemData = [
  { label: 'Mon', hvac: 320, lighting: 150, equipment: 120 },
  { label: 'Tue', hvac: 300, lighting: 160, equipment: 140 },
  { label: 'Wed', hvac: 340, lighting: 155, equipment: 130 },
  { label: 'Thu', hvac: 360, lighting: 170, equipment: 150 },
  { label: 'Fri', hvac: 310, lighting: 165, equipment: 135 },
  { label: 'Sat', hvac: 295, lighting: 150, equipment: 125 },
  { label: 'Sun', hvac: 280, lighting: 140, equipment: 118 },
];

export const microgridSeries = [
  { label: '06:00', consumption: 180, self: 90 },
  { label: '08:00', consumption: 220, self: 120 },
  { label: '10:00', consumption: 260, self: 170 },
  { label: '12:00', consumption: 300, self: 210 },
  { label: '14:00', consumption: 320, self: 230 },
  { label: '16:00', consumption: 310, self: 220 },
  { label: '18:00', consumption: 280, self: 180 },
];
