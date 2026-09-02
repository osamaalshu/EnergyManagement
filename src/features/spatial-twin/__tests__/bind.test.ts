import { describe, expect, it } from 'vitest';
import referenceJson from '@/data/generated/pvBessData.json';
import type { PvBessData } from '@/features/pv-bess/pvBess';
import { applyScenario, attachReference, emptyState, INVERTER_FLAG_SHARE_ATTENTION, nodeCertainty, propagate } from '../bind';
import { descendants, generateGraph } from '../generate';
import { aggregateProvenance, type NodeState } from '../model';
import { PRESETS } from '../presets';

const referenceData = referenceJson as unknown as PvBessData;
const preset = (id: 'reference' | 'rooftop' | 'utility') => PRESETS.find((candidate) => candidate.id === id)!;

describe('emptyState', () => {
  it('keeps every status unavailable while retaining derived nameplates and one PV estimate', () => {
    const graph = generateGraph(preset('rooftop').config);
    const snapshot = emptyState(graph, referenceData);

    for (const id of graph.order) {
      const state = snapshot.nodes[id];
      expect(state.status, id).toBe('no_data');
      expect(state.statusProvenance, id).toBe('UNAVAILABLE');
      for (const [key, value] of Object.entries(graph.nodes[id].nameplate)) {
        expect(state.metrics, `${id} is missing ${key}`).toContainEqual(expect.objectContaining({ key, value, provenance: 'DERIVED' }));
      }
    }

    const estimates = snapshot.nodes.PV.metrics.filter((metric) => metric.provenance === 'ESTIMATED');
    expect(estimates).toHaveLength(1);
    expect(estimates[0].basis).toContain(referenceData.pv.site.location);
    expect(estimates[0].basis).toContain(String(referenceData.pv.site.year));
  });
});

describe('attachReference', () => {
  it('marks only the seven record-bearing inverters as measured', () => {
    const graph = generateGraph(preset('reference').config);
    const snapshot = attachReference(graph, referenceData);
    const measured = graph.order.filter((id) => snapshot.nodes[id].statusProvenance === 'MEASURED');

    expect(measured).toHaveLength(7);
    expect(measured.every((id) => graph.nodes[id].level === 'inverter')).toBe(true);
    expect(graph.order.filter((id) => ['string', 'mppt', 'array', 'plant'].includes(graph.nodes[id].level) && snapshot.nodes[id].statusProvenance === 'MEASURED')).toEqual([]);

    for (const inverterId of measured) {
      for (const id of descendants(graph, inverterId).filter((candidate) => graph.nodes[candidate].level === 'string')) {
        expect(snapshot.nodes[id]).toEqual(expect.objectContaining({ statusProvenance: 'DERIVED', statusSourceId: inverterId }));
      }
    }
    expect(snapshot.nodes.A1.statusProvenance).toBe('DERIVED');
    expect(snapshot.nodes.A1.statusBasis).toMatch(/^Worst of/);
    expect(snapshot.nodes.PV.statusProvenance).toBe('DERIVED');
    expect(snapshot.nodes.PV.statusBasis).toMatch(/^Worst of/);
  });

  it('leaves uncovered utility inverters, their strings, and later arrays unavailable', () => {
    const graph = generateGraph(preset('utility').config);
    const snapshot = attachReference(graph, referenceData);
    const inverters = graph.order.filter((id) => graph.nodes[id].level === 'inverter');

    expect(inverters.filter((id) => snapshot.nodes[id].statusProvenance === 'MEASURED')).toHaveLength(7);
    for (const inverterId of inverters.slice(7)) {
      expect(snapshot.nodes[inverterId], inverterId).toEqual(expect.objectContaining({ status: 'no_data', statusProvenance: 'UNAVAILABLE' }));
      for (const stringId of descendants(graph, inverterId).filter((id) => graph.nodes[id].level === 'string')) {
        expect(snapshot.nodes[stringId], stringId).toEqual(expect.objectContaining({ status: 'no_data', statusProvenance: 'UNAVAILABLE' }));
      }
    }
    expect(snapshot.nodes.A1).toEqual(expect.objectContaining({ statusProvenance: 'DERIVED' }));
    expect(snapshot.nodes.A1.statusBasis).toContain('7 of 12');
    expect(snapshot.nodes.A2).toEqual(expect.objectContaining({ status: 'no_data', statusProvenance: 'UNAVAILABLE' }));
  });

  it('uses the real flag shares and crosses the attention threshold when a record does', () => {
    expect(referenceData.inverterFleet.inverters).toHaveLength(7);
    for (const row of referenceData.inverterFleet.inverters) {
      const share = row.mediumFlags / row.rows;
      expect(share).toBeGreaterThan(0.008);
      expect(share).toBeLessThan(0.012);
    }

    const graph = generateGraph(preset('reference').config);
    const normal = attachReference(graph, referenceData);
    for (const id of graph.order.filter((candidate) => graph.nodes[candidate].level === 'inverter')) {
      expect(normal.nodes[id].status, id).toBe('ok');
    }

    const patched = structuredClone(referenceData);
    const row = patched.inverterFleet.inverters[0];
    row.mediumFlags = Math.floor(row.rows * INVERTER_FLAG_SHARE_ATTENTION) + 1;
    const attention = attachReference(graph, patched);
    const inverterId = 'A1/INV1';

    expect(attention.nodes[inverterId]).toEqual(expect.objectContaining({ status: 'attention', statusProvenance: 'MEASURED' }));
    for (const id of descendants(graph, inverterId).filter((candidate) => graph.nodes[candidate].level === 'string')) {
      expect(attention.nodes[id].status, id).toBe('attention');
    }
    expect(attention.nodes.A1.status).toBe('attention');
    expect(attention.nodes.PV.status).toBe('attention');
  });
});

