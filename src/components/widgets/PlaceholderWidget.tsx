import type { FC } from 'react';

const PlaceholderWidget: FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
      <div className="rounded-full border border-dashed border-white/20 p-4">
        <span className="text-2xl">＋</span>
      </div>
      <p className="text-sm">Empty widget</p>
      <p className="text-xs text-slate-500">Drop content here in a future iteration.</p>
    </div>
  );
};

export default PlaceholderWidget;
