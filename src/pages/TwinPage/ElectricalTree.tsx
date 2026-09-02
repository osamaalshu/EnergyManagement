import { type FC, type KeyboardEvent, useMemo } from 'react';
import type { AssetGraph, StateSnapshot } from '@/features/spatial-twin/model';
import { layoutTree, TREE } from '@/features/spatial-twin/layout';
import { nodeCertainty } from '@/features/spatial-twin/bind';
import { FillDefs } from './fills';
import { paintFor, type Overlay } from '@/features/spatial-twin/paint';

// What feeds what. Left is the grid side, right is the sun side. A collapsed
// box stands for everything behind it and says how much.

interface Props {
  graph: AssetGraph;
  snapshot: StateSnapshot;
  overlay: Overlay;
  rootId: string;
  expanded: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

const PREFIX = 'tree';

const ElectricalTree: FC<Props> = ({ graph, snapshot, overlay, rootId, expanded, selectedId, onSelect, onToggle }) => {
  const lay = useMemo(() => layoutTree(graph, rootId, expanded), [graph, rootId, expanded]);

  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); onToggle(id); }
  };

  return (
    <div className="max-h-[520px] overflow-auto">
      <svg width={lay.width} height={lay.height} role="img" aria-label={`Electrical connections of ${graph.nodes[rootId].label}`} className="select-none">
        <FillDefs prefix={PREFIX} unit={6} />
        {lay.edges.map((e) => (
          <path key={`${e.from}-${e.to}`} d={e.d} fill="none" stroke="var(--twin-outline)" strokeWidth={1.2} />
        ))}
        {lay.nodes.map((n) => {
          const node = graph.nodes[n.id];
          const s = snapshot.nodes[n.id];
          const p = paintFor(PREFIX, s.status, overlay === 'certainty' ? nodeCertainty(s) : s.statusProvenance, overlay);
          const selected = n.id === selectedId;
          const count = n.collapsed ? n.hiddenDescendants : 0;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.label} (${node.id})${n.collapsed ? `, ${count} behind it` : ''}`}
              aria-expanded={node.childIds.length ? !n.collapsed : undefined}
              onClick={() => { onSelect(n.id); onToggle(n.id); }}
              onKeyDown={(e) => onKey(e, n.id)}
              className="cursor-pointer outline-none focus-visible:[&>rect:first-child]:stroke-accent"
            >
              <title>{`${node.label} · ${node.id}`}</title>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={6} fill="var(--card-bg)" stroke={selected ? 'var(--series-navy)' : 'var(--twin-outline)'} strokeWidth={selected ? 2 : 1} />
              <rect x={n.x + 4} y={n.y + 4} width={10} height={n.h - 8} rx={2} fill={p.fill} stroke={p.stroke} strokeDasharray={p.strokeDasharray} strokeWidth={0.8} />
              <text x={n.x + 20} y={n.y + n.h / 2 + 4} fontSize={11.5} fontFamily="JetBrains Mono, monospace" fill="var(--twin-label)">{node.id.split('/').pop()}</text>
              {n.collapsed && (
                <text x={n.x + n.w - 8} y={n.y + n.h / 2 + 4} fontSize={10.5} textAnchor="end" fill="var(--muted-text)">{count} ›</text>
              )}
            </g>
          );
        })}
        {/* Column captions from the level of the first node in each column. */}
        {Array.from(new Set(lay.nodes.map((n) => n.depth))).map((d) => {
          const first = lay.nodes.find((n) => n.depth === d);
          if (!first) return null;
          return (
            <text key={d} x={TREE.pad + d * (TREE.nodeW + TREE.colGap)} y={lay.height - 2} fontSize={10} fill="var(--muted-text)" className="uppercase tracking-[0.15em]">
              {first.level}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default ElectricalTree;
