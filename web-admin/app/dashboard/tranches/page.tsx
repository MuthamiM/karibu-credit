'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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

      const filtered = loansData
        .filter((l: LoanItem) => 
          l.disbursement_method === 'partial' || l.disbursement_method === 'stage_wise'
        )
        .map((l: LoanItem) => {
          const total = l.principal_amount;
          const disbursed = l.amount_disbursed || 0;
          const remaining = total - disbursed;
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
    const shimmerRows = Array.from({ length: 8 });
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <style>{`
          @keyframes karibuShimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .karibu-skel {
            background: linear-gradient(90deg, #e5e5e5 0px, #f5f5f5 40px, #e5e5e5 80px);
            background-size: 800px 100%;
            animation: karibuShimmer 1.4s linear infinite;
          }
        `}</style>
        <div className="karibu-skel" style={{ height: 20, width: 220, marginBottom: 24, border: '1px solid #000' }} />
        <div style={{ border: '1px solid #000' }}>
          {shimmerRows.map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.85rem 1rem',
                borderBottom: i === shimmerRows.length - 1 ? 'none' : '1px solid #000',
              }}
            >
              <div className="karibu-skel" style={{ height: 32, width: 32, flexShrink: 0, border: '1px solid #000' }} />
              <div style={{ flex: 1 }}>
                <div className="karibu-skel" style={{ height: 12, width: '40%', marginBottom: 6, border: '1px solid #000' }} />
                <div className="karibu-skel" style={{ height: 10, width: '25%', border: '1px solid #000' }} />
              </div>
              <div className="karibu-skel" style={{ height: 20, width: 70, border: '1px solid #000' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={THEME.classes.panel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        <span className={THEME.classes.textMuted}>Loading stage-wise disbursements...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={THEME.classes.panel}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>⚠ Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <p className={THEME.classes.subtitle}>Multi-Tranche Portfolio</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>Stage-Wise Disbursement Panel</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Release project funds in installment chunks (tranches) based on inspection milestones, construction completions, or agribusiness reports.
        </p>
      </div>

      <div style={{ border: '1px solid #000', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000', background: '#f4f4f5' }}>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Loan ID</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Borrower</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Total Principal</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Disbursed</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Progress</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Next Tranche</th>
              <th style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#71717a' }}>
                  No active stage-wise or partial disbursement loans found.
                </td>
              </tr>
            ) : (
              loans.map((loan) => {
                const percentage = (loan.disbursed / loan.total) * 100;
                const isComplete = loan.disbursed >= loan.total;
                return (
                  <tr key={loan.id} style={{ borderBottom: '1px solid #e4e4e7', transition: 'background 0.15s' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#71717a' }}>#{loan.id}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{loan.borrower}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>KES {loan.total.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>KES {loan.disbursed.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ height: 6, width: 96, background: '#e4e4e7', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: '#000', transition: 'width 0.3s', width: `${percentage}%` }}></div>
                        </div>
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, fontFamily: 'monospace' }}>{Math.round(percentage)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {isComplete ? '—' : `KES ${loan.nextTranche.toLocaleString()}`}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {isComplete ? (
                        <span className={THEME.classes.badgeFilled}>FULLY DISBURSED</span>
                      ) : (
                        <button
                          onClick={() => handleReleaseTranche(loan.id, loan.nextTranche)}
                          disabled={actionLoading === loan.id}
                          className={THEME.classes.btnPrimary}
                          style={{ fontSize: '0.625rem', padding: '0.35rem 0.75rem' }}
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
