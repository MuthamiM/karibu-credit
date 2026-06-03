'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

type Borrower = {
  id: number;
  full_name: string;
  email: string;
};

export default function CreateLoanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  
  const [formData, setFormData] = useState({
    borrower_id: 1, // Defaulting to 1 for dummy purposes
    principal_amount: 10000,
    interest_rate: 15.0,
    term_months: 6,
    loan_type: 'SALARY',
    disbursement_method: 'LUMP_SUM'
  });

  useEffect(() => {
    async function loadBorrowers() {
      try {
        const data = await fetchApi('/users/?role=borrower');
        setBorrowers(data);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, borrower_id: data[0].id }));
        }
      } catch (err: unknown) {
        setError('Failed to fetch borrowers. Make sure they are registered first.');
      }
    }
    loadBorrowers();
  }, []);

  // Real-time amortization calculator (flat-rate)
  const schedule = useMemo(() => {
    const principal = formData.principal_amount || 0;
    const rate = (formData.interest_rate || 0) / 100;
    const months = formData.term_months || 1;

    const totalInterest = principal * rate * months;
    const totalPayable = principal + totalInterest;
    const monthlyInstallment = totalPayable / months;

    const rows = [];
    for (let i = 1; i <= months; i++) {
      rows.push({
        month: i,
        principal: principal / months,
        interest: (principal * rate),
        installment: monthlyInstallment,
        balance: totalPayable - monthlyInstallment * i,
      });
    }

    return { totalInterest, totalPayable, monthlyInstallment, rows };
  }, [formData.principal_amount, formData.interest_rate, formData.term_months]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetchApi('/loans/', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      router.push('/dashboard/loans');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: Form */}
      <div className="card rounded-[28px] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Loans</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-white">Create new application</h2>
        
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Borrower</label>
              {borrowers.length === 0 ? (
                <div className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
                  No borrowers found.
                </div>
              ) : (
                <select
                  value={formData.borrower_id}
                  onChange={(e) => setFormData({ ...formData, borrower_id: parseInt(e.target.value) })}
                  className="premium-select w-full rounded-xl px-4 py-3 text-sm outline-none"
                  required
                >
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name} (#{b.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Loan Type</label>
              <select
                value={formData.loan_type}
                onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                className="premium-select w-full rounded-xl px-4 py-3 text-sm outline-none"
                required
              >
                <option value="SALARY">Salary Loan</option>
                <option value="LOGBOOK">Logbook Loan</option>
                <option value="SME">SME Loan</option>
                <option value="MOBILE">Mobile Loan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Principal Amount (KES)</label>
              <input
                type="number"
                value={formData.principal_amount}
                onChange={(e) => setFormData({ ...formData, principal_amount: parseFloat(e.target.value) })}
                className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Term (Months)</label>
              <input
                type="number"
                value={formData.term_months}
                onChange={(e) => setFormData({ ...formData, term_months: parseInt(e.target.value) })}
                className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Interest Rate (%)</label>
              <input
                type="number"
                value={formData.interest_rate}
                step="0.01"
                onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Disbursement Method</label>
              <select
                value={formData.disbursement_method}
                onChange={(e) => setFormData({ ...formData, disbursement_method: e.target.value })}
                className="premium-select w-full rounded-xl px-4 py-3 text-sm outline-none"
                required
              >
                <option value="LUMP_SUM">Lump Sum (Full Disbursement)</option>
                <option value="PARTIAL">Partial (Multiple Tranches)</option>
                <option value="STAGE_WISE">Stage Wise (Milestone based)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Creating...
                </span>
              ) : (
                'Create Loan'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Right: Amortization Schedule Preview */}
      <div className="card rounded-[28px] p-6 self-start sticky top-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Preview</p>
        <h3 className="mt-2 text-lg font-bold tracking-tight text-white">Amortization Schedule</h3>

        {/* Summary Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Monthly</p>
            <p className="mt-1 text-lg font-bold text-amber-400">
              KES {Math.round(schedule.monthlyInstallment).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Interest</p>
            <p className="mt-1 text-lg font-bold text-red-600">
              KES {Math.round(schedule.totalInterest).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Total Payable */}
        <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">Total Payable</p>
            <p className="text-lg font-bold text-white">
              KES {Math.round(schedule.totalPayable).toLocaleString()}
            </p>
          </div>
          {/* Visual breakdown bar */}
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-amber-400 transition-all duration-500"
              style={{ width: `${schedule.totalPayable > 0 ? ((formData.principal_amount || 0) / schedule.totalPayable) * 100 : 0}%` }}
            ></div>
            <div
              className="bg-rose-400 transition-all duration-500"
              style={{ width: `${schedule.totalPayable > 0 ? (schedule.totalInterest / schedule.totalPayable) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 text-amber-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              Principal
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400"></span>
              Interest
            </span>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="mt-5 max-h-64 overflow-auto rounded-xl border border-white/5 bg-white/[0.02]">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[9px] uppercase tracking-[0.15em] text-slate-500 border-b border-white/5 sticky top-0 bg-[#0a0d18]">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Interest</th>
                <th className="px-3 py-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {schedule.rows.map((row) => (
                <tr key={row.month} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 text-slate-500 font-mono">{row.month}</td>
                  <td className="px-3 py-2 text-slate-300">{Math.round(row.principal).toLocaleString()}</td>
                  <td className="px-3 py-2 text-red-600/70">{Math.round(row.interest).toLocaleString()}</td>
                  <td className="px-3 py-2 text-white font-medium">{Math.max(0, Math.round(row.balance)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
          Flat-rate calculation. Actual schedule may vary based on disbursement timing and penalties.
        </p>
      </div>
    </div>
  );
}
