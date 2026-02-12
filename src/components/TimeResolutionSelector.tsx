import type { FC } from 'react';
import type { TimeResolution } from '../types/portfolio';

const OPTIONS: { value: TimeResolution; label: string }[] = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
];

interface TimeResolutionSelectorProps {
  value: TimeResolution;
  onChange: (resolution: TimeResolution) => void;
}

const TimeResolutionSelector: FC<TimeResolutionSelectorProps> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-slate-200/70 dark:border-white/10" role="radiogroup" aria-label="Time resolution">
    {OPTIONS.map((opt) => {
      const isActive = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            isActive
              ? 'bg-accent text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-card-dark dark:text-slate-400 dark:hover:bg-white/5'
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

export default TimeResolutionSelector;