describe('scenarios and propagation', () => {
  it('does not mutate its input or merge a string scenario into a measured ancestor', () => {
    const graph = generateGraph(preset('reference').config);
    const base = attachReference(graph, referenceData);
    const before = structuredClone(base);
    const targetId = 'A1/INV1/M1/S1';
    const result = applyScenario(graph, base, { kind: 'string_open_circuit', targetId });

    expect(base).toEqual(before);
    expect(result.nodes[targetId]).toEqual(expect.objectContaining({ status: 'attention', statusProvenance: 'SIMULATED' }));
    // Spec change after review (ADR §7): the scenario shows on every un-measured ancestor up to the measured inverter.
    expect(result.nodes['A1/INV1/M1']).toEqual(expect.objectContaining({ status: 'attention', statusProvenance: 'SIMULATED' }));
    expect(result.nodes['A1/INV1']).toEqual(expect.objectContaining({ status: 'ok', statusProvenance: 'MEASURED' }));
  });

  it('propagates an unblocked inverter scenario down and up through an empty state', () => {
    const graph = generateGraph(preset('reference').config);
    const targetId = 'A1/INV1';
    const result = applyScenario(graph, emptyState(graph, referenceData), { kind: 'inverter_offline', targetId });
    const expected = [targetId, ...descendants(graph, targetId), 'A1', 'PV'];

    for (const id of expected) {
      expect(result.nodes[id], id).toEqual(expect.objectContaining({ status: 'attention', statusProvenance: 'SIMULATED' }));
    }
  });

  it('aggregates provenance by simulation, estimation, derivation, then unavailability', () => {
    expect(aggregateProvenance(['MEASURED', 'SIMULATED', 'UNAVAILABLE'])).toBe('SIMULATED');
    expect(aggregateProvenance(['MEASURED', 'ESTIMATED', 'UNAVAILABLE'])).toBe('ESTIMATED');
    expect(aggregateProvenance(['MEASURED', 'MEASURED'])).toBe('DERIVED');
    expect(aggregateProvenance(['UNAVAILABLE', 'UNAVAILABLE'])).toBe('UNAVAILABLE');
  });

  it('guards scenario levels and permits a rooftop rack-hot scenario', () => {
    const referenceGraph = generateGraph(preset('reference').config);
    expect(() => applyScenario(referenceGraph, emptyState(referenceGraph, referenceData), {
      kind: 'string_open_circuit',
      targetId: 'A1/INV1',
    })).toThrow(/needs a string, got inverter/i);

    const rooftopGraph = generateGraph(preset('rooftop').config);
    const result = applyScenario(rooftopGraph, emptyState(rooftopGraph, referenceData), { kind: 'rack_hot', targetId: 'C1/R1' });
    expect(result.nodes['C1/R1']).toEqual(expect.objectContaining({ status: 'attention', statusProvenance: 'SIMULATED' }));
  });

  it('is idempotent when propagating the same own-source set', () => {
    const graph = generateGraph(preset('reference').config);
    const snapshot = attachReference(graph, referenceData);
    const own = new Set(graph.order.filter((id) => snapshot.nodes[id].statusProvenance === 'MEASURED'));

    propagate(graph, snapshot, own);
    const once = structuredClone(snapshot);
    propagate(graph, snapshot, own);
    expect(snapshot).toEqual(once);
  });
});

describe('nodeCertainty', () => {
  const state = (patch: Partial<NodeState>): NodeState => ({
    status: 'no_data',
    statusProvenance: 'UNAVAILABLE',
    statusBasis: 'test',
    metrics: [],
    ...patch,
  });

  it('uses derived metrics when status is unavailable', () => {
    expect(nodeCertainty(state({ metrics: [{ key: 'dcKw', label: 'DC', value: 1, unit: 'kW', provenance: 'DERIVED', basis: 'test' }] }))).toBe('DERIVED');
  });

  it('prefers a measured status', () => {
    expect(nodeCertainty(state({ status: 'ok', statusProvenance: 'MEASURED' }))).toBe('MEASURED');
  });
});
