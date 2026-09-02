// Spatial twin — the asset graph and the state that binds to it.
//
// This is a horizontal capability, not "Block 8". Blocks 6 and 7 own the physics
// and the analytics; this module owns three things only:
//   1. an asset graph  — what exists, what it belongs to, what it is wired to,
//                        where it sits (metres, plant frame);
//   2. a state snapshot — what we currently believe about each node, and HOW
//                        we came to believe it (provenance);
//   3. the rules that carry belief up and down the graph without inflating it.
//
// The one rule everything else hangs off: a value is MEASURED only at the node
// where the sensor sits. Carried anywhere else it becomes DERIVED and names its
// source. The renderer therefore cannot paint a string as measured when only the
// inverter above it was.
//
// Modules and cells are deliberately NOT nodes. They are counts on the string /
// rack that stands for them. Making them nodes would let the UI address 25,000
// objects the platform has no data for. When module-level electronics or cell-
// level BMS telemetry arrive, they become nodes in the adapter that ingests them,
// not before.

export type Domain = 'pv' | 'bess';

export type Level = 'plant' | 'array' | 'inverter' | 'mppt' | 'string' | 'bess' | 'container' | 'rack';

/** Where a displayed value came from. Order matters: later = weaker. */
export type Provenance = 'MEASURED' | 'DERIVED' | 'ESTIMATED' | 'SIMULATED' | 'UNAVAILABLE';

export const PROVENANCE_ORDER: Provenance[] = ['MEASURED', 'DERIVED', 'ESTIMATED', 'SIMULATED', 'UNAVAILABLE'];

/** Plain words a facility owner reads. Keys match Provenance exactly. */
export const PROVENANCE_LABEL: Record<Provenance, string> = {
  MEASURED: 'Measured',
  DERIVED: 'Worked out',
  ESTIMATED: 'Estimated',
  SIMULATED: 'Simulated',
  UNAVAILABLE: 'No data',
};

/** Mirrors the platform vocabulary (shared/vocab.PV_TRACKING_VOCAB). single_axis is
 *  deliberately absent there because block 6 cannot compute its plane; the twin does
 *  not accept a value the physics refuses. */
export type Tracking = 'fixed' | 'dual_axis';

export interface PvConfig {
  arrays: number;
  invertersPerArray: number;
  mpptPerInverter: number;
  stringsPerMppt: number;
  modulesPerString: number;
  moduleWp: number;
  inverterAcKw: number;
  tracking: Tracking;
  tiltDeg: number;
  /** Degrees east of north, same convention as EquipmentParameters.surface_azimuth_deg. */
  azimuthDeg: number;
  /** Ground coverage ratio: module length ÷ row pitch. */
  gcr: number;
}

export interface BessConfig {
  containers: number;
  racksPerContainer: number;
  modulesPerRack: number;
  cellsPerModule: number;
  rackKwh: number;
  rackKw: number;
  /** True only when the BMS exposes per-cell voltage/temperature. Cells are never
   *  drawn as addressable objects unless this is true — and even then, only counts
   *  exist until a cell-level adapter ships. */
  cellTelemetry: boolean;
}

export interface TwinConfig {
  name: string;
  pv: PvConfig;
  bess: BessConfig | null;
}

export interface Footprint {
  /** Plant frame, metres. x grows east, y grows south. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AssetNode {
  /** Deterministic, human-readable, unique within the graph. e.g. `A2/INV3/M1/S14`. */
  id: string;
  level: Level;
  domain: Domain;
  label: string;
  /** Electrical parent (what this node feeds into). */
  parentId: string | null;
  childIds: string[];
  /** Physical units this node stands for that are not modelled individually. */
  standsFor: { modules?: number; cells?: number };
  nameplate: { dcKw?: number; acKw?: number; energyKwh?: number; powerKw?: number };
  footprint?: Footprint;
  /** Link into the platform identity hierarchy (shared/identity.py). Only levels the
   *  platform registers today carry one; the rest are display topology until the
   *  hierarchy-depth decision is taken. */
  platformRef?: { subsystemType: 'pv_plant' | 'battery_storage'; equipmentType?: 'pv_inverter' | 'battery_rack' };
}

export interface AssetGraph {
  nodes: Record<string, AssetNode>;
  /** Pre-order traversal, stable across runs for the same config. */
  order: string[];
  rootIds: string[];
  config: TwinConfig;
  /** Plant-frame extent in metres. */
  extent: { w: number; h: number };
  counts: { arrays: number; inverters: number; strings: number; modules: number; containers: number; racks: number; cells: number };
}

export type Status = 'ok' | 'attention' | 'no_data';

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Running normally',
  attention: 'Needs attention',
  no_data: 'No data',
};

export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  provenance: Provenance;
  /** One sentence a reader can audit: what produced this number. */
  basis: string;
  sourceNodeId?: string;
}

export interface NodeState {
  status: Status;
  statusProvenance: Provenance;
  statusBasis: string;
  /** Node whose measurement this status was carried from, when not measured here. */
  statusSourceId?: string;
  metrics: Metric[];
}

export type ScenarioKind = 'string_open_circuit' | 'array_soiled' | 'inverter_offline' | 'rack_hot';

export interface Scenario {
  kind: ScenarioKind;
  targetId: string;
}

export const SCENARIO_LABEL: Record<ScenarioKind, string> = {
  string_open_circuit: 'Open-circuit string',
  array_soiled: 'Soiled array',
  inverter_offline: 'Inverter offline',
  rack_hot: 'Hot rack',
};

/** Which node level each scenario can be injected on. */
export const SCENARIO_LEVEL: Record<ScenarioKind, Level> = {
  string_open_circuit: 'string',
  array_soiled: 'array',
  inverter_offline: 'inverter',
  rack_hot: 'rack',
};

export interface StateSnapshot {
  /** What is attached. 'none' = a bare configured plant with no records. */
  source: 'none' | 'reference';
  sourceLabel: string;
  asOf: string | null;
  scenario: Scenario | null;
  nodes: Record<string, NodeState>;
}

/** The weakest provenance among inputs, ignoring UNAVAILABLE unless nothing else exists.
 *  SIMULATED dominates: an aggregate touched by a simulated input is simulated. */
export function aggregateProvenance(inputs: Provenance[]): Provenance {
  const present = inputs.filter((p) => p !== 'UNAVAILABLE');
  if (present.length === 0) return 'UNAVAILABLE';
  if (present.includes('SIMULATED')) return 'SIMULATED';
  if (present.includes('ESTIMATED')) return 'ESTIMATED';
  // Anything aggregated from measurements is a derivation, never a measurement.
  return 'DERIVED';
}

export const LEVEL_LABEL: Record<Level, string> = {
  plant: 'Solar plant',
  array: 'Array',
  inverter: 'Inverter',
  mppt: 'Inverter input',
  string: 'String',
  bess: 'Battery system',
  container: 'Container',
  rack: 'Rack',
};
