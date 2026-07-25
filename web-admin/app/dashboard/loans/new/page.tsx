'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { THEME } from '@/theme';

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
  const [expandedPanel, setExpandedPanel] = useState<'form' | 'preview' | null>(null);
  
  const [formData, setFormData] = useState({
    borrower_id: 1,
    principal_amount: 10000,
    interest_rate: 15.0,
    term_months: 6,
    loan_type: 'SALARY',
    disbursement_method: 'lump_sum'
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

  const principalPct = schedule.totalPayable > 0 ? ((formData.principal_amount || 0) / schedule.totalPayable) * 100 : 0;
  const interestPct = schedule.totalPayable > 0 ? (schedule.totalInterest / schedule.totalPayable) * 100 : 0;

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 items-start">
      {/* Left: Form */}
      <div className={`${THEME.classes.card} ${expandedPanel === 'form' ? 'lg:col-span-12' : 'lg:col-span-7'} ${expandedPanel === 'preview' ? 'hidden' : 'block'}`}>
        <div className="flex items-center gap-4 mb-6 border-b border-black pb-4">
          <div className="flex h-12 w-12 items-center justify-center border border-black bg-black text-white font-black text-lg">
            $
          </div>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <p className={THEME.classes.subtitle}>Loans</p>
              <h2 className={THEME.classes.title}>Create new application</h2>
            </div>
            <button
              type="button"
              onClick={() => setExpandedPanel(expandedPanel === 'form' ? null : 'form')}
              title={expandedPanel === 'form' ? "Collapse Form" : "Expand Form"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                border: '1px solid #000',
                background: '#fff',
                color: '#000',
                cursor: 'pointer',
                borderRadius: '2px'
              }}
            >
              {expandedPanel === 'form' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H3v5M16 21h5v-5M21 3l-7 7M3 21l7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-5 border border-black bg-black text-white px-4 py-3 text-xs font-mono uppercase tracking-wider flex items-center gap-2">
            <span></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Borrower</label>
              {borrowers.length === 0 ? (
                <div className="border border-black bg-white p-3 text-xs font-mono text-zinc-400 uppercase tracking-widest">
                  No borrowers found
                </div>
              ) : (
                <select
                  value={formData.borrower_id}
                  onChange={(e) => setFormData({ ...formData, borrower_id: parseInt(e.target.value) })}
                  className={THEME.classes.input}
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Loan Type</label>
              <select
                value={formData.loan_type}
                onChange={(e) => setFormData({ ...formData, loan_type: e.target.value })}
                className={THEME.classes.input}
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Principal Amount (KES)</label>
              <input
                type="number"
                value={formData.principal_amount}
                onChange={(e) => setFormData({ ...formData, principal_amount: parseFloat(e.target.value) || 0 })}
                className={THEME.classes.input}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Term (Months)</label>
              <input
                type="number"
                value={formData.term_months}
                onChange={(e) => setFormData({ ...formData, term_months: parseInt(e.target.value) || 1 })}
                className={THEME.classes.input}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Interest Rate (%)</label>
              <input
                type="number"
                value={formData.interest_rate}
                step="0.01"
                onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) || 0 })}
                className={THEME.classes.input}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Disbursement Method</label>
              <select
                value={formData.disbursement_method}
                onChange={(e) => setFormData({ ...formData, disbursement_method: e.target.value })}
                className={THEME.classes.input}
                required
              >
                <option value="lump_sum">Lump Sum (Full Disbursement)</option>
                <option value="partial">Partial (Multiple Tranches)</option>
                <option value="stage_wise">Stage Wise (Milestone based)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-black/10">
            <button
              type="button"
              onClick={() => router.back()}
              className={THEME.classes.btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={THEME.classes.btnPrimary}
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
      <div className={`${THEME.classes.card} ${expandedPanel === 'preview' ? 'lg:col-span-12' : 'lg:col-span-5'} ${expandedPanel === 'form' ? 'hidden' : 'block'} self-start sticky top-6 max-h-[calc(100vh-140px)] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-black pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-black" />
            <h3 className={THEME.classes.sectionTitle}>Amortization Schedule Preview</h3>
          </div>
          <button
            type="button"
            onClick={() => setExpandedPanel(expandedPanel === 'preview' ? null : 'preview')}
            title={expandedPanel === 'preview' ? "Collapse Preview" : "Expand Preview"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              border: '1px solid #000',
              background: '#fff',
              color: '#000',
              cursor: 'pointer',
              borderRadius: '2px'
            }}
          >
            {expandedPanel === 'preview' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H3v5M16 21h5v-5M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-black p-3 bg-zinc-50">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Monthly Installment</div>
            <div className="text-sm font-bold font-mono text-black mt-1">
              KES {Math.round(schedule.monthlyInstallment).toLocaleString()}
            </div>
          </div>
          <div className="border border-black p-3 bg-zinc-50">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Interest</div>
            <div className="text-sm font-bold font-mono text-black mt-1">
              KES {Math.round(schedule.totalInterest).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Total Payable */}
        <div className="border border-black p-4 mb-4">
          <div className="flex items-center justify-between font-mono text-xs uppercase font-bold mb-3">
            <span>Total Payable</span>
            <span>KES {Math.round(schedule.totalPayable).toLocaleString()}</span>
          </div>
          {/* Visual breakdown bar */}
          <div className="flex h-3 w-full border border-black bg-zinc-100 overflow-hidden">
            <div className="h-full bg-black" style={{ width: `${principalPct}%` }} />
            <div className="h-full bg-zinc-400" style={{ width: `${interestPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2.5 font-mono text-[9px] uppercase tracking-wider">
            <span className="flex items-center gap-1.5 font-bold text-black">
              <span className="w-2.5 h-2.5 bg-black display-inline-block" />
              Principal ({Math.round(principalPct)}%)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-zinc-500">
              <span className="w-2.5 h-2.5 bg-zinc-400 display-inline-block" />
              Interest ({Math.round(interestPct)}%)
            </span>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="border border-black overflow-hidden">
          <table className="min-w-full text-left text-xs font-mono">
            <thead className="bg-black text-white uppercase tracking-wider text-[9px] border-b border-black">
              <tr>
                <th className="px-3 py-2 font-bold">Month</th>
                <th className="px-3 py-2 font-bold text-right">Principal</th>
                <th className="px-3 py-2 font-bold text-right">Interest</th>
                <th className="px-3 py-2 font-bold text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {schedule.rows.map((row) => (
                <tr key={row.month} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-3 py-2 text-zinc-500 font-bold">{row.month}</td>
                  <td className="px-3 py-2 text-right">{Math.round(row.principal).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{Math.round(row.interest).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-bold text-black">{Math.max(0, Math.round(row.balance)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[9px] font-mono text-zinc-400 uppercase tracking-widest leading-relaxed">
          Flat-rate calculation. Actual schedule may vary based on disbursement timing and late penalties.
        </p>
      </div>
    </div>
  );
}
