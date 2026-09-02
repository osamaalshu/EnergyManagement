import { describe, expect, it } from 'vitest';
import { descendants, generateGraph } from '../generate';
import { expandTo, layoutTree } from '../layout';
import { PRESETS } from '../presets';

const graph = generateGraph(PRESETS[0].config);

describe('layoutTree', () => {
  it('represents a collapsed root as one node with its descendant count', () => {
    const layout = layoutTree(graph, 'PV', new Set());
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0]).toEqual(expect.objectContaining({ id: 'PV', collapsed: true, hiddenDescendants: descendants(graph, 'PV').length }));
  });

  it('shows only the root and its children when just the root is expanded', () => {
    const layout = layoutTree(graph, 'PV', new Set(['PV']));
    expect(new Set(layout.nodes.map((node) => node.id))).toEqual(new Set(['PV', ...graph.nodes.PV.childIds]));
  });

  it('produces valid edges and non-overlapping rows with parents centred among visible children', () => {
    const expanded = new Set(graph.order);
    const layout = layoutTree(graph, 'PV', expanded);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));

    for (const edge of layout.edges) {
      expect(byId.has(edge.from), edge.from).toBe(true);
      expect(byId.has(edge.to), edge.to).toBe(true);
    }

    const depths = new Set(layout.nodes.map((node) => node.depth));
    for (const depth of depths) {
      const row = layout.nodes.filter((node) => node.depth === depth).sort((left, right) => left.y - right.y);
      for (let index = 1; index < row.length; index += 1) {
        expect(row[index].y, `${row[index - 1].id} overlaps ${row[index].id}`).toBeGreaterThanOrEqual(row[index - 1].y + row[index - 1].h);
      }
    }

    for (const parent of layout.nodes.filter((node) => graph.nodes[node.id].childIds.length > 0)) {
      const children = graph.nodes[parent.id].childIds.map((id) => byId.get(id)).filter((node) => node !== undefined);
      if (children.length > 0) {
        expect(parent.y).toBeGreaterThanOrEqual(children[0].y);
        expect(parent.y).toBeLessThanOrEqual(children[children.length - 1].y);
      }
    }
  });
});

it('expandTo includes the target, all ancestors, and the base expansion', () => {
  const targetId = 'A1/INV2/M2/S3';
  expect(expandTo(graph, targetId, new Set(['unrelated']))).toEqual(new Set(['unrelated', targetId, 'A1/INV2/M2', 'A1/INV2', 'A1', 'PV']));
});
