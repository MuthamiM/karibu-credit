'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

/* ─── Types ─── */
type ScheduleLine = {
  id: number;
  instalment_no: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  amount_paid: number;
  status: string;
};

type LoanItem = {
  id: number;
  application_no?: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  total_payable: number;
  total_paid: number;
  outstanding_balance: number;
  penalty_balance: number;
  status: string;
  product_type: string;
  disbursement_method: string;
  first_due_date: string | null;
  final_due_date: string | null;
  created_at: string;
  repayment_schedules?: ScheduleLine[];
};

type Transaction = {
  id: number;
  loan_id: number;
  type: string;
  amount: number;
  reference_code: string;
  created_at: string;
};

/* ─── Helpers ─── */
function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    pending: '#f59e0b', approved: '#0ea5e9', disbursed: '#6366f1',
    active: '#10b981', cleared: '#10b981', defaulted: '#ef4444',
    rejected: '#64748b', PENDING: '#f59e0b', PAID: '#10b981',
    PARTIAL: '#0ea5e9', OVERDUE: '#ef4444',
  };
  return map[s] || '#64748b';
}

export default function CustomerPortalPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleLine[]>([]);

  /* Simulated payment */
  const [payAmount, setPayAmount] = useState('');
  const [payingLoanId, setPayingLoanId] = useState<number | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  async function loadData() {
    try {
      const [loansData, txData] = await Promise.all([
        fetchApi('/loans/me'),
        fetchApi('/loans/transactions').catch(() => []),
      ]);
      setLoans(loansData);
      setTransactions(txData);
      if (loansData.length > 0 && !selectedLoanId) {
        setSelectedLoanId(loansData[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load portal data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedLoanId) return;
    setScheduleLoading(true);
    fetchApi(`/loans/${selectedLoanId}/schedule`)
      .then((data) => {
        setSchedule(data.schedule_lines || []);
      })
      .catch(() => setSchedule([]))
      .finally(() => setScheduleLoading(false));
  }, [selectedLoanId]);

  const activeLoan = loans.find((l) => l.id === selectedLoanId);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingLoanId || !payAmount) return;
    setPaySubmitting(true);
    try {
      // In production, this triggers an M-Pesa STK push. Here we simulate it.
      alert(`🟢 Payment simulation: KES ${parseFloat(payAmount).toLocaleString()} for Loan #${payingLoanId}\n\nIn production, this triggers an M-Pesa STK push to your registered phone number.`);
      setPayAmount('');
      setPayingLoanId(null);
    } finally {
      setPaySubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 14 }} />
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
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(14,165,233,0.08) 100%)',
        border: '1px solid var(--border)', borderRadius: 20,
        padding: '1.75rem 2rem', boxShadow: 'var(--shadow-card)',
      }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0ea5e9' }}>
          Self-Service
        </p>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
          Customer Portal
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6, maxWidth: 550 }}>
          View your active loans, track repayment progress, view upcoming installments, and initiate payments or top-up requests.
        </p>
      </div>

      {/* ─── Loan Cards Row ─── */}
      {loans.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          padding: '3rem', textAlign: 'center',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2" style={{ margin: '0 auto 1rem', opacity: 0.4 }}>
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Active Loans</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>You currently have no loan records. Contact your loan officer to apply.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(loans.length, 3)}, 1fr)`, gap: '1rem' }}>
          {loans.map((loan) => {
            const pct = loan.total_payable ? Math.round((loan.total_paid / loan.total_payable) * 100) : 0;
            const isActive = loan.id === selectedLoanId;
            return (
              <div
                key={loan.id}
                onClick={() => setSelectedLoanId(loan.id)}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                  borderRadius: 16, padding: '1.25rem', cursor: 'pointer',
                  boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${statusColor(loan.status)}, transparent)`,
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>
                    {loan.application_no || `#${loan.id}`}
                  </span>
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '2px 8px', borderRadius: 99,
                    background: `${statusColor(loan.status)}15`,
                    color: statusColor(loan.status),
                    border: `1px solid ${statusColor(loan.status)}30`,
                  }}>
                    {loan.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Principal</p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700 }}>KES {loan.principal_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Outstanding</p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ef4444' }}>KES {loan.outstanding_balance?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                    <span>Repayment Progress</span>
                    <span style={{ fontWeight: 700, color: pct >= 100 ? '#10b981' : '#0ea5e9' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.min(100, pct)}%`,
                      background: pct >= 100
                        ? '#10b981'
                        : 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {loan.product_type.toUpperCase()} · {loan.tenure_months}mo · {loan.interest_rate}%
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.625rem', padding: '0.15rem 0.4rem', color: '#10b981' }}
                    onClick={(e) => { e.stopPropagation(); setPayingLoanId(loan.id); }}
                  >
                    Pay →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Schedule + Details ─── */}
      {activeLoan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem' }}>
          {/* Repayment Schedule */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
            overflow: 'hidden', boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Repayment Schedule
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Loan #{activeLoan.id} — {formatDate(activeLoan.first_due_date)} to {formatDate(activeLoan.final_due_date)}
              </p>
            </div>

            {scheduleLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Loading schedule…
              </div>
            ) : schedule.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No schedule lines available. The loan may not have been approved yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total Due</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#6366f1' }}>{line.installment_no}</td>
                      <td>KES {line.principal_due?.toLocaleString()}</td>
                      <td style={{ color: '#f59e0b' }}>KES {line.interest_due?.toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>KES {line.total_due?.toLocaleString()}</td>
                      <td style={{ color: 'var(--text-muted)' }}>KES {line.remaining_principal?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Loan Details Card */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '1.25rem', boxShadow: 'var(--shadow-card)',
            display: 'flex', flexDirection: 'column', gap: '0.875rem',
          }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.875rem' }}>Loan Details</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Application No', value: activeLoan.application_no || `#${activeLoan.id}` },
                { label: 'Product', value: activeLoan.product_type.toUpperCase() },
                { label: 'Principal', value: `KES ${activeLoan.principal_amount?.toLocaleString()}` },
                { label: 'Interest Rate', value: `${activeLoan.interest_rate}% / month` },
                { label: 'Tenure', value: `${activeLoan.tenure_months} months` },
                { label: 'Total Payable', value: `KES ${activeLoan.total_payable?.toLocaleString() || '—'}` },
                { label: 'Amount Paid', value: `KES ${activeLoan.total_paid?.toLocaleString()}`, color: '#10b981' },
                { label: 'Outstanding', value: `KES ${activeLoan.outstanding_balance?.toLocaleString()}`, color: '#ef4444' },
                { label: 'Penalties', value: `KES ${activeLoan.penalty_balance?.toLocaleString()}`, color: activeLoan.penalty_balance > 0 ? '#ef4444' : undefined },
                { label: 'First Due', value: formatDate(activeLoan.first_due_date) },
                { label: 'Final Due', value: formatDate(activeLoan.final_due_date) },
                { label: 'Disbursement', value: activeLoan.disbursement_method?.replace(/_/g, ' ').toUpperCase() },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: (row as any).color || 'var(--text-primary)' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', fontSize: '0.75rem' }}
                onClick={() => setPayingLoanId(activeLoan.id)}
              >
                Make Payment
              </button>
              {['disbursed', 'active'].includes(activeLoan.status) && (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.75rem' }}
                  onClick={() => alert('Top-up request feature: Navigate to the Top-Up Applications page from the sidebar to apply.')}
                >
                  Request Top-Up
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Recent Transactions ─── */}
      {transactions.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          overflow: 'hidden', boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Recent Transactions
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Loan</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.created_at)}</td>
                  <td>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase',
                      color: tx.type === 'repayment' ? '#10b981'
                        : tx.type === 'disbursement' ? '#6366f1'
                        : tx.type === 'penalty' ? '#ef4444' : '#64748b',
                    }}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>KES {tx.amount?.toLocaleString()}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{tx.reference_code}</td>
                  <td style={{ fontSize: '0.75rem' }}>#{tx.loan_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Payment Modal ─── */}
      {payingLoanId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
          onClick={() => setPayingLoanId(null)}
        >
          <form
            onSubmit={submitPayment}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '1.75rem', width: 380, boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: '0 auto 8px',
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" />
                </svg>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Make Payment</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Loan #{payingLoanId} · M-Pesa Paybill
              </p>
            </div>

            <div>
              <label className="form-label">Amount (KES)</label>
              <input
                type="number"
                className="form-input"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
                min={1}
                style={{ fontSize: '1.125rem', fontWeight: 700, textAlign: 'center', padding: '0.75rem' }}
              />
            </div>

            <div style={{
              background: 'var(--surface-2)', borderRadius: 10, padding: '0.625rem 0.75rem',
              fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              💡 In production, clicking "Pay Now" triggers an <strong style={{ color: '#10b981' }}>M-Pesa STK Push</strong> to your registered phone number. Confirm the transaction on your device.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPayingLoanId(null)}>Cancel</button>
              <button type="submit" disabled={paySubmitting} className="btn btn-primary" style={{ flex: 2 }}>
                {paySubmitting ? 'Processing…' : 'Pay Now'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
