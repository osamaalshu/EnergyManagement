import { type FC, useMemo } from 'react';
import type { Equipment, EquipmentStatus } from '../types/portfolio';

interface ChillerPlantSchematicProps {
  equipment: Equipment[];
  onNavigateToEquipment: (equipmentId: string) => void;
}

/* ── Status palette ──────────────────────────────────── */
const STATUS_FILL: Record<EquipmentStatus, string> = {
  running: '#34d399',
  off:     '#94a3b8',
  warning: '#f87171',
};
const STATUS_LABEL: Record<EquipmentStatus, string> = {
  running: 'Running',
  off:     'Off',
  warning: 'Warning',
};

/* ── Pipe colours ────────────────────────────────────── */
const COND  = '#eab308'; // yellow-500  – condenser water
const CHW   = '#38bdf8'; // sky-400     – chilled water

/* ── ViewBox ─────────────────────────────────────────── */
const VB_W = 960;
const VB_H = 560;

/* ── Cooling tower boxes ─────────────────────────────── */
const CT_W = 72;
const CT_H = 52;
const CT_INNER_GAP = 6;
const CT_Y = 14;
const CT_GROUP_W = 3 * CT_W + 2 * CT_INNER_GAP; // 228

/* Three alignment centres (tower-group ↔ chiller) */
const CX = [232, 480, 728];

const ctGroupX  = (g: number) => CX[g] - CT_GROUP_W / 2;
const ctBoxX    = (g: number, c: number) => ctGroupX(g) + c * (CT_W + CT_INNER_GAP);
const ctCenterX = (g: number, c: number) => ctBoxX(g, c) + CT_W / 2;

/* ── Chiller boxes ───────────────────────────────────── */
const CH_W = 182;
const CH_H = 132;
const CH_Y = 185;
const chX = (i: number) => CX[i] - CH_W / 2;

/* ── Pump ────────────────────────────────────────────── */
const PUMP_W = 180;
const PUMP_H = 56;
const PUMP_X = VB_W / 2 - PUMP_W / 2;
const PUMP_Y = 400;

/* ── Manifold Y positions (between sections) ─────────── */
const COND_MAN_Y = Math.round((CT_Y + CT_H + CH_Y) / 2);     // ≈ 125
const CHW_MAN_Y  = Math.round((CH_Y + CH_H + PUMP_Y) / 2);   // ≈ 358

/* ── Summary bar ─────────────────────────────────────── */
const SUM_Y = 484;
const SUM_H = 36;

/* ════════════════════════════════════════════════════════ */

