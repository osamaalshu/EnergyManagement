// Starting points a visitor can pick before typing their own numbers.
// Nameplates are arithmetic from the fields; nothing here is a real customer.

import type { TwinConfig } from './model';

export interface Preset {
  id: 'reference' | 'rooftop' | 'utility';
  label: string;
  hint: string;
  config: TwinConfig;
}

export const PRESETS: Preset[] = [
  {
    id: 'reference',
    label: 'Reference plant',
    hint: 'Seven inverters, so the recorded inverter data fits one to one.',
    config: {
      name: 'Reference plant',
      pv: { arrays: 1, invertersPerArray: 7, mpptPerInverter: 2, stringsPerMppt: 3, modulesPerString: 18, moduleWp: 400, inverterAcKw: 36, tracking: 'fixed', tiltDeg: 20, azimuthDeg: 180, gcr: 0.45 },
      bess: null,
    },
  },
  {
    id: 'rooftop',
    label: 'Factory rooftop',
    hint: 'Two roof sections, a few string inverters, one battery container.',
    config: {
      name: 'Factory rooftop',
      pv: { arrays: 2, invertersPerArray: 3, mpptPerInverter: 2, stringsPerMppt: 3, modulesPerString: 18, moduleWp: 550, inverterAcKw: 50, tracking: 'fixed', tiltDeg: 10, azimuthDeg: 180, gcr: 0.6 },
      bess: { containers: 1, racksPerContainer: 4, modulesPerRack: 8, cellsPerModule: 16, rackKwh: 215, rackKw: 100, cellTelemetry: false },
    },
  },
  {
    id: 'utility',
    label: 'Ground-mount plant',
    hint: 'Eight arrays on trackers, a four-container battery.',
    config: {
      name: 'Ground-mount plant',
      pv: { arrays: 8, invertersPerArray: 12, mpptPerInverter: 4, stringsPerMppt: 6, modulesPerString: 28, moduleWp: 600, inverterAcKw: 250, tracking: 'dual_axis', tiltDeg: 0, azimuthDeg: 180, gcr: 0.35 },
      bess: { containers: 4, racksPerContainer: 8, modulesPerRack: 12, cellsPerModule: 32, rackKwh: 372, rackKw: 186, cellTelemetry: false },
    },
  },
];

export const DEFAULT_PRESET = PRESETS[1];
