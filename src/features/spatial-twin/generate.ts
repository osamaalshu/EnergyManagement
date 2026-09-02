// Configuration → asset graph. Pure and deterministic: the same config always
// yields the same ids, the same order and the same metres.
//
// Physical placement is a plausible engineering layout, not a survey: rows of
// portrait modules at a pitch set by the ground-coverage ratio, one array per
// block, inverters on a skid at the east edge of their array, battery containers
// south of the field. It exists so that "where is it?" has an answer for a plant
// that was described, not drawn. A surveyed layout (CSV / DXF / GIS) replaces the
// footprints only — nothing else in the graph changes. That is the seam.

import type { AssetGraph, AssetNode, Footprint, PvConfig, TwinConfig } from './model';

// Portrait crystalline module, a common 550–600 Wp size.
export const MODULE_W_M = 1.134; // across the row
export const MODULE_L_M = 2.278; // along the tilt
const STRING_GAP_M = 0.5;
const ARRAY_ASPECT = 1.5; // width ÷ depth of an array block; wide reads as a field, tall as a list
const ROAD_M = 8;
const INVERTER_W_M = 2.0;
const INVERTER_H_M = 1.2;
const SKID_OFFSET_M = 2.0;
const CONTAINER_W_M = 12.2; // 40 ft
const CONTAINER_H_M = 2.44;
const CONTAINER_GAP_M = 3;
const BESS_SETBACK_M = 12;

export const LIMITS = {
  arrays: [1, 16],
  invertersPerArray: [1, 24],
  mpptPerInverter: [1, 12],
  stringsPerMppt: [1, 8],
  modulesPerString: [4, 36],
  moduleWp: [200, 800],
  inverterAcKw: [5, 5000],
  tiltDeg: [0, 60],
  azimuthDeg: [0, 359],
  gcr: [0.2, 0.8],
  containers: [1, 24],
  racksPerContainer: [1, 24],
  modulesPerRack: [1, 40],
  cellsPerModule: [1, 200],
  rackKwh: [10, 1000],
  rackKw: [5, 1000],
} as const;

type LimitKey = keyof typeof LIMITS;

const inRange = (key: LimitKey, v: number) => Number.isFinite(v) && v >= LIMITS[key][0] && v <= LIMITS[key][1];
const isInt = (v: number) => Number.isInteger(v);

/** Returns problems in plain words. Empty array = valid. */
export function validateConfig(cfg: TwinConfig): string[] {
  const out: string[] = [];
  const pv = cfg.pv;
  const check = (key: LimitKey, v: number, label: string, integer = true) => {
    if (!inRange(key, v) || (integer && !isInt(v))) out.push(`${label} must be ${integer ? 'a whole number ' : ''}between ${LIMITS[key][0]} and ${LIMITS[key][1]}.`);
  };
  check('arrays', pv.arrays, 'Arrays');
  check('invertersPerArray', pv.invertersPerArray, 'Inverters per array');
  check('mpptPerInverter', pv.mpptPerInverter, 'MPPT inputs per inverter');
  check('stringsPerMppt', pv.stringsPerMppt, 'Strings per MPPT input');
  check('modulesPerString', pv.modulesPerString, 'Modules per string');
  check('moduleWp', pv.moduleWp, 'Module watts', false);
  check('inverterAcKw', pv.inverterAcKw, 'Inverter kW', false);
  check('tiltDeg', pv.tiltDeg, 'Tilt', false);
  check('azimuthDeg', pv.azimuthDeg, 'Azimuth', false);
  check('gcr', pv.gcr, 'Ground coverage ratio', false);
  if (pv.tracking !== 'fixed' && pv.tracking !== 'dual_axis') {
    out.push('Tracking must be fixed or dual-axis. Single-axis is not accepted: the platform cannot model its plane yet.');
  }
  if (cfg.bess) {
    const b = cfg.bess;
    check('containers', b.containers, 'Containers');
    check('racksPerContainer', b.racksPerContainer, 'Racks per container');
    check('modulesPerRack', b.modulesPerRack, 'Modules per rack');
    check('cellsPerModule', b.cellsPerModule, 'Cells per module');
    check('rackKwh', b.rackKwh, 'Rack kWh', false);
    check('rackKw', b.rackKw, 'Rack kW', false);
  }
  if (!cfg.name.trim()) out.push('Give the plant a name.');
  return out;
}

interface ArrayGeometry {
  stringLen: number;
  stringsPerRow: number;
  rows: number;
  pitch: number;
  rowDepth: number;
  /** Array block including its inverter skid column. */
  blockW: number;
  blockH: number;
  fieldW: number; // strings only
}

