import type { FC } from 'react';
import type { CompressorSeriesPoint } from '@/features/compressor-pilot/compressor';

/** Live gas-compression train: scrubber → suction → compressor → discharge → aftercooler,
 *  with a recycle/anti-surge loop. Click a node to see its parameters below. */
export type CmpStage = 'suction' | 'compressor' | 'discharge';

const VB_W = 960;
const VB_H = 340;
const RUN = '#34d399';
const WARN = '#f87171';
const GAS = '#f59e0b';
const SEL = '#22d3ee';

const f = (v: number | null, d = 1) => (v === null || v === undefined ? '—' : v.toFixed(d));

const Box: FC<{
  x: number; y: number; w: number; h: number; title: string; rows: [string, string][];
  big?: boolean; stroke?: string; selected?: boolean; onClick?: () => void;
}> = ({ x, y, w, h, title, rows, big, stroke, selected, onClick }) => (
  <g style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={onClick}
     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}>
    <rect x={x} y={y} width={w} height={h} rx={10} fill="var(--sch-node-bg)"
      stroke={selected ? SEL : (stroke ?? 'var(--sch-node-border)')} strokeWidth={selected ? 2.6 : (stroke ? 2 : 1.5)}
      style={selected ? { filter: 'drop-shadow(0 0 8px rgba(34,211,238,.35))' } : undefined} />
    <text x={x + w / 2} y={y + 22} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--sch-text-primary)">{title}</text>
    {rows.map(([k, v], i) => (
      <text key={k} x={x + w / 2} y={y + (big ? 58 : 50) + i * (big ? 30 : 22)} textAnchor="middle" fill="var(--sch-text-primary)">
        <tspan fontSize={big ? 22 : 15} fontWeight={700}>{v}</tspan>
        <tspan fontSize={10} fill="var(--sch-text-secondary)"> {k}</tspan>
      </text>
    ))}
  </g>
);

const CompressorSchematic: FC<{
  point: CompressorSeriesPoint; designPolyEff: number | null;
  selected: CmpStage; onSelect: (s: CmpStage) => void;
}> = ({ point, designPolyEff, selected, onSelect }) => {
  const low = point.etaPoly !== null && designPolyEff !== null && point.etaPoly < designPolyEff * 0.9;
  const compStroke = low ? WARN : RUN;
  const flowK = point.gasFlow !== null ? `${(point.gasFlow / 1000).toFixed(0)}k` : '—';

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" className="max-h-[340px]" role="img" aria-label="Gas compressor train schematic — click a stage">
      <defs>
        <marker id="cmp-gas" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0L8,3L0,6Z" fill={GAS} /></marker>
      </defs>

      <path d="M 850 120 L 850 46 L 130 46 L 130 120" fill="none" stroke="var(--sch-text-secondary)" strokeWidth={1.6} strokeDasharray="6 5" opacity={0.6} markerEnd="url(#cmp-gas)" />
      <text x={490} y={40} textAnchor="middle" fontSize={10} fill="var(--sch-text-secondary)" opacity={0.7}>recycle / anti-surge (R-CS-02)</text>

      <line x1={220} y1={175} x2={380} y2={175} stroke={GAS} strokeWidth={3} markerEnd="url(#cmp-gas)" />
      <line x1={600} y1={175} x2={760} y2={175} stroke={GAS} strokeWidth={3} markerEnd="url(#cmp-gas)" />
      <line x1={940} y1={175} x2={954} y2={175} stroke={GAS} strokeWidth={3} markerEnd="url(#cmp-gas)" />
      <text x={300} y={163} textAnchor="middle" fontSize={11} fontWeight={600} fill={GAS}>{flowK} Nm³/hr</text>
      <text x={680} y={163} textAnchor="middle" fontSize={10} fill="var(--sch-text-secondary)">compressed gas →</text>

      <Box x={40} y={120} w={180} h={110} title="Suction / scrubber" selected={selected === 'suction'} onClick={() => onSelect('suction')}
        rows={[['bar a', f(point.suctionP, 1)], ['°C', f(point.suctionT, 0)]]} />
      <Box x={380} y={95} w={220} h={160} title="Compressor" big stroke={compStroke} selected={selected === 'compressor'} onClick={() => onSelect('compressor')}
        rows={[['kW', f(point.actualKw, 0)], ['η_poly', f(point.etaPoly, 3)], ['ratio', f(point.compressionRatio, 2)]]} />
      <Box x={760} y={120} w={180} h={110} title="Discharge / aftercooler" selected={selected === 'discharge'} onClick={() => onSelect('discharge')}
        rows={[['bar a', f(point.dischargeP, 1)], ['°C', f(point.dischargeT, 0)]]} />

      <rect x={460} y={222} width={60} height={20} rx={10} fill={`${compStroke}25`} stroke={`${compStroke}55`} />
      <text x={490} y={236} textAnchor="middle" fontSize={10} fontWeight={600} fill={compStroke}>{low ? 'Degraded' : 'Healthy'}</text>

      <text x={490} y={300} textAnchor="middle" fontSize={9.5} fill="var(--sch-text-secondary)" opacity={0.7}>Click a stage to see its parameters below</text>
    </svg>
  );
};

export default CompressorSchematic;
