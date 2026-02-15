import { type FC, useRef, useState, useMemo } from 'react';
import {
  tariffHourlyData,
  copByResolution,
  overallCop,
  baselineDeviationSeries,
} from '../data/mockPortfolioData';
import {
  calculateMonthlyDetailedBills,
  type MonthlyBill,
} from '../lib/tariffEngine';

interface SystemSummaryModalProps {
  onClose: () => void;
}

const SystemSummaryModal: FC<SystemSummaryModalProps> = ({ onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Compute monthly bills for tariff breakdown
  const monthlyBills = useMemo<MonthlyBill[]>(() => {
    if (!tariffHourlyData || tariffHourlyData.length === 0) return [];
    return calculateMonthlyDetailedBills(tariffHourlyData, {
      voltageLevel: '11kV',
      includeCgr: true,
      dcMethod: 'top3_peakbands',
    });
  }, []);

  // Use the last 4 months of data as "season"
  const seasonBills = monthlyBills.slice(-4);
  const seasonLabel = seasonBills.length >= 2
    ? `${seasonBills[0].month} to ${seasonBills[seasonBills.length - 1].month}`
    : 'Recent Season';

  // Summary metrics for the season
  const seasonMetrics = useMemo(() => {
    if (seasonBills.length === 0) return null;
    const totalKwh = seasonBills.reduce((s, b) => s + b.kwhTotal, 0);
    const totalBill = seasonBills.reduce((s, b) => s + b.totalBillOmr, 0);
    const totalEnergy = seasonBills.reduce((s, b) => s + b.touEnergyOmr, 0);
    const totalCapacity = seasonBills.reduce((s, b) => s + b.capacityOmr, 0);
    const totalSupply = seasonBills.reduce((s, b) => s + b.supplyOmr, 0);
    const totalVat = seasonBills.reduce((s, b) => s + b.vatOmr, 0);
    const avgDcKw = seasonBills.reduce((s, b) => s + b.dcKw, 0) / seasonBills.length;
    const avgDncKw = seasonBills.reduce((s, b) => s + b.dncKw, 0) / seasonBills.length;
    return { totalKwh, totalBill, totalEnergy, totalCapacity, totalSupply, totalVat, avgDcKw, avgDncKw };
  }, [seasonBills]);

  // COP for seasonal period
  const seasonalCop = copByResolution.seasonal;
  const latestSeasonCop = seasonalCop.length > 0 ? seasonalCop[seasonalCop.length - 1] : null;

  // Baseline deviation: average for the season months
  const seasonDeviation = useMemo(() => {
    if (seasonBills.length === 0 || baselineDeviationSeries.length === 0) return null;
    const seasonMonthKeys = seasonBills.map((b) => b.month);
    const relevant = baselineDeviationSeries.filter((d) => seasonMonthKeys.includes(d.month));
    if (relevant.length === 0) return null;
    return Math.round(relevant.reduce((s, d) => s + d.deviationPercent, 0) / relevant.length * 10) / 10;
  }, [seasonBills]);

  const formatOmr = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatKwh = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a', // dark bg
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      // First page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);

      // Additional pages if content overflows
      while (heightLeft > 0) {
        position = position - (pageHeight - 20);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
      }

      pdf.save(`System_Summary_${seasonLabel.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
      <div className="relative my-8 w-full max-w-3xl">
        {/* Close + Download buttons */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-white/10 bg-surface-dark/95 px-6 py-4 backdrop-blur-lg">
          <h2 className="text-lg font-semibold text-white">System Summary Report</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div
          ref={reportRef}
          className="rounded-b-2xl bg-surface-dark p-8 text-white"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="mb-8 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Chiller Plant 1 — System Summary</h1>
                <p className="text-sm text-slate-400">Season: {seasonLabel}</p>
              </div>
            </div>
          </div>

          {/* 1. System Summary */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-accent">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold">1</span>
              System Summary
            </h2>
            {seasonMetrics ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Total Consumption</p>
                  <p className="mt-1 text-xl font-bold">{formatKwh(seasonMetrics.totalKwh)} <span className="text-sm font-normal text-slate-400">kWh</span></p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Total Cost</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">{formatOmr(seasonMetrics.totalBill)} <span className="text-sm font-normal text-slate-400">OMR</span></p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Avg COP</p>
                  <p className="mt-1 text-xl font-bold text-sky-400">
                    {latestSeasonCop ? latestSeasonCop.value.toFixed(2) : overallCop.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Peak Demand</p>
                  <p className="mt-1 text-xl font-bold text-amber-400">{Math.round(seasonMetrics.avgDncKw)} <span className="text-sm font-normal text-slate-400">kW</span></p>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">No season data available.</p>
            )}
          </section>

          {/* 2. Tariff Breakdown */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-accent">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold">2</span>
              Tariff Breakdown
            </h2>
            {seasonMetrics ? (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Component</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Amount (OMR)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="px-4 py-2.5 text-emerald-400">TOU Energy Charges</td>
                      <td className="px-4 py-2.5 text-right">{formatOmr(seasonMetrics.totalEnergy)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{((seasonMetrics.totalEnergy / seasonMetrics.totalBill) * 100).toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-sky-400">Capacity Charges</td>
                      <td className="px-4 py-2.5 text-right">{formatOmr(seasonMetrics.totalCapacity)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{((seasonMetrics.totalCapacity / seasonMetrics.totalBill) * 100).toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">Supply Charge</td>
                      <td className="px-4 py-2.5 text-right">{formatOmr(seasonMetrics.totalSupply)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{((seasonMetrics.totalSupply / seasonMetrics.totalBill) * 100).toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">VAT (5%)</td>
                      <td className="px-4 py-2.5 text-right">{formatOmr(seasonMetrics.totalVat)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{((seasonMetrics.totalVat / seasonMetrics.totalBill) * 100).toFixed(1)}%</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/5">
                      <td className="px-4 py-3 font-bold">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{formatOmr(seasonMetrics.totalBill)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-400">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-slate-400">No tariff data available.</p>
            )}
          </section>

          {/* 3. Summary of Findings */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-accent">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold">3</span>
              Summary of Findings
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-slate-300">
              <p>
                During the season <strong className="text-white">{seasonLabel}</strong>, the chiller plant
                consumed a total of <strong className="text-white">{seasonMetrics ? formatKwh(seasonMetrics.totalKwh) : '—'} kWh</strong> of
                electrical energy, resulting in a total electricity bill of <strong className="text-emerald-400">{seasonMetrics ? formatOmr(seasonMetrics.totalBill) : '—'} OMR</strong>.
              </p>
              <p className="mt-3">
                The system maintained an average COP of <strong className="text-sky-400">{latestSeasonCop ? latestSeasonCop.value.toFixed(2) : overallCop.toFixed(2)}</strong>,
                {overallCop > 5 ? ' indicating strong overall system efficiency.' : ' which suggests room for efficiency improvement.'}
                {seasonDeviation !== null && (
                  <> The average efficiency deviation from the 2013 baseline was <strong className={seasonDeviation > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    {seasonDeviation > 0 ? '+' : ''}{seasonDeviation}%
                  </strong>
                  {seasonDeviation > 5
                    ? ', signalling degraded performance relative to the baseline year.'
                    : seasonDeviation < -5
                    ? ', showing improvement over the baseline year.'
                    : ', indicating performance consistent with the baseline year.'}
                  </>
                )}
              </p>
              <p className="mt-3">
                Capacity charges accounted for <strong className="text-white">
                  {seasonMetrics ? ((seasonMetrics.totalCapacity / seasonMetrics.totalBill) * 100).toFixed(1) : '—'}%
                </strong> of the total bill, with an average coincident peak demand of <strong className="text-amber-400">
                  {seasonMetrics ? Math.round(seasonMetrics.avgDcKw) : '—'} kW
                </strong> and non-coincident peak of <strong className="text-amber-400">
                  {seasonMetrics ? Math.round(seasonMetrics.avgDncKw) : '—'} kW
                </strong>. Managing peak demand through load shifting and sequencing optimization can yield significant cost savings.
              </p>
            </div>
          </section>

          {/* 4. Recommendations */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-accent">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold">4</span>
              Recommendations
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/20">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Optimize Chiller Sequencing</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Implement a load-based chiller staging strategy to avoid running chillers at low partial loads.
                    Target maintaining each chiller above 60% load capacity to maximize COP and reduce kW/ton.
                    Estimated savings: 8-12% reduction in energy consumption.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-400/20">
                  <svg className="h-4 w-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Peak Demand Management</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Shift non-critical cooling loads to off-peak hours (03:00–12:59) to reduce coincident peak demand charges.
                    Pre-cool the building during off-peak periods to reduce weekday daytime (WDP) and night (NP) peak consumption.
                    Potential capacity charge reduction: 15-20%.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
                  <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-white">Condenser Water Temperature Optimization</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Lower the condenser water supply temperature setpoint by 1-2°C during cooler months to improve chiller efficiency.
                    Monitor approach temperature across cooling towers and schedule cleaning to maintain optimal heat rejection.
                    Expected COP improvement: 3-5%.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-slate-500">
            Generated by Enerlytics Dashboard &middot; {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSummaryModal;
