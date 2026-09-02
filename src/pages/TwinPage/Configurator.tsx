import { type FC } from 'react';
import type { BessConfig, PvConfig, TwinConfig } from '@/features/spatial-twin/model';
import { LIMITS } from '@/features/spatial-twin/generate';
import { PRESETS, type Preset } from '@/features/spatial-twin/presets';

// "Describe the plant." The visitor types what they have; the plan redraws.
// Fields are named by what an owner knows from a quotation, not by our model.

interface Props {
  config: TwinConfig;
  presetId: Preset['id'] | null;
  problems: string[];
  attached: boolean;
  /** How many inverter records the reference dataset holds, and how many inverters this plant has. */
  recordCount: number;
  inverterCount: number;
  onChange: (cfg: TwinConfig) => void;
  onPreset: (p: Preset) => void;
  onAttach: (on: boolean) => void;
}

type NumKey = keyof typeof LIMITS;

const Field: FC<{ id: string; label: string; value: number; limit: NumKey; step?: number; onChange: (v: number) => void }> = ({ id, label, value, limit, step = 1, onChange }) => (
  <label htmlFor={id} className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
    <span>{label}</span>
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={value}
      min={LIMITS[limit][0]}
      max={LIMITS[limit][1]}
      step={step}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      className="w-20 rounded-md border border-slate-200/80 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
    />
  </label>
);

const Group: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset className="space-y-2">
    <legend className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{title}</legend>
    {children}
  </fieldset>
);

const DEFAULT_BESS: BessConfig = { containers: 1, racksPerContainer: 4, modulesPerRack: 8, cellsPerModule: 16, rackKwh: 215, rackKw: 100, cellTelemetry: false };

const Configurator: FC<Props> = ({ config, presetId, problems, attached, recordCount, inverterCount, onChange, onPreset, onAttach }) => {
  const covered = Math.min(recordCount, inverterCount);
  const pv = (patch: Partial<PvConfig>) => onChange({ ...config, pv: { ...config.pv, ...patch } });
  const bess = (patch: Partial<BessConfig>) => onChange({ ...config, bess: { ...(config.bess ?? DEFAULT_BESS), ...patch } });

  return (
    <div className="card-surface space-y-5 p-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Start from</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => onPreset(p)} title={p.hint} aria-pressed={presetId === p.id}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${presetId === p.id ? 'border-primary bg-primary text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-200/80 text-slate-600 hover:border-slate-400 dark:border-white/10 dark:text-slate-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label htmlFor="twin-name" className="block text-xs text-slate-600 dark:text-slate-300">
        Plant name
        <input id="twin-name" type="text" value={config.name} onChange={(e) => onChange({ ...config, name: e.target.value })}
          className="mt-1 w-full rounded-md border border-slate-200/80 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-slate-900/60 dark:text-white" />
      </label>

      <Group title="Solar">
        <Field id="pv-arrays" label="Arrays" value={config.pv.arrays} limit="arrays" onChange={(v) => pv({ arrays: v })} />
        <Field id="pv-inv" label="Inverters per array" value={config.pv.invertersPerArray} limit="invertersPerArray" onChange={(v) => pv({ invertersPerArray: v })} />
        <Field id="pv-mppt" label="MPPT inputs per inverter" value={config.pv.mpptPerInverter} limit="mpptPerInverter" onChange={(v) => pv({ mpptPerInverter: v })} />
        <Field id="pv-str" label="Strings per MPPT input" value={config.pv.stringsPerMppt} limit="stringsPerMppt" onChange={(v) => pv({ stringsPerMppt: v })} />
        <Field id="pv-mod" label="Modules per string" value={config.pv.modulesPerString} limit="modulesPerString" onChange={(v) => pv({ modulesPerString: v })} />
        <Field id="pv-wp" label="Module watts" value={config.pv.moduleWp} limit="moduleWp" step={5} onChange={(v) => pv({ moduleWp: v })} />
        <Field id="pv-ackw" label="Inverter kW" value={config.pv.inverterAcKw} limit="inverterAcKw" step={5} onChange={(v) => pv({ inverterAcKw: v })} />
        <label htmlFor="pv-tracking" className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span>Mounting</span>
          <select id="pv-tracking" value={config.pv.tracking} onChange={(e) => pv({ tracking: e.target.value as PvConfig['tracking'] })}
            className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-slate-900/60 dark:text-white">
            <option value="fixed">Fixed tilt</option>
            <option value="dual_axis">Dual-axis tracker</option>
          </select>
        </label>
        {config.pv.tracking === 'fixed' && (
          <>
            <Field id="pv-tilt" label="Tilt, degrees" value={config.pv.tiltDeg} limit="tiltDeg" onChange={(v) => pv({ tiltDeg: v })} />
            <Field id="pv-az" label="Facing, degrees from north" value={config.pv.azimuthDeg} limit="azimuthDeg" onChange={(v) => pv({ azimuthDeg: v })} />
          </>
        )}
        <Field id="pv-gcr" label="Ground cover ratio" value={config.pv.gcr} limit="gcr" step={0.05} onChange={(v) => pv({ gcr: v })} />
      </Group>

      <Group title="Battery">
        <label htmlFor="bess-on" className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span>Battery on site</span>
          <input id="bess-on" type="checkbox" checked={config.bess !== null} onChange={(e) => onChange({ ...config, bess: e.target.checked ? DEFAULT_BESS : null })} className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
        {config.bess && (
          <>
            <Field id="b-cont" label="Containers" value={config.bess.containers} limit="containers" onChange={(v) => bess({ containers: v })} />
            <Field id="b-racks" label="Racks per container" value={config.bess.racksPerContainer} limit="racksPerContainer" onChange={(v) => bess({ racksPerContainer: v })} />
            <Field id="b-mod" label="Modules per rack" value={config.bess.modulesPerRack} limit="modulesPerRack" onChange={(v) => bess({ modulesPerRack: v })} />
            <Field id="b-cells" label="Cells per module" value={config.bess.cellsPerModule} limit="cellsPerModule" onChange={(v) => bess({ cellsPerModule: v })} />
            <Field id="b-kwh" label="Rack kWh" value={config.bess.rackKwh} limit="rackKwh" step={5} onChange={(v) => bess({ rackKwh: v })} />
            <Field id="b-kw" label="Rack kW" value={config.bess.rackKw} limit="rackKw" step={5} onChange={(v) => bess({ rackKw: v })} />
            <label htmlFor="b-cell-tel" className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>BMS reports each cell</span>
              <input id="b-cell-tel" type="checkbox" checked={config.bess.cellTelemetry} onChange={(e) => bess({ cellTelemetry: e.target.checked })} className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            </label>
          </>
        )}
      </Group>

      <Group title="Records">
        <label htmlFor="attach" className="flex items-start justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>Attach the reference plant's {recordCount} inverter records to {covered === inverterCount ? `all ${inverterCount}` : `the first ${covered} of ${inverterCount}`} inverters</span>
          <input id="attach" type="checkbox" checked={attached} onChange={(e) => onAttach(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        </label>
      </Group>

      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-lg border border-red-300/60 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {problems.map((p) => <li key={p}>{p}</li>)}
          <li className="pt-1 text-red-700/80 dark:text-red-200/80">The plan shows the last valid description.</li>
        </ul>
      )}
    </div>
  );
};

export default Configurator;
