// Electrical topology layout: a left-to-right layered tree. Pure geometry, no DOM.
//
// Collapsed nodes stand for their subtree ("24 strings"). Expanding is the
// reader's act, so the tree never explodes into thousands of boxes on open.

import type { AssetGraph, Level } from './model';
import { descendants } from './generate';

export interface TreeNode {
  id: string;
  level: Level;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
  hiddenDescendants: number;
}

export interface TreeEdge {
  from: string;
  to: string;
  d: string;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
}

export const TREE = { nodeW: 148, nodeH: 30, colGap: 44, rowGap: 8, pad: 12 } as const;

export function layoutTree(graph: AssetGraph, rootId: string, expanded: Set<string>): TreeLayout {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  let nextY = TREE.pad;
  let maxDepth = 0;

  const place = (id: string, depth: number): TreeNode => {
    const n = graph.nodes[id];
    maxDepth = Math.max(maxDepth, depth);
    const isExpanded = expanded.has(id) && n.childIds.length > 0;
    const node: TreeNode = {
      id, level: n.level, depth,
      x: TREE.pad + depth * (TREE.nodeW + TREE.colGap), y: 0,
      w: TREE.nodeW, h: TREE.nodeH,
      collapsed: !isExpanded && n.childIds.length > 0,
      hiddenDescendants: 0,
    };
    if (isExpanded) {
      const kids = n.childIds.map((k) => place(k, depth + 1));
      node.y = (kids[0].y + kids[kids.length - 1].y) / 2;
      for (const k of kids) edges.push({ from: id, to: k.id, d: elbow(node, k) });
    } else {
      node.y = nextY;
      nextY += TREE.nodeH + TREE.rowGap;
      node.hiddenDescendants = descendants(graph, id).length;
    }
    nodes.push(node);
    return node;
  };

  place(rootId, 0);
  // Edges were built before parent y was final for nested levels; rebuild them now.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) e.d = elbow(byId.get(e.from) as TreeNode, byId.get(e.to) as TreeNode);

  return {
    nodes,
    edges,
    width: TREE.pad * 2 + (maxDepth + 1) * TREE.nodeW + maxDepth * TREE.colGap,
    height: Math.max(nextY - TREE.rowGap + TREE.pad, TREE.nodeH + 2 * TREE.pad),
  };
}

function elbow(a: TreeNode, b: TreeNode): string {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = x1 + (x2 - x1) / 2;
  return `M${x1},${y1} H${mx} V${y2} H${x2}`;
}

/** Expand the ancestors of `id` (so it is visible) and `id` itself. */
export function expandTo(graph: AssetGraph, id: string, base: Set<string>): Set<string> {
  const out = new Set(base);
  let cur: string | null = id;
  while (cur) {
    out.add(cur);
    cur = graph.nodes[cur]?.parentId ?? null;
  }
  return out;
}
