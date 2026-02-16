import { type FC, useCallback } from 'react';
import * as XLSX from 'xlsx';

interface ExportExcelButtonProps {
  /** Data rows — any array of objects (keys become column headers). */
  data: Record<string, unknown>[];
  /** File name without extension. */
  fileName: string;
}

/**
 * Small Excel-export icon button.
 * Hidden by default — becomes visible when its parent has `group` class and is hovered.
 */
const ExportExcelButton: FC<ExportExcelButtonProps> = ({ data, fileName }) => {
  const handleExport = useCallback(() => {
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }, [data, fileName]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 rounded-md p-1.5 text-slate-400 hover:text-accent hover:bg-slate-100 dark:hover:bg-white/10"
      aria-label={`Export ${fileName} to Excel`}
      title="Export to Excel"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </button>
  );
};

export default ExportExcelButton;
