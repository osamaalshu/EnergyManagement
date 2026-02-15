import { type FC, useMemo } from 'react';
import type { Equipment, EquipmentStatus } from '../types/portfolio';

interface ChillerPlantSchematicProps {
  equipment: Equipment[];
  onNavigateToEquipment: (equipmentId: string) => void;
}

/* ── Status palette (fixed across themes) ─────────────── */
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

/* ── Pipe colours ─────────────────────────────────────── */
const PIPE = {
  supply:    '#60a5fa',
  return:    '#fb923c',
  condenser: '#a78bfa',
} as const;

/* ── ViewBox & element sizes ──────────────────────────── */
const VB_W = 1000;
const VB_H = 480;

const PUMP_W = 130;
const PUMP_H = 90;
const CH_W   = 165;
const CH_H   = 92;
const CT_W   = 76;
const CT_H   = 64;
const CT_GAP = 8;

/* X anchors */
const PUMP_X = 25;
const CH_X   = 320;
const CT_X0  = 720;

/* Vertical manifold X positions */
const L_MAN_X = 260;
const R_MAN_X = 650;

/* Vertical layout – distribute 3 chillers evenly */
const PAD_Y  = 20;
const CH_GAP = ((VB_H - 2 * PAD_Y) - 3 * CH_H) / 2;

const chY  = (i: number) => PAD_Y + i * (CH_H + CH_GAP);
const chCY = (i: number) => chY(i) + CH_H / 2;

/* Pump centred on middle chiller */
const PUMP_Y  = chCY(1) - PUMP_H / 2;
const PUMP_CY = chCY(1);

/* CT grid positions */
const ctColX = (c: number) => CT_X0 + c * (CT_W + CT_GAP);
const ctRowY = (r: number) => chCY(r) - CT_H / 2;

