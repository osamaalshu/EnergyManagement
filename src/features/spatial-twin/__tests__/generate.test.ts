import { describe, expect, it } from 'vitest';
import { generateGraph, validateConfig } from '../generate';
import type { AssetGraph, Footprint, Level, TwinConfig } from '../model';
import { PRESETS } from '../presets';

const LEVELS = new Set<Level>(['plant', 'array', 'inverter', 'mppt', 'string', 'bess', 'container', 'rack']);
const EPSILON = 1e-9;

function overlaps(a: Footprint, b: Footprint): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function contains(outer: Footprint, inner: Footprint): boolean {
  return inner.x + EPSILON >= outer.x
    && inner.y + EPSILON >= outer.y
    && inner.x + inner.w <= outer.x + outer.w + EPSILON
    && inner.y + inner.h <= outer.y + outer.h + EPSILON;
}

function firstOverlap(items: { id: string; footprint: Footprint }[]): string | null {
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (overlaps(items[left].footprint, items[right].footprint)) return `${items[left].id} overlaps ${items[right].id}`;
    }
  }
  return null;
}

function footprint(graph: AssetGraph, id: string): Footprint {
  const value = graph.nodes[id].footprint;
  expect(value, `${id} should have a footprint`).toBeDefined();
  return value as Footprint;
}

describe.each(PRESETS)('generateGraph — $label preset', ({ config }) => {
  it('is deterministic', () => {
    expect(generateGraph(config)).toEqual(generateGraph(config));
  });

  it('has unique ids in a valid pre-order with reciprocal parent links', () => {
    const graph = generateGraph(config);
    expect(new Set(graph.order).size).toBe(graph.order.length);
    expect(graph.order).toHaveLength(Object.keys(graph.nodes).length);

    const positions = new Map(graph.order.map((id, index) => [id, index]));
    for (const id of graph.order) {
      const node = graph.nodes[id];
      expect(node, `${id} should exist in nodes`).toBeDefined();
      if (node.parentId) {
        expect(positions.get(node.parentId)).toBeLessThan(positions.get(id));
        expect(graph.nodes[node.parentId].childIds).toContain(id);
      }
    }
  });

  it('reports counts from configuration arithmetic', () => {
    const graph = generateGraph(config);
    const strings = config.pv.arrays
      * config.pv.invertersPerArray
      * config.pv.mpptPerInverter
      * config.pv.stringsPerMppt;
    const racks = (config.bess?.containers ?? 0) * (config.bess?.racksPerContainer ?? 0);
    expect(graph.counts).toEqual({
      arrays: config.pv.arrays,
      inverters: config.pv.arrays * config.pv.invertersPerArray,
      strings,
      modules: strings * config.pv.modulesPerString,
      containers: config.bess?.containers ?? 0,
      racks,
      cells: racks * (config.bess?.modulesPerRack ?? 0) * (config.bess?.cellsPerModule ?? 0),
    });
  });

  it('computes plant, array, and inverter nameplates arithmetically', () => {
    const graph = generateGraph(config);
    const expectedDcKw = graph.counts.modules * config.pv.moduleWp / 1000;
    expect(Math.abs((graph.nodes.PV.nameplate.dcKw ?? 0) - expectedDcKw)).toBeLessThanOrEqual(0.01);

    const arrays = graph.order.map((id) => graph.nodes[id]).filter((node) => node.level === 'array');
    const arrayDcKw = arrays.reduce((sum, node) => sum + (node.nameplate.dcKw ?? 0), 0);
    expect(Math.abs(arrayDcKw - (graph.nodes.PV.nameplate.dcKw ?? 0))).toBeLessThanOrEqual(0.01);

    for (const node of graph.order.map((id) => graph.nodes[id])) {
      if (node.level === 'inverter') expect(node.nameplate.acKw).toBe(config.pv.inverterAcKw);
    }
  });

  it('does not overlap string footprints in A1 or rack footprints in C1', () => {
    const graph = generateGraph(config);
    const strings = graph.order
      .map((id) => graph.nodes[id])
      .filter((node) => node.level === 'string' && node.id.startsWith('A1/'))
      .map((node) => ({ id: node.id, footprint: footprint(graph, node.id) }));
    expect(firstOverlap(strings)).toBeNull();

    const racks = (graph.nodes.C1?.childIds ?? []).map((id) => ({ id, footprint: footprint(graph, id) }));
    expect(firstOverlap(racks)).toBeNull();
  });

  it('keeps positioned equipment within its parent and the plant extent', () => {
    const graph = generateGraph(config);
    const extent: Footprint = { x: 0, y: 0, ...graph.extent };

    for (const id of graph.order) {
      const node = graph.nodes[id];
      if (node.footprint) expect(contains(extent, node.footprint), `${id} lies outside the extent`).toBe(true);

      if (node.level === 'string') {
        const arrayId = node.id.split('/')[0];
        expect(contains(footprint(graph, arrayId), footprint(graph, id)), `${id} lies outside ${arrayId}`).toBe(true);
      } else if (node.level === 'inverter') {
        expect(contains(footprint(graph, node.parentId as string), footprint(graph, id)), `${id} lies outside ${node.parentId}`).toBe(true);
      } else if (node.level === 'rack') {
        expect(contains(footprint(graph, node.parentId as string), footprint(graph, id)), `${id} lies outside ${node.parentId}`).toBe(true);
      }
    }
  });

  it('models modules and cells as counts rather than nodes', () => {
    const graph = generateGraph(config);
    for (const id of graph.order) {
      const node = graph.nodes[id];
      expect(LEVELS.has(node.level), `${id} has an unknown level`).toBe(true);
      expect(id).not.toMatch(/\/(?:MODULE|MOD|CELL)\d+$/i);
      if (node.level === 'string') expect(node.standsFor.modules).toBe(config.pv.modulesPerString);
    }
  });

  it('only gives platform identities to registered levels', () => {
    const graph = generateGraph(config);
    for (const id of graph.order) {
      const node = graph.nodes[id];
      expect(Boolean(node.platformRef), `${id} platformRef`).toBe(['plant', 'inverter', 'bess', 'rack'].includes(node.level));
    }
  });
});

