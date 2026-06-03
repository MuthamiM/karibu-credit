'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

type UserInfo = {
  id: number;
  full_name: string;
};

type LoanItem = {
  id: number;
  user_id: number;
  principal_amount: number;
  amount_disbursed: number;
  status: string;
  disbursement_method: string;
};

type TrancheLoan = {
  id: number;
  borrower: string;
  total: number;
  disbursed: number;
  nextTranche: number;
  status: string;
};

export default function TranchesPage() {
  const [loans, setLoans] = useState<TrancheLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  async function loadData() {
    try {
      const [loansData, usersData] = await Promise.all([
        fetchApi('/loans/'),
        fetchApi('/users/?role=borrower')
      ]);

      const userMap = new Map<number, string>();
      usersData.forEach((u: UserInfo) => {
        userMap.set(u.id, u.full_name);
      });

      // Filter for partial or stage-wise disbursement loans
      const filtered = loansData
        .filter((l: LoanItem) => 
          l.disbursement_method === 'partial' || l.disbursement_method === 'stage_wise'
        )
        .map((l: LoanItem) => {
          const total = l.principal_amount;
          const disbursed = l.amount_disbursed || 0;
          const remaining = total - disbursed;
          // Set next tranche to be 25% of principal, or remaining amount if less
          const chunk = total / 4;
          const nextTranche = remaining > 0 ? Math.min(remaining, chunk) : 0;

          return {
            id: l.id,
            borrower: userMap.get(l.user_id) || `Borrower #${l.user_id}`,
            total,
            disbursed,
            nextTranche,
            status: l.status,
          };
        });

      setLoans(filtered);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tranches');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleReleaseTranche = async (id: number, amount: number) => {
    if (amount <= 0) return;
    setActionLoading(id);
    try {
      await fetchApi(`/loans/${id}/disburse_tranche`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          reference_note: `Tranche disbursement of KES ${amount}`
        })
      });
      await loadData();
    } catch (err: unknown) {
      alert(`Disbursement failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading stage-wise disbursements...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card rounded-3xl p-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Multi-Tranche Portfolio</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Stage-Wise Disbursement Panel</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Release project funds in installment chunks (tranches) based on inspection milestones, construction completions, or agribusiness reports.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-3.5 font-medium">Loan ID</th>
              <th className="px-4 py-3.5 font-medium">Borrower</th>
              <th className="px-4 py-3.5 font-medium">Total Principal</th>
              <th className="px-4 py-3.5 font-medium">Disbursed Balance</th>
              <th className="px-4 py-3.5 font-medium">Progress</th>
              <th className="px-4 py-3.5 font-medium">Next Tranche</th>
              <th className="px-4 py-3.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loans.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No active stage-wise or partial disbursement loans found.
                </td>
              </tr>
            ) : (
              loans.map((loan) => {
                const percentage = (loan.disbursed / loan.total) * 100;
                const isComplete = loan.disbursed >= loan.total;
                return (
                  <tr key={loan.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 text-slate-500 font-mono">#{loan.id}</td>
                    <td className="px-4 py-3.5 text-white font-medium">{loan.borrower}</td>
                    <td className="px-4 py-3.5 text-slate-300">KES {loan.total.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-semibold">KES {loan.disbursed.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${percentage}%` }}></div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold">{Math.round(percentage)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {isComplete ? '—' : `KES ${loan.nextTranche.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3.5">
                      {isComplete ? (
                        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">FULLY DISBURSED</span>
                      ) : (
                        <button
                          onClick={() => handleReleaseTranche(loan.id, loan.nextTranche)}
                          disabled={actionLoading === loan.id}
                          className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all duration-200"
                        >
                          {actionLoading === loan.id ? 'Processing...' : 'Disburse Tranche'}
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
  );
}
