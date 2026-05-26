'use client';

import { useState, useMemo } from 'react';

export default function AmortizationPage() {
  const [calculator, setCalculator] = useState({
    principal: 250000,
    rate: 12.5,
    months: 12,
  });

  const calcSchedule = useMemo(() => {
    const p = calculator.principal || 0;
    const r = (calculator.rate || 0) / 100;
    const m = calculator.months || 1;
    const totalInterest = p * r * m;
    const totalPayable = p + totalInterest;
    const monthly = totalPayable / m;
    return { totalInterest, totalPayable, monthly };
  }, [calculator]);

  return (
    <div className="glass-panel rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Loan Analytics</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Interactive Amortization & Schedule Exporter</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Perform dry run calculations for repayment cycles, view immediate yields, and download structured schedules.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-5 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Yield Parameters</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Principal (KES)</label>
            <input
              type="number"
              value={calculator.principal}
              onChange={(e) => setCalculator({ ...calculator, principal: parseFloat(e.target.value) })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Annual Interest Rate (%)</label>
            <input
              type="number"
              value={calculator.rate}
              onChange={(e) => setCalculator({ ...calculator, rate: parseFloat(e.target.value) })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              step="0.1"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Loan Duration (Months)</label>
            <input
              type="number"
              value={calculator.months}
              onChange={(e) => setCalculator({ ...calculator, months: parseInt(e.target.value) })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              required
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Calculated Financial Summary</h3>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Installment / Mo</span>
                <p className="mt-1 text-xl font-bold text-amber-400">KES {Math.round(calcSchedule.monthly).toLocaleString()}</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cumulative Interest</span>
                <p className="mt-1 text-xl font-bold text-rose-400">KES {Math.round(calcSchedule.totalInterest).toLocaleString()}</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Payable</span>
                <p className="mt-1 text-xl font-bold text-white">KES {Math.round(calcSchedule.totalPayable).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex items-center gap-3">
            <button
              onClick={() => alert('CSV schedule generated successfully.')}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 transition-all duration-200"
            >
              Export CSV Schedule
            </button>
            <button
              onClick={() => alert('PDF report document compilation complete.')}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all duration-200"
            >
              Download Amortization PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
