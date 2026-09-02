// State binding: records → node states, then the propagation rules.
//
// Three sources of belief, kept apart:
//   • the configuration          → nameplate numbers, DERIVED (sum of parts);
//   • the reference dataset      → inverter records, MEASURED at the inverter,
//                                  carried down as DERIVED, summed up as DERIVED;
//   • an injected scenario       → SIMULATED at the target, and SIMULATED
//                                  wherever it is carried. It never becomes anything else.
//
// A value is set at its own node ("own"), carried from an ancestor ("inherited")
// or summarised from descendants ("aggregated"). Own beats inherited beats
// aggregated. An inherited status names the node it came from so the panel can
// say "carried from Inverter 3", not "measured".

import type { PvBessData } from '@/features/pv-bess/pvBess';
import { aggregateProvenance, type AssetGraph, type Metric, type NodeState, type Provenance, type Scenario, type StateSnapshot, type Status, SCENARIO_LEVEL } from './model';
import { descendants } from './generate';

/** Share of readings carrying a medium-severity flag above which an inverter needs a look. */
export const INVERTER_FLAG_SHARE_ATTENTION = 0.015;

const STATUS_RANK: Record<Status, number> = { no_data: 0, ok: 1, attention: 2 };

function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((acc, s) => (STATUS_RANK[s] > STATUS_RANK[acc] ? s : acc), 'no_data');
}

function nameplateMetrics(graph: AssetGraph, id: string): Metric[] {
  const n = graph.nodes[id];
  const pv = graph.config.pv;
  const out: Metric[] = [];
  const b = graph.config.bess;
  const rackCount = !b ? 0 : n.level === 'rack' ? 1 : n.level === 'container' ? b.racksPerContainer : b.containers * b.racksPerContainer;
  const parts = n.domain === 'pv'
    ? `${n.standsFor.modules?.toLocaleString()} modules × ${pv.moduleWp} W from the configuration`
    : `${rackCount} ${rackCount === 1 ? 'rack' : 'racks'} × ${b?.rackKwh} kWh from the configuration`;
  if (n.nameplate.dcKw !== undefined) out.push({ key: 'dcKw', label: 'Nameplate DC', value: n.nameplate.dcKw, unit: 'kW', provenance: 'DERIVED', basis: parts });
  if (n.nameplate.acKw !== undefined) out.push({ key: 'acKw', label: 'Inverter AC', value: n.nameplate.acKw, unit: 'kW', provenance: 'DERIVED', basis: `${n.level === 'inverter' ? 'Rated' : 'Sum of rated'} inverter output from the configuration` });
  if (n.nameplate.energyKwh !== undefined) out.push({ key: 'energyKwh', label: 'Energy capacity', value: n.nameplate.energyKwh, unit: 'kWh', provenance: 'DERIVED', basis: parts });
  if (n.nameplate.powerKw !== undefined) out.push({ key: 'powerKw', label: 'Power', value: n.nameplate.powerKw, unit: 'kW', provenance: 'DERIVED', basis: `Sum of rack power from the configuration` });
  return out;
}

function expectedYieldMetric(graph: AssetGraph, data: PvBessData): Metric {
  const dcKw = graph.nodes.PV.nameplate.dcKw ?? 0;
  const y = data.pv.annual.specificYieldKwhPerKwp;
  const site = data.pv.site;
  return {
    key: 'expectedKwhYear',
    label: 'Yearly energy, if it performed like the reference plant',
    value: Math.round(dcKw * y),
    unit: 'kWh',
    provenance: 'ESTIMATED',
    basis: `Your ${dcKw} kW nameplate × ${y.toLocaleString()} kWh per kWp measured at ${site.location} in ${site.year} on a ${site.tracking === 'dual_axis' ? 'dual-axis tracking' : 'fixed'} array. Your sun, tilt and temperatures will differ.`,
  };
}

/** A configured plant with nothing attached: nameplates only, every status unknown. */
export function emptyState(graph: AssetGraph, data: PvBessData): StateSnapshot {
  const nodes: Record<string, NodeState> = {};
  for (const id of graph.order) {
    nodes[id] = {
      status: 'no_data',
      statusProvenance: 'UNAVAILABLE',
      statusBasis: 'No records are attached to this plant.',
      metrics: nameplateMetrics(graph, id),
    };
  }
  nodes.PV.metrics.push(expectedYieldMetric(graph, data));
  return { source: 'none', sourceLabel: 'No records attached', asOf: null, scenario: null, nodes };
}

