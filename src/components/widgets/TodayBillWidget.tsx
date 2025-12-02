import type { FC } from 'react';
import { todaysBill } from '../../data/mockDashboardData';

const TodayBillWidget: FC = () => {
  return (
    <div className="flex h-full flex-col justify-between gap-4 p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Today's Energy Bill</p>
        <p className="mt-3 text-4xl font-semibold text-slate-900 dark:text-white">
          {todaysBill.amount}
          <span className="ml-1 text-xl text-slate-500 dark:text-slate-300">{todaysBill.currency}</span>
        </p>
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{todaysBill.subtext}</p>
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          {todaysBill.deltaText}
        </p>
      </div>
    </div>
  );
};

export default TodayBillWidget;
