import { type FC, useEffect, useState } from 'react';

// One recorded day, dragged through by hand or played back. Playback never
// starts on its own; the reader presses play.

interface Props {
  hours: string[];
  index: number;
  onChange: (index: number) => void;
  caption: string;
}

const STEP_MS = 700;

const HourScrubber: FC<Props> = ({ hours, index, onChange, caption }) => {
  const [playing, setPlaying] = useState(false);

  // One timeout per step, re-armed on every index change, so no ref is written during render.
  useEffect(() => {
    if (!playing) return undefined;
    const t = window.setTimeout(() => onChange((index + 1) % hours.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, index, hours.length, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-pressed={playing}
        aria-label={playing ? 'Pause the day' : 'Play the day'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="1" y="1" width="3.5" height="10" fill="currentColor" /><rect x="7.5" y="1" width="3.5" height="10" fill="currentColor" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 1 L11 6 L2 11 Z" fill="currentColor" /></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={hours.length - 1}
          step={1}
          value={index}
          aria-label="Hour of the day"
          aria-valuetext={hours[index]}
          onChange={(e) => { setPlaying(false); onChange(Number(e.target.value)); }}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-[10.5px] text-slate-500 dark:text-slate-400" aria-hidden>
          {[0, 6, 12, 18, hours.length - 1].map((i) => <span key={i}>{hours[i]}</span>)}
        </div>
      </div>
      <div className="w-36 shrink-0 text-right">
        <p className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{hours[index]}</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{caption}</p>
      </div>
    </div>
  );
};

export default HourScrubber;