/**
 * Attach the reference plant's inverter records to the first inverters of this
 * plant, in traversal order. Everything the records do not cover stays unknown.
 */
export function attachReference(graph: AssetGraph, data: PvBessData): StateSnapshot {
  const snap = emptyState(graph, data);
  const inverters = graph.order.filter((id) => graph.nodes[id].level === 'inverter');
  const rows = data.inverterFleet.inverters;
  const n = Math.min(inverters.length, rows.length);
  const covered: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const id = inverters[i];
    const r = rows[i];
    // A record with no readings is not a measurement; the node stays unknown.
    if (!(r.rows > 0)) continue;
    covered.push(id);
    const flagShare = r.mediumFlags / r.rows;
    const status: Status = flagShare > INVERTER_FLAG_SHARE_ATTENTION ? 'attention' : 'ok';
    snap.nodes[id] = {
      status,
      statusProvenance: 'MEASURED',
      statusBasis: `${(flagShare * 100).toFixed(1)} % of ${r.rows.toLocaleString()} readings carried a flag (limit ${(INVERTER_FLAG_SHARE_ATTENTION * 100).toFixed(1)} %). Record: ${r.id}, ${data.inverterFleet.source}.`,
      metrics: [
        ...snap.nodes[id].metrics,
        { key: 'effMedian', label: 'Typical efficiency', value: r.efficiencyMedian * 100, unit: '%', provenance: 'MEASURED', basis: `Median DC-to-AC efficiency over ${r.rows.toLocaleString()} readings, record ${r.id}` },
        { key: 'effP10', label: 'Worst 10 %', value: r.efficiencyP10 * 100, unit: '%', provenance: 'MEASURED', basis: `10th percentile of the same readings` },
        { key: 'flags', label: 'Flagged readings', value: r.mediumFlags, unit: '', provenance: 'MEASURED', basis: `Readings the fault rules marked medium severity` },
      ],
    };
  }
  snap.source = 'reference';
  snap.sourceLabel = `${data.inverterFleet.source} · attached to ${covered.length} of ${inverters.length} inverters`;
  snap.asOf = data.meta.asOf;
  propagate(graph, snap, new Set(covered));
  return snap;
}

const SCENARIO_EFFECT: Record<Scenario['kind'], { basis: string; metric: Metric }> = {
  string_open_circuit: {
    basis: 'Simulated open circuit: this string delivers nothing.',
    metric: { key: 'outputKw', label: 'Output', value: 0, unit: 'kW', provenance: 'SIMULATED', basis: 'Simulated open circuit' },
  },
  array_soiled: {
    basis: 'Simulated soiling on every string in this array.',
    metric: { key: 'shortfallPct', label: 'Shortfall against expected', value: -8, unit: '%', provenance: 'SIMULATED', basis: 'A typical dust layer in a dry climate; the number is illustrative' },
  },
  inverter_offline: {
    basis: 'Simulated trip: this inverter and everything behind it is off.',
    metric: { key: 'outputKw', label: 'Output', value: 0, unit: 'kW', provenance: 'SIMULATED', basis: 'Simulated inverter trip' },
  },
  rack_hot: {
    basis: 'Simulated: this rack runs 12 °C above its neighbours.',
    metric: { key: 'tempC', label: 'Temperature', value: 47, unit: '°C', provenance: 'SIMULATED', basis: 'Simulated cell temperature; neighbours at 35 °C' },
  },
};

/** Inject one scenario on top of a snapshot. Returns a new snapshot; the input is untouched. */
export function applyScenario(graph: AssetGraph, base: StateSnapshot, scenario: Scenario | null): StateSnapshot {
  const nodes: Record<string, NodeState> = {};
  for (const id of graph.order) nodes[id] = { ...base.nodes[id], metrics: [...base.nodes[id].metrics] };
  const snap: StateSnapshot = { ...base, scenario, nodes };
  if (!scenario) return snap;
  const target = graph.nodes[scenario.targetId];
  if (!target || target.level !== SCENARIO_LEVEL[scenario.kind]) {
    throw new Error(`Scenario ${scenario.kind} needs a ${SCENARIO_LEVEL[scenario.kind]}, got ${target?.level ?? 'nothing'}`);
  }
  const effect = SCENARIO_EFFECT[scenario.kind];
  nodes[scenario.targetId] = {
    status: 'attention',
    statusProvenance: 'SIMULATED',
    statusBasis: effect.basis,
    metrics: [...nodes[scenario.targetId].metrics.filter((m) => m.key !== effect.metric.key), effect.metric],
  };
  // Own sources: every node that was measured or simulated at itself.
  const own = new Set<string>();
  for (const id of graph.order) {
    const p = nodes[id].statusProvenance;
    if ((p === 'MEASURED' || p === 'SIMULATED') && !nodes[id].statusSourceId) own.add(id);
  }
  propagate(graph, snap, own);
  return snap;
}

