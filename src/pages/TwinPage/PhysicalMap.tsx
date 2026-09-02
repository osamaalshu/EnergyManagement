import { type FC, type KeyboardEvent, useMemo } from 'react';
import type { AssetGraph, AssetNode, StateSnapshot } from '@/features/spatial-twin/model';
import { MODULE_W_M, descendants } from '@/features/spatial-twin/generate';
import { nodeCertainty } from '@/features/spatial-twin/bind';
import { FillDefs } from './fills';
import { paintFor, type Overlay } from '@/features/spatial-twin/paint';

// The site plan. Metres in, a drawing out. Two zoom levels only: the whole
// plant, or one array / one container. Modules are drawn as ticks inside a
// string, never as objects — there is nothing to know about one module yet.

interface Props {
  graph: AssetGraph;
  snapshot: StateSnapshot;
  overlay: Overlay;
  selectedId: string | null;
  focusId: string | null;
  onSelect: (id: string) => void;
  onFocus: (id: string | null) => void;
}

const PREFIX = 'map';
const NICE = [2, 5, 10, 20, 50, 100, 200, 500];

const PhysicalMap: FC<Props> = ({ graph, snapshot, overlay, selectedId, focusId, onSelect, onFocus }) => {
  const focus = focusId ? graph.nodes[focusId] : null;
  const vb = useMemo(() => {
    const fp = focus?.footprint ?? { x: 0, y: 0, w: graph.extent.w, h: graph.extent.h };
    const pad = Math.max(fp.w, fp.h) * 0.06 + 1;
    return { x: fp.x - pad, y: fp.y - pad, w: fp.w + 2 * pad, h: fp.h + 2 * pad };
  }, [focus, graph.extent]);

  const unit = vb.w / 140;
  const fs = vb.w / 72;
  const scaleLen = NICE.reduce((best, n) => (Math.abs(n - vb.w / 5) < Math.abs(best - vb.w / 5) ? n : best), NICE[0]);

  const visible = useMemo(() => {
    const ids = focus ? [focus.id, ...descendants(graph, focus.id)] : graph.order;
    return ids.map((id) => graph.nodes[id]).filter((n) => n.footprint);
  }, [graph, focus]);

  // What responds to a click at this zoom: blocks at plant level, leaves inside a block.
  const isClickable = (n: AssetNode) => {
    if (!focus) return n.level === 'array' || n.level === 'container' || n.level === 'inverter';
    return n.id !== focus.id;
  };
  const activate = (n: AssetNode) => {
    if (!focus && (n.level === 'array' || n.level === 'container')) onFocus(n.id);
    onSelect(n.id);
  };
  const onKey = (e: KeyboardEvent, n: AssetNode) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(n); }
  };

  const paint = (n: AssetNode) => {
    const s = snapshot.nodes[n.id];
    return paintFor(PREFIX, s.status, overlay === 'certainty' ? nodeCertainty(s) : s.statusProvenance, overlay);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio: `${vb.w} / ${vb.h}`, minHeight: 240, maxHeight: 560 }}
        className="w-full select-none"
        role="img"
        aria-label={focus ? `Plan of ${focus.label}` : `Plan of ${graph.config.name}`}
      >
        <FillDefs prefix={PREFIX} unit={unit} />
        <defs>
          <pattern id="map-modules" patternUnits="userSpaceOnUse" width={MODULE_W_M} height={1}>
            <line x1="0" y1="0" x2="0" y2="1" stroke="var(--twin-ground)" strokeWidth={0.06} />
          </pattern>
        </defs>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="var(--twin-ground)" />

        {visible.map((n) => {
          const fp = n.footprint!;
          const p = paint(n);
          const selected = n.id === selectedId;
          const clickable = isClickable(n);
          const isBlock = n.level === 'array' || n.level === 'container' || n.level === 'plant' || n.level === 'bess';
          if (n.level === 'plant' || n.level === 'bess') return null;
          return (
            <g
              key={n.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? `${n.label} (${n.id})` : undefined}
              onClick={clickable ? (e) => { e.stopPropagation(); activate(n); } : undefined}
              onKeyDown={clickable ? (e) => onKey(e, n) : undefined}
              className={clickable ? 'cursor-pointer outline-none focus-visible:[&>rect:first-child]:stroke-accent' : ''}
              style={{ pointerEvents: clickable ? 'auto' : 'none' }}
            >
              <title>{`${n.label} · ${n.id}`}</title>
              {isBlock ? (
                // A block is an outline; its strings / racks carry the paint.
                <rect x={fp.x} y={fp.y} width={fp.w} height={fp.h} fill={focus ? 'none' : 'var(--twin-block)'} stroke={selected ? 'var(--series-navy)' : 'var(--twin-outline)'} strokeWidth={selected ? 2 : 1} vectorEffect="non-scaling-stroke" rx={unit * 0.4} />
              ) : (
                <>
                  <rect x={fp.x} y={fp.y} width={fp.w} height={fp.h} fill={p.fill} stroke={selected ? 'var(--series-navy)' : p.stroke} strokeWidth={selected ? 2.5 : 0.8} strokeDasharray={p.strokeDasharray} vectorEffect="non-scaling-stroke" />
                  {focus && n.level === 'string' && (
                    <rect x={fp.x} y={fp.y} width={fp.w} height={fp.h} fill="url(#map-modules)" style={{ pointerEvents: 'none' }} />
                  )}
                </>
              )}
              {isBlock && (
                <text x={fp.x + unit * 0.6} y={fp.y - unit * 0.5} fontSize={fs} fontFamily="JetBrains Mono, monospace" fill="var(--muted-text)">{n.id}</text>
              )}
              {focus && (n.level === 'inverter' || n.level === 'rack') && fp.w > fs * 2 && (
                <text x={fp.x + fp.w / 2} y={fp.y + fp.h / 2 + fs * 0.35} fontSize={fs * 0.9} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fill="var(--twin-label)" style={{ pointerEvents: 'none' }}>{n.id.split('/').pop()}</text>
              )}
            </g>
          );
        })}

        {/* Scale bar and north arrow: a plan without them is a picture. */}
        <g fontSize={fs * 0.9} fill="var(--muted-text)" fontFamily="JetBrains Mono, monospace">
          <line x1={vb.x + unit * 2} y1={vb.y + vb.h - unit * 2} x2={vb.x + unit * 2 + scaleLen} y2={vb.y + vb.h - unit * 2} stroke="var(--muted-text)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <text x={vb.x + unit * 2} y={vb.y + vb.h - unit * 2.8}>{scaleLen} m</text>
          <text x={vb.x + vb.w - unit * 3} y={vb.y + unit * 2.6} textAnchor="middle">N</text>
          <line x1={vb.x + vb.w - unit * 3} y1={vb.y + unit * 8} x2={vb.x + vb.w - unit * 3} y2={vb.y + unit * 3.4} stroke="var(--muted-text)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polygon points={`${vb.x + vb.w - unit * 3},${vb.y + unit * 3.2} ${vb.x + vb.w - unit * 3.7},${vb.y + unit * 4.6} ${vb.x + vb.w - unit * 2.3},${vb.y + unit * 4.6}`} fill="var(--muted-text)" />
        </g>
      </svg>
      {focus && (
        <button
          type="button"
          onClick={() => onFocus(null)}
          className="absolute left-3 top-3 rounded-full border border-slate-200/70 bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
        >
          ← Whole plant
        </button>
      )}
    </div>
  );
};

export default PhysicalMap;
