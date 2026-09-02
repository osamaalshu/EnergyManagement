// Replay of one recorded day, hour by hour, onto the plant.
//
// The dashboard has no feed. What it has is a recorded day: a measured solar
// shape (Alice Springs, scaled to the plant's size), a measured site load (a
// chiller plant, another year), and a battery schedule that is a stated
// scenario. This module turns hour h of that day into facts for the stats row
// and into metrics on the plant and battery nodes — each with its provenance.
//
// Nothing here invents per-inverter or per-string numbers for the hour. The
// day is known at the plant; below the plant it is carried, and painted as such.

import type { DispatchHour, PvBessData } from '@/features/pv-bess/pvBess';
import type { Metric, StateSnapshot } from './model';

export const BAND_LABEL: Record<string, string> = { off_peak: 'Cheap hours', weekday_peak: 'Day peak', night_peak: 'Night peak' };

export interface HourFacts {
  index: number;
  hour: string;
  pvKw: number;
  loadKw: number;
  gridKw: number;
  /** Positive = discharging into the site, negative = charging. */
  batteryKw: number;
  socPct: number;
  bandLabel: string;
  rateBz: number;
  /** Solar output as a share of the plant's solar capacity, 0..1 — drives the plan's brightness. */
  pvFraction: number;
  socFraction: number;
  pvBasis: string;
  loadBasis: string;
  batteryBasis: string;
}

export function hourCount(data: PvBessData): number {
  return data.dispatch.day.hourly.length;
}

export function hourFacts(data: PvBessData, index: number): HourFacts {
  const rows = data.dispatch.day.hourly;
  const i = Math.max(0, Math.min(rows.length - 1, index));
  const h: DispatchHour = rows[i];
  const a = data.dispatch.assumptions;
  return {
    index: i,
    hour: h.hour,
    pvKw: h.pvKw,
    loadKw: h.loadKw,
    gridKw: h.gridImportKw,
    batteryKw: Math.round((h.dischargeKw - h.chargeKw) * 10) / 10,
    socPct: h.socPct,
    bandLabel: BAND_LABEL[h.band] ?? h.band,
    rateBz: h.rateBz,
    pvFraction: a.pvKwp > 0 ? Math.max(0, Math.min(1, h.pvKw / a.pvKwp)) : 0,
    socFraction: Math.max(0, Math.min(1, h.socPct / 100)),
    pvBasis: `Measured solar shape, ${data.pv.site.location}, ${data.dispatch.day.pvDate}, scaled to ${a.pvKwp} kW.`,
    loadBasis: `Measured chiller-plant load, ${data.dispatch.day.loadDate}.`,
    batteryBasis: `Battery schedule scenario: ${a.batteryKwh} kWh, ${a.batteryKw} kW, planned against the tariff. Not a real battery.`,
  };
}

/** A copy of `base` with this hour's facts written onto the plant and battery nodes. */
export function withHour(base: StateSnapshot, data: PvBessData, index: number): StateSnapshot {
  const f = hourFacts(data, index);
  const nodes = { ...base.nodes };
  const add = (id: string, metrics: Metric[]) => {
    if (!nodes[id]) return;
    nodes[id] = { ...nodes[id], metrics: [...metrics, ...nodes[id].metrics] };
  };
  add('PV', [
    { key: 'pvNow', label: `Solar output at ${f.hour}`, value: f.pvKw, unit: 'kW', provenance: 'DERIVED', basis: f.pvBasis },
  ]);
  // The schedule knows the battery as a whole; every container and rack shows the
  // same whole-battery figures, and says so.
  const batteryMetrics = (whole: boolean): Metric[] => [
    { key: 'socNow', label: `Charge level${whole ? '' : ' of the whole battery'} at ${f.hour}`, value: f.socPct, unit: '%', provenance: 'SIMULATED', basis: f.batteryBasis },
    { key: 'batteryNow', label: `${f.batteryKw >= 0 ? 'Discharging' : 'Charging'}${whole ? '' : ', whole battery,'} at ${f.hour}`, value: Math.abs(f.batteryKw), unit: 'kW', provenance: 'SIMULATED', basis: f.batteryBasis },
  ];
  for (const id of Object.keys(nodes)) {
    if (id === 'BESS') add(id, batteryMetrics(true));
    else if (id.startsWith('C')) add(id, batteryMetrics(false));
  }
  return { ...base, nodes };
}