/**
 * Carry status through the graph.
 *  1. Down: a node without its own source takes its nearest sourced ancestor's
 *     status, provenance weakened one step (MEASURED → DERIVED; SIMULATED stays).
 *  2. Up: a node still unset summarises its children — worst status, weakest
 *     provenance — or stays unknown when no child knows anything. A node that
 *     inherited its status from above is re-summarised only when a child is
 *     SIMULATED: a scenario is visible on every un-measured ancestor up to, and
 *     not including, the first measured one. The measurement is what the sensor said.
 * Nodes in `own` are never overwritten.
 */
export function propagate(graph: AssetGraph, snap: StateSnapshot, own: Set<string>): void {
  const set = new Set<string>(own);
  // Reset everything that is not its own source so re-propagation is idempotent.
  for (const id of graph.order) {
    if (own.has(id)) continue;
    snap.nodes[id] = {
      ...snap.nodes[id],
      status: 'no_data',
      statusProvenance: 'UNAVAILABLE',
      statusBasis: 'No records cover this level.',
      statusSourceId: undefined,
    };
  }
  // 1. Down.
  for (const src of own) {
    const srcState = snap.nodes[src];
    const srcNode = graph.nodes[src];
    const carried: Provenance = aggregateProvenance([srcState.statusProvenance]);
    for (const id of descendants(graph, src)) {
      if (own.has(id)) continue; // a nearer source below wins for its own subtree
      // Skip if a nearer own source sits between src and id.
      if (hasOwnBetween(graph, id, src, own)) continue;
      snap.nodes[id] = {
        ...snap.nodes[id],
        status: srcState.status,
        statusProvenance: carried,
        statusBasis: `Carried from ${srcNode.label} (${srcNode.id}). Nothing is measured at this level.`,
        statusSourceId: src,
      };
      set.add(id);
    }
  }
  // 2. Up, post-order (reverse of pre-order works for a forest).
  for (let i = graph.order.length - 1; i >= 0; i -= 1) {
    const id = graph.order[i];
    if (own.has(id)) continue;
    const kids = graph.nodes[id].childIds.filter((k) => set.has(k));
    if (kids.length === 0) continue;
    const provs = kids.map((k) => snap.nodes[k].statusProvenance);
    const simulatedBelow = provs.includes('SIMULATED');
    if (set.has(id) && !simulatedBelow) continue; // inherited from above, nothing simulated beneath
    const statuses = kids.map((k) => snap.nodes[k].status);
    const prov = aggregateProvenance(provs);
    const known = kids.filter((k) => snap.nodes[k].statusProvenance !== 'UNAVAILABLE').length;
    snap.nodes[id] = {
      ...snap.nodes[id],
      status: worst(statuses),
      statusProvenance: prov,
      statusBasis: simulatedBelow
        ? `Worst of ${known} of ${graph.nodes[id].childIds.length} children; a simulated fault sits beneath this node.`
        : `Worst of ${known} of ${graph.nodes[id].childIds.length} children with a known state.`,
      statusSourceId: undefined,
    };
    set.add(id);
  }
}

function hasOwnBetween(graph: AssetGraph, id: string, ancestor: string, own: Set<string>): boolean {
  let cur = graph.nodes[id].parentId;
  while (cur && cur !== ancestor) {
    if (own.has(cur)) return true;
    cur = graph.nodes[cur].parentId;
  }
  return false;
}

/** The strongest provenance visible on a node: its status, else its best metric. */
export function nodeCertainty(state: NodeState): Provenance {
  if (state.statusProvenance !== 'UNAVAILABLE') return state.statusProvenance;
  const provs = state.metrics.map((m) => m.provenance);
  for (const p of ['MEASURED', 'DERIVED', 'ESTIMATED', 'SIMULATED'] as Provenance[]) if (provs.includes(p)) return p;
  return 'UNAVAILABLE';
}
