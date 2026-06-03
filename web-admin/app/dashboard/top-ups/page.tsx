'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2rem' }}>
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>⚠ {error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ─── Header ─── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
        padding: '1.5rem 1.75rem', boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8b5cf6' }}>
          Credit Facility
        </p>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
          Loan Top-Up Applications
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6, maxWidth: 600 }}>
          Process top-up requests for active loans. The outstanding balance is merged with the top-up amount to form a new principal,
          and the repayment schedule is recalculated. Borrowers must have repaid &ge;50% to qualify.
        </p>
      </div>

      {/* ─── KPI Strip ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Active/Disbursed Loans', value: eligibleLoans.length, color: '#6366f1' },
          { label: 'Eligible for Top-Up', value: eligibleLoans.filter(isEligible).length, color: '#10b981' },
          {
            label: 'Total Outstanding',
            value: `KES ${(eligibleLoans.reduce((s, l) => s + l.outstanding_balance, 0) / 1e6).toFixed(1)}M`,
            color: '#f59e0b',
          },
          {
            label: 'Avg Repayment %',
            value: eligibleLoans.length
              ? `${Math.round(eligibleLoans.reduce((s, l) => s + repaymentPct(l), 0) / eligibleLoans.length)}%`
              : '0%',
            color: '#0ea5e9',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {kpi.label}
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Content Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem' }}>
        {/* Loans Table */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          overflow: 'hidden', boxShadow: 'var(--shadow-card)',
        }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan</th>
                <th>Borrower</th>
                <th>Outstanding</th>
                <th>Repaid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {eligibleLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(99, 102, 241, 0.06)' : undefined,
                      }}
                      onClick={() => eligible && setSelectedLoan(loan)}
                    >
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>
                          #{loan.id}
                        </div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 1, textTransform: 'uppercase' }}>
                          {loan.product_type}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {userMap.get(loan.user_id) || `User #${loan.user_id}`}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        KES {loan.outstanding_balance?.toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                            <div style={{
                              height: '100%', borderRadius: 99,
                              width: `${pct}%`,
                              background: pct >= 50
                                ? 'linear-gradient(90deg, #10b981, #0ea5e9)'
                                : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 700,
                            color: pct >= 50 ? '#10b981' : '#f59e0b',
                          }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td>
                        {eligible ? (
                          <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>Eligible</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.625rem' }}>Not Eligible</span>
                        )}
                      </td>
                      <td>
                        {eligible && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', color: '#8b5cf6' }}
                            onClick={(e) => { e.stopPropagation(); setSelectedLoan(loan); }}
                          >
                            Top Up →
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

        {/* Top-Up Form Panel */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          padding: '1.5rem', boxShadow: 'var(--shadow-card)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Process Top-Up</h3>

          {!selectedLoan ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: '2rem' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity={0.4}>
                <path d="M12 4v16m8-8H4" strokeLinecap="round" />
              </svg>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Select an eligible loan from the table to process a top-up.
              </p>
            </div>
          ) : (
            <>
              {/* Loan Summary */}
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '0.875rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#6366f1', fontWeight: 700 }}>
                    Loan #{selectedLoan.id}
                  </span>
                  <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedLoan.product_type}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: 8 }}>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ef4444' }}>KES {selectedLoan.outstanding_balance?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Paid</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981' }}>KES {selectedLoan.total_paid?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Rate</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{selectedLoan.interest_rate}% /mo</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tenure</p>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{selectedLoan.tenure_months} months</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={submitTopUp} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label className="form-label">Top-Up Amount (KES)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="e.g. 100000"
                    required
                    min={1}
                  />
                </div>
                <div>
                  <label className="form-label">Additional Tenure (months)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={additionalMonths}
                    onChange={(e) => setAdditionalMonths(e.target.value)}
                    min={0}
                    max={24}
                  />
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    Set to 0 to keep the original tenure. Positive values extend the loan period.
                  </p>
                </div>
                <div>
                  <label className="form-label">Reason (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Business expansion, emergency, etc."
                  />
                </div>

                {topUpAmount && (
                  <div style={{
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                    borderRadius: 10, padding: '0.625rem 0.75rem',
                  }}>
                    <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Projected New Principal
                    </p>
                    <p style={{ fontSize: '1.125rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                      KES {(selectedLoan.outstanding_balance + parseFloat(topUpAmount || '0')).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      = KES {selectedLoan.outstanding_balance?.toLocaleString()} outstanding + KES {parseFloat(topUpAmount || '0').toLocaleString()} top-up
                    </p>
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                  {submitting ? 'Processing Top-Up…' : 'Submit Top-Up Request'}
                </button>
              </form>

              {/* Result */}
              {result && (
                <div style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 12, padding: '1rem',
                }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>
                    ✓ Top-Up Applied Successfully
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.75rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>New Principal:</span></div>
                    <div style={{ fontWeight: 700 }}>KES {result.new_principal?.toLocaleString()}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>New Tenure:</span></div>
                    <div style={{ fontWeight: 700 }}>{result.new_tenure_months} months</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>New Total Payable:</span></div>
                    <div style={{ fontWeight: 700 }}>KES {result.new_total_payable?.toLocaleString()}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>New EMI:</span></div>
                    <div style={{ fontWeight: 700, color: '#6366f1' }}>KES {result.new_monthly_installment?.toLocaleString()}</div>
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