function arrayGeometry(pv: PvConfig): ArrayGeometry {
  const totalStrings = pv.invertersPerArray * pv.mpptPerInverter * pv.stringsPerMppt;
  const stringLen = pv.modulesPerString * MODULE_W_M;
  // A fixed row projects to length × cos(tilt) on the ground; a tracker sweeps the full length.
  const rowDepth = pv.tracking === 'fixed' ? MODULE_L_M * Math.cos((pv.tiltDeg * Math.PI) / 180) : MODULE_L_M;
  const pitch = Math.max(rowDepth, MODULE_L_M / pv.gcr);
  // Strings per row chosen so the block comes out about ARRAY_ASPECT wide for its depth.
  const stringsPerRow = Math.max(1, Math.min(totalStrings, Math.round(Math.sqrt((ARRAY_ASPECT * totalStrings * pitch) / stringLen))));
  const rows = Math.ceil(totalStrings / stringsPerRow);
  const fieldW = stringsPerRow * stringLen + (stringsPerRow - 1) * STRING_GAP_M;
  const blockW = fieldW + SKID_OFFSET_M + INVERTER_W_M;
  const skidH = pv.invertersPerArray * (INVERTER_H_M + 0.6);
  const blockH = Math.max((rows - 1) * pitch + rowDepth, skidH);
  return { stringLen, stringsPerRow, rows, pitch, rowDepth, blockW, blockH, fieldW };
}