/* ────────────────────────────────────────────────────── */

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
  const nCh  = chillers.length;
  const nTR  = Math.ceil(coolingTowers.length / 3);

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
      className="max-h-[520px]"
      role="img"
      aria-label="Chiller plant schematic showing equipment connections"
    >
      {/* ── Hover / focus styles ──────────────────── */}
      <style>{`
        .cps-node{cursor:pointer}
        .cps-node>.cps-bg{transition:stroke .15s,filter .15s}
        .cps-node:hover>.cps-bg,.cps-node:focus>.cps-bg{
          stroke:#22d3ee;stroke-width:2;
          filter:drop-shadow(0 0 8px rgba(34,211,238,.3))
        }
        .cps-node:focus{outline:none}
        .cps-node:focus>.cps-bg{stroke-width:2.5}
      `}</style>

      {/* ── Arrow markers ─────────────────────────── */}
      <defs>
        <marker id="cps-as" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0L8,3L0,6Z" fill={PIPE.supply} />
        </marker>
        <marker id="cps-ar" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0L8,3L0,6Z" fill={PIPE.return} />
        </marker>
        <marker id="cps-ac" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0L8,3L0,6Z" fill={PIPE.condenser} />
        </marker>
      </defs>

      {/* ═══════════════════ PIPES ═══════════════════ */}

      {/* ── Supply: Pump → Left manifold → Chillers ─ */}
      <line
        x1={PUMP_X + PUMP_W} y1={PUMP_CY - 6}
        x2={L_MAN_X}         y2={PUMP_CY - 6}
        stroke={PIPE.supply} strokeWidth={2.5}
      />
      <line
        x1={L_MAN_X} y1={chCY(0)}
        x2={L_MAN_X} y2={chCY(nCh - 1)}
        stroke={PIPE.supply} strokeWidth={2.5}
      />
      {chillers.map((_, i) => (
        <line
          key={`sp${i}`}
          x1={L_MAN_X} y1={chCY(i)}
          x2={CH_X - 2} y2={chCY(i)}
          stroke={PIPE.supply} strokeWidth={2.5}
          markerEnd="url(#cps-as)"
        />
      ))}
      {/* Supply label */}
      <text
        x={(PUMP_X + PUMP_W + L_MAN_X) / 2}
        y={PUMP_CY - 18}
        textAnchor="middle"
        fontSize={9}
        fontWeight={500}
        fill={PIPE.supply}
        opacity={0.85}
      >
        Chilled Water
      </text>

      {/* ── Return: bottom path back to pump ─────── */}
      <path
        d={`M${L_MAN_X} ${chCY(nCh - 1)}
            L${L_MAN_X} ${VB_H - 16}
            L${PUMP_X + PUMP_W / 2} ${VB_H - 16}
            L${PUMP_X + PUMP_W / 2} ${PUMP_Y + PUMP_H + 2}`}
        fill="none"
        stroke={PIPE.return}
        strokeWidth={2.5}
        markerEnd="url(#cps-ar)"
      />
      <text
        x={(L_MAN_X + PUMP_X + PUMP_W / 2) / 2}
        y={VB_H - 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={500}
        fill={PIPE.return}
        opacity={0.85}
      >
        Return
      </text>

      {/* ── Condenser: Chillers → Right manifold → Towers */}
      {chillers.map((_, i) => (
        <line
          key={`co${i}`}
          x1={CH_X + CH_W + 2} y1={chCY(i)}
          x2={R_MAN_X}         y2={chCY(i)}
          stroke={PIPE.condenser} strokeWidth={2.5}
          markerEnd="url(#cps-ac)"
        />
      ))}
      <line
        x1={R_MAN_X} y1={chCY(0)}
        x2={R_MAN_X} y2={chCY(nCh - 1)}
        stroke={PIPE.condenser} strokeWidth={2.5}
      />
      {Array.from({ length: nTR }).map((_, r) => (
        <line
          key={`ct${r}`}
          x1={R_MAN_X}   y1={chCY(r)}
          x2={CT_X0 - 2} y2={chCY(r)}
          stroke={PIPE.condenser} strokeWidth={2.5}
          markerEnd="url(#cps-ac)"
        />
      ))}
      {/* Condenser label */}
      <text
        x={(CH_X + CH_W + R_MAN_X) / 2 + 10}
        y={chCY(0) - 12}
        textAnchor="middle"
        fontSize={9}
        fontWeight={500}
        fill={PIPE.condenser}
        opacity={0.85}
      >
        Condenser Water
      </text>

      {/* ═══════════════ EQUIPMENT NODES ═════════════ */}

      {/* ── Pump ────────────────────────────────────── */}
      {pump && (
        <g
          className="cps-node"
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
          {/* Pump icon (circle) */}
          <circle
            cx={PUMP_X + PUMP_W / 2} cy={PUMP_Y + 22} r={11}
            fill="none" stroke="var(--sch-icon)" strokeWidth={1.3}
          />
          <text
            x={PUMP_X + PUMP_W / 2} y={PUMP_Y + 48}
            textAnchor="middle" fontSize={9.5} fontWeight={600}
            fill="var(--sch-text-primary)"
          >
            {pump.name}
          </text>
          <text
            x={PUMP_X + PUMP_W / 2} y={PUMP_Y + 66}
            textAnchor="middle" fontSize={15} fontWeight={700}
            fill="var(--sch-text-primary)"
          >
            {pump.primaryValue}
          </text>
          <text
            x={PUMP_X + PUMP_W / 2} y={PUMP_Y + 78}
            textAnchor="middle" fontSize={9}
            fill="var(--sch-text-secondary)"
          >
            {pump.primaryUnit}
          </text>
          <circle cx={PUMP_X + PUMP_W - 14} cy={PUMP_Y + 12} r={4} fill={STATUS_FILL[pump.status]} />
        </g>
      )}

      {/* ── Chillers ──────────────────────────────── */}
      {chillers.map((ch, i) => {
        const y = chY(i);
        return (
          <g
            key={ch.id}
            className="cps-node"
            tabIndex={0}
            role="button"
            aria-label={`${ch.name}, ${ch.primaryValue} ${ch.primaryUnit}${ch.secondaryValue != null ? `, ${ch.secondaryValue} ${ch.secondaryUnit}` : ''}, ${STATUS_LABEL[ch.status]}`}
            onClick={activate(ch.id)}
            onKeyDown={keyDown(ch.id)}
          >
            <rect
              className="cps-bg"
              x={CH_X} y={y} width={CH_W} height={CH_H} rx={10}
              fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1.5}
            />
            <text
              x={CH_X + CH_W / 2} y={y + 20}
              textAnchor="middle" fontSize={11} fontWeight={600}
              fill="var(--sch-text-primary)"
            >
              {ch.name}
            </text>
            <text
              x={CH_X + CH_W / 2} y={y + 44}
              textAnchor="middle" fontSize={17} fontWeight={700}
              fill="var(--sch-text-primary)"
            >
              {ch.primaryValue}
              <tspan fontSize={10} fill="var(--sch-text-secondary)">
                {' '}{ch.primaryUnit}
              </tspan>
            </text>
            {ch.secondaryValue != null && (
              <text
                x={CH_X + CH_W / 2} y={y + 62}
                textAnchor="middle" fontSize={10}
                fill="var(--sch-text-secondary)"
              >
                {ch.secondaryValue} {ch.secondaryUnit}
              </text>
            )}
            <circle cx={CH_X + CH_W - 14} cy={y + 14} r={4} fill={STATUS_FILL[ch.status]} />
            <text
              x={CH_X + 14} y={y + CH_H - 10}
              fontSize={8.5} fontWeight={500}
              fill={STATUS_FILL[ch.status]}
            >
              {STATUS_LABEL[ch.status]}
            </text>
          </g>
        );
      })}

      {/* ── Cooling Towers ────────────────────────── */}
      {coolingTowers.map((ct, idx) => {
        const r = Math.floor(idx / 3);
        const c = idx % 3;
        const x = ctColX(c);
        const y = ctRowY(r);
        return (
          <g
            key={ct.id}
            className="cps-node"
            tabIndex={0}
            role="button"
            aria-label={`${ct.name}, ${ct.primaryValue} ${ct.primaryUnit}, ${STATUS_LABEL[ct.status]}`}
            onClick={activate(ct.id)}
            onKeyDown={keyDown(ct.id)}
          >
            <rect
              className="cps-bg"
              x={x} y={y} width={CT_W} height={CT_H} rx={8}
              fill="var(--sch-node-bg)" stroke="var(--sch-node-border)" strokeWidth={1.5}
            />
            <text
              x={x + CT_W / 2} y={y + 17}
              textAnchor="middle" fontSize={9.5} fontWeight={600}
              fill="var(--sch-text-primary)"
            >
              CT{idx + 1}
            </text>
            <text
              x={x + CT_W / 2} y={y + 37}
              textAnchor="middle" fontSize={14} fontWeight={700}
              fill="var(--sch-text-primary)"
            >
              {ct.primaryValue}°
            </text>
            <text
              x={x + CT_W / 2} y={y + 51}
              textAnchor="middle" fontSize={8}
              fill="var(--sch-text-secondary)"
            >
              {ct.primaryUnit}
            </text>
            <circle cx={x + CT_W - 9} cy={y + 9} r={3} fill={STATUS_FILL[ct.status]} />
          </g>
        );
      })}

      {/* ═══════════════════ LEGEND ══════════════════ */}
      <g transform={`translate(${VB_W - 160},${VB_H - 50})`}>
        <rect
          x={0} y={0} width={148} height={42} rx={6}
          fill="var(--sch-legend-bg)" fillOpacity={0.85}
          stroke="var(--sch-node-border)" strokeWidth={0.8}
        />
        {/* Row 1 – status dots */}
        <circle cx={12} cy={14} r={3.5} fill="#34d399" />
        <text x={21} y={17} fontSize={8} fill="var(--sch-text-secondary)">Running</text>
        <circle cx={70} cy={14} r={3.5} fill="#94a3b8" />
        <text x={79} y={17} fontSize={8} fill="var(--sch-text-secondary)">Off</text>
        <circle cx={110} cy={14} r={3.5} fill="#f87171" />
        <text x={119} y={17} fontSize={8} fill="var(--sch-text-secondary)">Warning</text>
        {/* Row 2 – hint */}
        <text
          x={74} y={35}
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
