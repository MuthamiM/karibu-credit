'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

/* ─── Types ─── */
type LoanItem = {
  id: number;
  application_no?: string;
  user_id: number;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  total_payable: number;
  total_paid: number;
  outstanding_balance: number;
  status: string;
  product_type: string;
  created_at: string;
};

type TopUpResult = {
  loan_id: number;
  original_outstanding: number;
  top_up_amount: number;
  new_principal: number;
  new_tenure_months: number;
  new_total_payable: number;
  new_monthly_installment: number;
  status: string;
};

type UserInfo = { id: number; full_name: string };

export default function TopUpsPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [userMap, setUserMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Top-Up form state */
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [additionalMonths, setAdditionalMonths] = useState('0');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TopUpResult | null>(null);

  async function loadData() {
    try {
      const [loansData, usersData] = await Promise.all([
        fetchApi('/loans/'),
        fetchApi('/users/?role=borrower'),
      ]);
      setLoans(loansData);
      const map = new Map<number, string>();
      usersData.forEach((u: UserInfo) => map.set(u.id, u.full_name));
      setUserMap(map);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  /* Only show loans that are eligible for top-up (disbursed or active) */
  const eligibleLoans = loans.filter((l) =>
    ['disbursed', 'active'].includes(l.status)
  );

  function repaymentPct(loan: LoanItem): number {
    if (!loan.total_payable || loan.total_payable === 0) return 0;
    return Math.round((loan.total_paid / loan.total_payable) * 100);
  }

  function isEligible(loan: LoanItem): boolean {
    return repaymentPct(loan) >= 50;
  }

  async function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoan || !topUpAmount) return;
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await fetchApi(`/loans/${selectedLoan.id}/top-up`, {
        method: 'POST',
        body: JSON.stringify({
          top_up_amount: parseFloat(topUpAmount),
          additional_tenure_months: parseInt(additionalMonths) || 0,
          reason: reason || null,
        }),
      });
      setResult(resp);
      setTopUpAmount('');
      setAdditionalMonths('0');
      setReason('');
      await loadData();
    } catch (err: unknown) {
      alert(`Top-up failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 0 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={THEME.classes.card}>
        <p className="text-black font-mono text-xs uppercase tracking-wider">⚠ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className={THEME.classes.card}>
        <p className={THEME.classes.subtitle}>Credit Facility</p>
        <h2 className={THEME.classes.title + " mt-1"}>Loan Top-Up Applications</h2>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-2xl">
          Process top-up requests for active loans. The outstanding balance is merged with the top-up amount to form a new principal,
          and the repayment schedule is recalculated. Borrowers must have repaid &ge;50% to qualify.
        </p>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active/Disbursed Loans', value: eligibleLoans.length },
          { label: 'Eligible for Top-Up', value: eligibleLoans.filter(isEligible).length },
          {
            label: 'Total Outstanding',
            value: `KES ${(eligibleLoans.reduce((s, l) => s + l.outstanding_balance, 0) / 1e6).toFixed(1)}M`,
          },
          {
            label: 'Avg Repayment %',
            value: eligibleLoans.length
              ? `${Math.round(eligibleLoans.reduce((s, l) => s + repaymentPct(l), 0) / eligibleLoans.length)}%`
              : '0%',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-black p-3 bg-white">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {kpi.label}
            </p>
            <p className="text-2xl font-black font-mono text-black mt-2">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Content Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Loans Table */}
        <div className={`${THEME.classes.card} lg:col-span-8 overflow-hidden`}>
          <div className="border-b border-black pb-3 mb-4">
            <h3 className={THEME.classes.sectionTitle}>Active &amp; Disbursed Loans</h3>
          </div>
          <div className="overflow-x-auto border border-black bg-white">
            <table className="min-w-full text-left text-xs font-mono">
              <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
                <tr>
                  <th className="px-4 py-3 font-bold">Loan</th>
                  <th className="px-4 py-3 font-bold">Borrower</th>
                  <th className="px-4 py-3 font-bold">Outstanding</th>
                  <th className="px-4 py-3 font-bold">Repaid</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {eligibleLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400 uppercase tracking-widest">
                      No active loans eligible for top-up.
                    </td>
                  </tr>
                ) : (
                  eligibleLoans.map((loan) => {
                    const pct = repaymentPct(loan);
                    const eligible = isEligible(loan);
                    const isSelected = selectedLoan?.id === loan.id;
                    return (
                      <tr
                        key={loan.id}
                        className={`hover:bg-zinc-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-zinc-100' : ''
                        }`}
                        onClick={() => eligible && setSelectedLoan(loan)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-black">
                            #{loan.id}
                          </div>
                          <div className="text-[9px] text-zinc-500 mt-0.5 uppercase">
                            {loan.product_type}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {userMap.get(loan.user_id) || `User #${loan.user_id}`}
                        </td>
                        <td className="px-4 py-3 font-bold text-black">
                          KES {loan.outstanding_balance?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-200 overflow-hidden min-w-[60px]">
                              <div
                                className="h-full bg-black transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-bold text-black">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={eligible ? THEME.classes.badgeFilled : THEME.classes.badgeOutline}>
                            {eligible ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {eligible && (
                            <button
                              className="border border-black bg-black text-white hover:bg-zinc-800 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest"
                              onClick={(e) => { e.stopPropagation(); setSelectedLoan(loan); }}
                            >
                              Top Up
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top-Up Form Panel */}
        <div className={`${THEME.classes.card} lg:col-span-4 space-y-4`}>
          <h3 className={THEME.classes.sectionTitle}>Process Top-Up</h3>

          {!selectedLoan ? (
            <div className="flex flex-col items-center justify-center py-12 text-center font-mono text-xs uppercase tracking-widest text-zinc-400">
              <p>Select an eligible loan from the table to process a top-up.</p>
            </div>
          ) : (
            <>
              {/* Loan Summary */}
              <div className="border border-black p-3 bg-zinc-50 font-mono text-xs uppercase space-y-2">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-1">
                  <span className="font-bold text-black">
                    Loan #{selectedLoan.id}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {selectedLoan.product_type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-zinc-500">Outstanding</span>
                    <p className="font-bold text-black mt-0.5">KES {selectedLoan.outstanding_balance?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Total Paid</span>
                    <p className="font-bold text-black mt-0.5">KES {selectedLoan.total_paid?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Rate</span>
                    <p className="font-bold text-black mt-0.5">{selectedLoan.interest_rate}% /mo</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Tenure</span>
                    <p className="font-bold text-black mt-0.5">{selectedLoan.tenure_months} months</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={submitTopUp} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Top-Up Amount (KES)</label>
                  <input
                    type="number"
                    className={THEME.classes.input}
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="e.g. 100000"
                    required
                    min={1}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Additional Tenure (months)</label>
                  <input
                    type="number"
                    className={THEME.classes.input}
                    value={additionalMonths}
                    onChange={(e) => setAdditionalMonths(e.target.value)}
                    min={0}
                    max={24}
                  />
                  <p className="mt-1.5 text-[9px] font-mono text-zinc-400 uppercase tracking-widest leading-relaxed">
                    Set to 0 to keep the original tenure. Positive values extend the loan period.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reason (optional)</label>
                  <input
                    type="text"
                    className={THEME.classes.input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="BUSINESS EXPANSION, EMERGENCY, ETC."
                  />
                </div>

                {topUpAmount && (
                  <div className="border border-black p-3 bg-zinc-50 font-mono uppercase text-xs">
                    <p className="text-[9px] font-bold text-zinc-400">Projected New Principal</p>
                    <p className="text-lg font-black text-black mt-1">
                      KES {(selectedLoan.outstanding_balance + parseFloat(topUpAmount || '0')).toLocaleString()}
                    </p>
                    <p className="text-[8px] text-zinc-400 mt-1">
                      = KES {selectedLoan.outstanding_balance?.toLocaleString()} outstanding + KES {parseFloat(topUpAmount || '0').toLocaleString()} top-up
                    </p>
                  </div>
                )}

                <button type="submit" disabled={submitting} className={THEME.classes.btnPrimary + " w-full"}>
                  {submitting ? 'Processing Top-Up…' : 'Submit Top-Up Request'}
                </button>
              </form>

              {/* Result */}
              {result && (
                <div className="border-2 border-black p-4 bg-zinc-50 font-mono uppercase text-xs space-y-2">
                  <p className="font-bold text-black border-b border-zinc-200 pb-1 mb-2">
                    ✓ Top-Up Applied Successfully
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <span className="text-zinc-500">New Principal:</span>
                    <span className="font-bold text-black">KES {result.new_principal?.toLocaleString()}</span>
                    <span className="text-zinc-500">New Tenure:</span>
                    <span className="font-bold text-black">{result.new_tenure_months} months</span>
                    <span className="text-zinc-500">New Total Payable:</span>
                    <span className="font-bold text-black">KES {result.new_total_payable?.toLocaleString()}</span>
                    <span className="text-zinc-500">New EMI:</span>
                    <span className="font-bold text-black">KES {result.new_monthly_installment?.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