describe('configuration validation', () => {
  const reference = PRESETS[0].config;
  const withPv = (patch: Partial<TwinConfig['pv']>): TwinConfig => ({
    ...reference,
    pv: { ...reference.pv, ...patch },
  });

  it('accepts every preset', () => {
    for (const preset of PRESETS) expect(validateConfig(preset.config), preset.label).toEqual([]);
  });

  it.each([
    ['zero arrays', withPv({ arrays: 0 })],
    ['fractional arrays', withPv({ arrays: 1.5 })],
    ['too few modules per string', withPv({ modulesPerString: 3 })],
    ['excessive ground coverage ratio', withPv({ gcr: 0.9 })],
    ['empty name', { ...reference, name: '   ' }],
  ])('rejects %s', (_label, config) => {
    expect(validateConfig(config)).not.toEqual([]);
  });

  it('names single-axis tracking in its rejection', () => {
    const invalid = withPv({ tracking: 'single_axis' as TwinConfig['pv']['tracking'] });
    expect(validateConfig(invalid).join(' ')).toMatch(/single-axis/i);
  });

  it('prevents graph generation from bypassing validation', () => {
    expect(() => generateGraph(withPv({ arrays: 0 }))).toThrow(/invalid twin configuration/i);
  });
});

it('generates the configurator maximum in under 500 ms', () => {
  const utility = PRESETS.find((preset) => preset.id === 'utility')?.config as TwinConfig;
  const maximum: TwinConfig = {
    ...utility,
    pv: {
      ...utility.pv,
      arrays: 16,
      invertersPerArray: 24,
      mpptPerInverter: 12,
      stringsPerMppt: 8,
      modulesPerString: 36,
    },
    bess: null,
  };

  const started = performance.now();
  const graph = generateGraph(maximum);
  const elapsedMs = performance.now() - started;

  expect(graph.counts.strings).toBe(36_864);
  expect(elapsedMs).toBeLessThan(500);
});
