const DEFAULT_SCENARIO_TEXT = 'Scenario — figures use a generated order book, not your live orders. Connect the order book to make this operational.';

interface ScenarioBannerProps {
  text?: string;
}

const ScenarioBanner = ({ text = DEFAULT_SCENARIO_TEXT }: ScenarioBannerProps) => (
  <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
    <span className="font-semibold">Scenario</span>
    <span className="mx-2 text-amber-700 dark:text-amber-300">—</span>
    <span>{text.replace(/^Scenario — /, '')}</span>
  </div>
);

export default ScenarioBanner;