export function generateGraph(cfg: TwinConfig): AssetGraph {
  const problems = validateConfig(cfg);
  if (problems.length) throw new Error(`Invalid twin configuration: ${problems.join(' ')}`);

  const nodes: Record<string, AssetNode> = {};
  const order: string[] = [];
  const add = (n: AssetNode) => {
    if (nodes[n.id]) throw new Error(`Duplicate node id ${n.id}`);
    nodes[n.id] = n;
    order.push(n.id);
    if (n.parentId) nodes[n.parentId].childIds.push(n.id);
  };

  const pv = cfg.pv;
  const g = arrayGeometry(pv);
  const stringDcKw = (pv.modulesPerString * pv.moduleWp) / 1000;
  const mpptDcKw = stringDcKw * pv.stringsPerMppt;
  const invDcKw = mpptDcKw * pv.mpptPerInverter;
  const arrayDcKw = invDcKw * pv.invertersPerArray;
  const plantDcKw = arrayDcKw * pv.arrays;
  const modulesPerArray = pv.invertersPerArray * pv.mpptPerInverter * pv.stringsPerMppt * pv.modulesPerString;

  const gridCols = Math.ceil(Math.sqrt(pv.arrays));
  const gridRows = Math.ceil(pv.arrays / gridCols);
  const fieldW = gridCols * g.blockW + (gridCols - 1) * ROAD_M;
  const fieldH = gridRows * g.blockH + (gridRows - 1) * ROAD_M;

  add({
    id: 'PV', level: 'plant', domain: 'pv', label: cfg.name, parentId: null, childIds: [],
    standsFor: { modules: modulesPerArray * pv.arrays },
    nameplate: { dcKw: round(plantDcKw), acKw: round(pv.inverterAcKw * pv.invertersPerArray * pv.arrays) },
    footprint: { x: 0, y: 0, w: fieldW, h: fieldH },
    platformRef: { subsystemType: 'pv_plant' },
  });

  let strings = 0;
  for (let a = 0; a < pv.arrays; a += 1) {
    const col = a % gridCols;
    const row = Math.floor(a / gridCols);
    const ax = col * (g.blockW + ROAD_M);
    const ay = row * (g.blockH + ROAD_M);
    const arrayId = `A${a + 1}`;
    add({
      id: arrayId, level: 'array', domain: 'pv', label: `Array ${a + 1}`, parentId: 'PV', childIds: [],
      standsFor: { modules: modulesPerArray },
      nameplate: { dcKw: round(arrayDcKw), acKw: round(pv.inverterAcKw * pv.invertersPerArray) },
      footprint: { x: ax, y: ay, w: g.blockW, h: g.blockH },
    });
    let slot = 0;
    for (let i = 0; i < pv.invertersPerArray; i += 1) {
      const invId = `${arrayId}/INV${i + 1}`;
      add({
        id: invId, level: 'inverter', domain: 'pv', label: `Inverter ${i + 1}`, parentId: arrayId, childIds: [],
        standsFor: { modules: pv.mpptPerInverter * pv.stringsPerMppt * pv.modulesPerString },
        nameplate: { dcKw: round(invDcKw), acKw: pv.inverterAcKw },
        footprint: { x: ax + g.fieldW + SKID_OFFSET_M, y: ay + i * (INVERTER_H_M + 0.6), w: INVERTER_W_M, h: INVERTER_H_M },
        platformRef: { subsystemType: 'pv_plant', equipmentType: 'pv_inverter' },
      });
      for (let m = 0; m < pv.mpptPerInverter; m += 1) {
        const mpptId = `${invId}/M${m + 1}`;
        add({
          id: mpptId, level: 'mppt', domain: 'pv', label: `MPPT ${m + 1}`, parentId: invId, childIds: [],
          standsFor: { modules: pv.stringsPerMppt * pv.modulesPerString },
          nameplate: { dcKw: round(mpptDcKw) },
        });
        for (let s = 0; s < pv.stringsPerMppt; s += 1) {
          const r = Math.floor(slot / g.stringsPerRow);
          const c = slot % g.stringsPerRow;
          slot += 1;
          strings += 1;
          const fp: Footprint = { x: ax + c * (g.stringLen + STRING_GAP_M), y: ay + r * g.pitch, w: g.stringLen, h: g.rowDepth };
          add({
            id: `${mpptId}/S${s + 1}`, level: 'string', domain: 'pv', label: `String ${s + 1}`, parentId: mpptId, childIds: [],
            standsFor: { modules: pv.modulesPerString },
            nameplate: { dcKw: round(stringDcKw) },
            footprint: fp,
          });
        }
      }
    }
  }

  let containers = 0;
  let racks = 0;
  let cells = 0;
  let extentH = fieldH;
  let extentW = fieldW;
  if (cfg.bess) {
    const b = cfg.bess;
    containers = b.containers;
    racks = b.containers * b.racksPerContainer;
    cells = racks * b.modulesPerRack * b.cellsPerModule;
    const by = fieldH + BESS_SETBACK_M;
    const bessW = b.containers * CONTAINER_W_M + (b.containers - 1) * CONTAINER_GAP_M;
    extentW = Math.max(extentW, bessW);
    extentH = by + CONTAINER_H_M;
    add({
      id: 'BESS', level: 'bess', domain: 'bess', label: `${cfg.name} battery`, parentId: null, childIds: [],
      standsFor: { cells },
      nameplate: { energyKwh: round(b.rackKwh * racks), powerKw: round(b.rackKw * racks) },
      footprint: { x: 0, y: by, w: bessW, h: CONTAINER_H_M },
      platformRef: { subsystemType: 'battery_storage' },
    });
    const racksPerRow = Math.min(b.racksPerContainer, 12);
    const rackRows = Math.ceil(b.racksPerContainer / racksPerRow);
    const rackW = (CONTAINER_W_M - 0.4) / racksPerRow - 0.15;
    const rackH = (CONTAINER_H_M - 0.4) / rackRows - 0.15;
    for (let c = 0; c < b.containers; c += 1) {
      const cx = c * (CONTAINER_W_M + CONTAINER_GAP_M);
      const cId = `C${c + 1}`;
      add({
        id: cId, level: 'container', domain: 'bess', label: `Container ${c + 1}`, parentId: 'BESS', childIds: [],
        standsFor: { cells: b.racksPerContainer * b.modulesPerRack * b.cellsPerModule },
        nameplate: { energyKwh: round(b.rackKwh * b.racksPerContainer), powerKw: round(b.rackKw * b.racksPerContainer) },
        footprint: { x: cx, y: by, w: CONTAINER_W_M, h: CONTAINER_H_M },
      });
      for (let r = 0; r < b.racksPerContainer; r += 1) {
        const rr = Math.floor(r / racksPerRow);
        const rc = r % racksPerRow;
        add({
          id: `${cId}/R${r + 1}`, level: 'rack', domain: 'bess', label: `Rack ${r + 1}`, parentId: cId, childIds: [],
          standsFor: { cells: b.modulesPerRack * b.cellsPerModule },
          nameplate: { energyKwh: b.rackKwh, powerKw: b.rackKw },
          footprint: { x: cx + 0.2 + rc * (rackW + 0.15), y: by + 0.2 + rr * (rackH + 0.15), w: rackW, h: rackH },
          platformRef: { subsystemType: 'battery_storage', equipmentType: 'battery_rack' },
        });
      }
    }
  }

  return {
    nodes,
    order,
    rootIds: cfg.bess ? ['PV', 'BESS'] : ['PV'],
    config: cfg,
    extent: { w: extentW, h: extentH },
    counts: {
      arrays: pv.arrays,
      inverters: pv.arrays * pv.invertersPerArray,
      strings,
      modules: modulesPerArray * pv.arrays,
      containers,
      racks,
      cells,
    },
  };
}

/** Root → … → node, as ids. */
export function ancestry(graph: AssetGraph, id: string): string[] {
  const chain: string[] = [];
  let cur: string | null = id;
  while (cur) {
    chain.unshift(cur);
    cur = graph.nodes[cur]?.parentId ?? null;
  }
  return chain;
}

/** All descendants in pre-order (excluding the node itself). */
export function descendants(graph: AssetGraph, id: string): string[] {
  const out: string[] = [];
  const stack = [...(graph.nodes[id]?.childIds ?? [])].reverse();
  while (stack.length) {
    const cur = stack.pop() as string;
    out.push(cur);
    const kids = graph.nodes[cur].childIds;
    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i]);
  }
  return out;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