const ChillerPlantSchematic: FC<ChillerPlantSchematicProps> = ({
  equipment,
  onNavigateToEquipment,
}) => {
  const { chillers, coolingTowers, pumps } = useMemo(
    () => ({
      chillers:      equipment.filter((e) => e.type === 'chiller'),
      coolingTowers: equipment.filter((e) => e.type === 'coolingTower'),
      pumps:         equipment.filter((e) => e.type === 'pump'),
    }),
    [equipment],
  );

  const pump = pumps[0];

  /* aggregate stats for the summary bar */
  const totalPower = useMemo(
    () =>
      equipment
        .filter((e) => e.type === 'chiller' || e.type === 'pump')
        .reduce((s, e) => s + e.primaryValue, 0),
    [equipment],
  );
  const allRunning = equipment.every((e) => e.status === 'running');

  const activate = (id: string) => () => onNavigateToEquipment(id);
  const keyDown  = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigateToEquipment(id);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      className="max-h-[560px]"
      role="img"
      aria-label="Chiller plant schematic showing equipment connections"
    >
      {/* ── Hover / focus ────────────────────────── */}
      <style>{`
        .cps-n{cursor:pointer}
        .cps-n>.cps-bg{transition:stroke .15s,filter .15s}
        .cps-n:hover>.cps-bg,.cps-n:focus>.cps-bg{
          stroke:#22d3ee;stroke-width:2.2;
          filter:drop-shadow(0 0 8px rgba(34,211,238,.35))
        }
        .cps-n:focus{outline:none}
        .cps-n:focus>.cps-bg{stroke-width:2.5}
      `}</style>

      {/* ── Arrow markers ────────────────────────── */}
      <defs>
        <marker id="a-cond" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <path d="M0,0L7,2.5L0,5Z" fill={COND} />
        </marker>
        <marker id="a-chw" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <path d="M0,0L7,2.5L0,5Z" fill={CHW} />
        </marker>
      </defs>

      {/* ═══════════════════════════════════════════
          CONDENSER WATER PIPES  (gold / yellow)
          Chiller top → manifold → branch to towers
         ═══════════════════════════════════════════ */}
      {[0, 1, 2].map((gi) => {
        const cx = CX[gi];
        const n  = Math.min(3, coolingTowers.length - gi * 3);
        if (n <= 0) return null;
        return (
          <g key={`cp-${gi}`}>
            {/* trunk: chiller top → condenser manifold */}
            <line
              x1={cx} y1={CH_Y}
              x2={cx} y2={COND_MAN_Y}
              stroke={COND} strokeWidth={2} opacity={0.85}
            />
            {/* horizontal manifold across tower group */}
            <line
              x1={ctCenterX(gi, 0)}     y1={COND_MAN_Y}
              x2={ctCenterX(gi, n - 1)} y2={COND_MAN_Y}
              stroke={COND} strokeWidth={2} opacity={0.85}
            />
            {/* branches: manifold → each tower */}
            {Array.from({ length: n }).map((_, ci) => (
              <line
                key={ci}
                x1={ctCenterX(gi, ci)} y1={COND_MAN_Y}
                x2={ctCenterX(gi, ci)} y2={CT_Y + CT_H}
                stroke={COND} strokeWidth={2} opacity={0.85}
                markerEnd="url(#a-cond)"
              />
            ))}
          </g>
        );
      })}

      {/* condenser loop label */}
      <text
        x={88}
        y={COND_MAN_Y + 4}
        textAnchor="middle"
        fontSize={8.5}
        fontWeight={500}
        fill={COND}
        opacity={0.75}
        transform={`rotate(-90,88,${COND_MAN_Y + 4})`}
      >
        Condenser Water Loop
      </text>

      {/* ═══════════════════════════════════════════
          CHILLED WATER PIPES  (sky blue)
          Chiller bottom → manifold → pump
         ═══════════════════════════════════════════ */}
      {chillers.map((_, i) => (
        <line
          key={`cw-${i}`}
          x1={CX[i]} y1={CH_Y + CH_H}
          x2={CX[i]} y2={CHW_MAN_Y}
          stroke={CHW} strokeWidth={2} opacity={0.85}
          markerEnd="url(#a-chw)"
        />
      ))}
      {/* horizontal manifold */}
      {chillers.length > 1 && (
        <line
          x1={CX[0]}                             y1={CHW_MAN_Y}
          x2={CX[Math.min(2, chillers.length - 1)]} y2={CHW_MAN_Y}
          stroke={CHW} strokeWidth={2} opacity={0.85}
        />
      )}
      {/* manifold → pump */}
      <line
        x1={VB_W / 2} y1={CHW_MAN_Y}
        x2={VB_W / 2} y2={PUMP_Y}
        stroke={CHW} strokeWidth={2} opacity={0.85}
        markerEnd="url(#a-chw)"
      />

      {/* chilled water loop label */}
      <text
        x={88}
        y={CHW_MAN_Y + 4}
        textAnchor="middle"
        fontSize={8.5}
        fontWeight={500}
        fill={CHW}
        opacity={0.75}
        transform={`rotate(-90,88,${CHW_MAN_Y + 4})`}
      >
        Chilled Water Loop
      </text>

      {/* ═══════════════════════════════════════════
          COOLING TOWERS  (top row, grouped ×3)
         ═══════════════════════════════════════════ */}
      {coolingTowers.map((ct, idx) => {
        const gi = Math.floor(idx / 3);
        const ci = idx % 3;
        const x  = ctBoxX(gi, ci);
        const y  = CT_Y;
        return (
          <g
            key={ct.id}
            className="cps-n"
            tabIndex={0}
            role="button"
            aria-label={`${ct.name}, ${ct.primaryValue} ${ct.primaryUnit}, ${STATUS_LABEL[ct.status]}`}
            onClick={activate(ct.id)}
            onKeyDown={keyDown(ct.id)}
          >
            <rect
              className="cps-bg"
              x={x} y={y} width={CT_W} height={CT_H} rx={7}
              fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1.5}
            />
            <text
              x={x + CT_W / 2} y={y + 17}
              textAnchor="middle" fontSize={9} fontWeight={600}
              fill="var(--sch-text-primary)"
            >
              CT{idx + 1}
            </text>
            <circle cx={x + 11} cy={y + 33} r={3} fill={STATUS_FILL[ct.status]} />
            <text
              x={x + CT_W / 2 + 5} y={y + 37}
              textAnchor="middle" fontSize={11.5} fontWeight={700}
              fill="var(--sch-text-primary)"
            >
              {ct.primaryValue}°C
            </text>
          </g>
        );
      })}

      {/* ═══════════════════════════════════════════
          CHILLERS  (centre row, side-by-side)
         ═══════════════════════════════════════════ */}
      {chillers.map((ch, i) => {
        const x = chX(i);
        const y = CH_Y;
        return (
          <g
            key={ch.id}
            className="cps-n"
            tabIndex={0}
            role="button"
            aria-label={`${ch.name}, ${ch.primaryValue} ${ch.primaryUnit}${ch.secondaryValue != null ? `, ${ch.secondaryValue} ${ch.secondaryUnit}` : ''}, ${STATUS_LABEL[ch.status]}`}
            onClick={activate(ch.id)}
            onKeyDown={keyDown(ch.id)}
          >
            <rect
              className="cps-bg"
              x={x} y={y} width={CH_W} height={CH_H} rx={10}
              fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1.5}
            />
            {/* name */}
            <text
              x={x + CH_W / 2} y={y + 26}
              textAnchor="middle" fontSize={13} fontWeight={600}
              fill="var(--sch-text-primary)"
            >
              {ch.name}
            </text>
            {/* primary value */}
            <text
              x={x + CH_W / 2} y={y + 60}
              textAnchor="middle" fontSize={26} fontWeight={700}
              fill="var(--sch-text-primary)"
            >
              {ch.primaryValue}
              <tspan fontSize={12} fill="var(--sch-text-secondary)"> {ch.primaryUnit}</tspan>
            </text>
            {/* secondary (efficiency) */}
            {ch.secondaryValue != null && (
              <text
                x={x + CH_W / 2} y={y + 82}
                textAnchor="middle" fontSize={11}
                fill="var(--sch-text-secondary)"
              >
                {ch.secondaryValue} {ch.secondaryUnit}
              </text>
            )}
            {/* status badge */}
            <rect
              x={x + CH_W / 2 - 30} y={y + CH_H - 30}
              width={60} height={22} rx={11}
              fill={`${STATUS_FILL[ch.status]}25`}
              stroke={`${STATUS_FILL[ch.status]}50`}
              strokeWidth={1}
            />
            <text
              x={x + CH_W / 2} y={y + CH_H - 14}
              textAnchor="middle" fontSize={10} fontWeight={600}
              fill={STATUS_FILL[ch.status]}
            >
              {STATUS_LABEL[ch.status]}
            </text>
          </g>
        );
      })}

      {/* ═══════════════════════════════════════════
          PUMP  (bottom centre)
         ═══════════════════════════════════════════ */}
      {pump && (
        <g
          className="cps-n"
          tabIndex={0}
          role="button"
          aria-label={`${pump.name}, ${pump.primaryValue} ${pump.primaryUnit}, ${STATUS_LABEL[pump.status]}`}
          onClick={activate(pump.id)}
          onKeyDown={keyDown(pump.id)}
        >
          <rect
            className="cps-bg"
            x={PUMP_X} y={PUMP_Y} width={PUMP_W} height={PUMP_H} rx={10}
            fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1.5}
          />
          <circle cx={PUMP_X + 18} cy={PUMP_Y + PUMP_H / 2} r={4} fill={STATUS_FILL[pump.status]} />
          <text
            x={PUMP_X + PUMP_W / 2 + 8} y={PUMP_Y + 23}
            textAnchor="middle" fontSize={17} fontWeight={700}
            fill="var(--sch-text-primary)"
          >
            {pump.primaryValue}
            <tspan fontSize={10} fill="var(--sch-text-secondary)"> {pump.primaryUnit}</tspan>
          </text>
          <text
            x={PUMP_X + PUMP_W / 2 + 8} y={PUMP_Y + 42}
            textAnchor="middle" fontSize={10}
            fill="var(--sch-text-secondary)"
          >
            {pump.name}
          </text>
        </g>
      )}

      {/* ═══════════════════════════════════════════
          SUMMARY BAR
         ═══════════════════════════════════════════ */}
      <rect
        x={140} y={SUM_Y} width={VB_W - 280} height={SUM_H} rx={8}
        fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1}
      />
      {/* total power */}
      <text
        x={290} y={SUM_Y + SUM_H / 2 + 4}
        textAnchor="middle" fontSize={10.5}
        fill="var(--sch-text-secondary)"
      >
        Total Plant Power:
        <tspan fontWeight={700} fill="var(--sch-text-primary)"> {totalPower.toFixed(2)} kW</tspan>
      </text>
      {/* system status */}
      <text
        x={VB_W / 2 + 100} y={SUM_Y + SUM_H / 2 + 4}
        textAnchor="middle" fontSize={10.5}
        fill="var(--sch-text-secondary)"
      >
        System Status:
        <tspan fontWeight={700} fill={allRunning ? '#34d399' : '#f87171'}>
          {allRunning ? ' All Running' : ' Issues Detected'}
        </tspan>
      </text>

      {/* ═══════════════════════════════════════════
          LEGEND  (bottom-right)
         ═══════════════════════════════════════════ */}
      <g transform={`translate(${VB_W - 170},${SUM_Y - 4})`}>
        <rect
          x={0} y={0} width={152} height={42} rx={6}
          fill="var(--sch-legend-bg)" fillOpacity={0.85}
          stroke="var(--sch-node-border)" strokeWidth={0.8}
        />
        <circle cx={12} cy={14} r={3.5} fill="#34d399" />
        <text x={21} y={17} fontSize={8} fill="var(--sch-text-secondary)">Running</text>
        <circle cx={68} cy={14} r={3.5} fill="#94a3b8" />
        <text x={77} y={17} fontSize={8} fill="var(--sch-text-secondary)">Off</text>
        <circle cx={114} cy={14} r={3.5} fill="#f87171" />
        <text x={123} y={17} fontSize={8} fill="var(--sch-text-secondary)">Warning</text>
        <text
          x={76} y={35}
          textAnchor="middle" fontSize={7.5}
          fill="var(--sch-text-secondary)" opacity={0.7}
        >
          Click any equipment for details
        </text>
      </g>
    </svg>
  );
};

export default ChillerPlantSchematic;
