'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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
    pending: '#71717a', approved: '#000000', disbursed: '#000000',
    active: '#000000', cleared: '#000000', defaulted: '#18181b',
    rejected: '#71717a', PENDING: '#71717a', PAID: '#000000',
    PARTIAL: '#71717a', OVERDUE: '#18181b',
  };
  return map[s] || '#71717a';
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
      alert(`🟢 Payment simulation: KES ${parseFloat(payAmount).toLocaleString()} for Loan #${payingLoanId}\n\nIn production, this triggers an M-Pesa STK push to your registered phone number.`);
      setPayAmount('');
      setPayingLoanId(null);
    } finally {
      setPaySubmitting(false);
    }
  }

  if (loading) {
    const shimmerRows = Array.from({ length: 6 });
    const kpiCards = Array.from({ length: 4 });
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

        <div className="karibu-skel" style={{ height: 20, width: 240, marginBottom: 20, border: '1px solid #000' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {kpiCards.map((_, i) => (
            <div key={i} style={{ border: '1px solid #000', padding: '1rem' }}>
              <div className="karibu-skel" style={{ height: 10, width: '60%', marginBottom: 10, border: '1px solid #000' }} />
              <div className="karibu-skel" style={{ height: 22, width: '80%', border: '1px solid #000' }} />
            </div>
          ))}
        </div>

        <div className="karibu-skel" style={{ height: 220, width: '100%', marginBottom: '1.5rem', border: '1px solid #000' }} />

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
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 48, borderRadius: 0 }} />
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
        <p className={THEME.classes.subtitle}>Self-Service</p>
        <h2 className={THEME.classes.title + " mt-1"}>Customer Portal</h2>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-2xl">
          View your active loans, track repayment progress, view upcoming installments, and initiate payments or top-up requests.
        </p>
      </div>

      {/* ─── Loan Cards Row ─── */}
      {loans.length === 0 ? (
        <div className={THEME.classes.card + " py-12 text-center"}>
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">No Active Loans found</p>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-1">Contact your loan officer to apply.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loans.map((loan) => {
            const pct = loan.total_payable ? Math.round((loan.total_paid / loan.total_payable) * 100) : 0;
            const isActive = loan.id === selectedLoanId;
            return (
              <div
                key={loan.id}
                onClick={() => setSelectedLoanId(loan.id)}
                className={`p-5 cursor-pointer border transition-colors duration-150 relative ${
                  isActive ? 'border-black bg-zinc-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: statusColor(loan.status),
                }} />

                <div className="flex justify-between items-center mb-4">
                  <span className="font-mono text-xs font-bold text-black">
                    {loan.application_no || `#${loan.id}`}
                  </span>
                  <span className={isActive ? THEME.classes.badgeFilled : THEME.classes.badgeOutline}>
                    {loan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 font-mono text-xs uppercase">
                  <div>
                    <p className="text-[9px] text-zinc-400 font-bold">Principal</p>
                    <p className="font-bold text-black">KES {loan.principal_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-400 font-bold">Outstanding</p>
                    <p className="font-bold text-black">KES {loan.outstanding_balance?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between font-mono text-[9px] text-zinc-400 uppercase font-bold mb-1">
                    <span>Progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                    {loan.product_type} · {loan.tenure_months}mo
                  </span>
                  <button
                    className="border border-black bg-black text-white px-2 py-0.5 text-[9px] font-mono uppercase font-bold tracking-widest hover:bg-zinc-800"
                    onClick={(e) => { e.stopPropagation(); setPayingLoanId(loan.id); }}
                  >
                    Pay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Schedule + Details ─── */}
      {activeLoan && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Repayment Schedule */}
          <div className={`${THEME.classes.card} lg:col-span-8`}>
            <div className="border-b border-black pb-3 mb-4">
              <h3 className={THEME.classes.sectionTitle}>Repayment Schedule</h3>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Loan #{activeLoan.id} — {formatDate(activeLoan.first_due_date)} to {formatDate(activeLoan.final_due_date)}
              </p>
            </div>

            {scheduleLoading ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-400 uppercase tracking-widest">
                Loading schedule…
              </div>
            ) : schedule.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-400 uppercase tracking-widest">
                No schedule lines available.
              </div>
            ) : (
              <div className="overflow-x-auto border border-black">
                <table className="min-w-full text-left text-xs font-mono">
                  <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
                    <tr>
                      <th className="px-4 py-3 font-bold">#</th>
                      <th className="px-4 py-3 font-bold">Principal</th>
                      <th className="px-4 py-3 font-bold">Interest</th>
                      <th className="px-4 py-3 font-bold">Total Due</th>
                      <th className="px-4 py-3 font-bold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {schedule.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-black">{line.installment_no}</td>
                        <td className="px-4 py-3">KES {line.principal_due?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-500">KES {line.interest_due?.toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold text-black">KES {line.total_due?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-400">KES {line.remaining_principal?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Loan Details Card */}
          <div className={`${THEME.classes.card} lg:col-span-4 space-y-4`}>
            <h4 className={THEME.classes.sectionTitle}>Loan Details</h4>

            <div className="space-y-2 font-mono text-xs uppercase border-b border-black pb-3">
              {[
                { label: 'Application No', value: activeLoan.application_no || `#${activeLoan.id}` },
                { label: 'Product', value: activeLoan.product_type },
                { label: 'Principal', value: `KES ${activeLoan.principal_amount?.toLocaleString()}` },
                { label: 'Interest Rate', value: `${activeLoan.interest_rate}% / month` },
                { label: 'Tenure', value: `${activeLoan.tenure_months} months` },
                { label: 'Total Payable', value: `KES ${activeLoan.total_payable?.toLocaleString() || '—'}` },
                { label: 'Amount Paid', value: `KES ${activeLoan.total_paid?.toLocaleString()}` },
                { label: 'Outstanding', value: `KES ${activeLoan.outstanding_balance?.toLocaleString()}` },
                { label: 'Penalties', value: `KES ${activeLoan.penalty_balance?.toLocaleString()}` },
                { label: 'First Due', value: formatDate(activeLoan.first_due_date) },
                { label: 'Final Due', value: formatDate(activeLoan.final_due_date) },
                { label: 'Disbursement', value: activeLoan.disbursement_method?.replace(/_/g, ' ') },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-1 border-b border-zinc-100 last:border-b-0">
                  <span className="text-zinc-500 text-[10px]">{row.label}</span>
                  <span className="font-bold text-black text-[10px]">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                className={THEME.classes.btnPrimary + " w-full"}
                onClick={() => setPayingLoanId(activeLoan.id)}
              >
                Make Payment
              </button>
              {['disbursed', 'active'].includes(activeLoan.status) && (
                <button
                  className={THEME.classes.btnSecondary + " w-full"}
                  onClick={() => alert('Navigate to the Top-Up page in the sidebar to apply.')}
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
        <div className={THEME.classes.card}>
          <div className="border-b border-black pb-3 mb-4">
            <h3 className={THEME.classes.sectionTitle}>Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto border border-black">
            <table className="min-w-full text-left text-xs font-mono">
              <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Reference</th>
                  <th className="px-4 py-3 font-bold">Loan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {transactions.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-3 font-bold text-black uppercase">{tx.type}</td>
                    <td className="px-4 py-3 font-bold text-black">KES {tx.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-500 font-bold">{tx.reference_code}</td>
                    <td className="px-4 py-3 font-bold text-black">#{tx.loan_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Payment Modal ─── */}
      {payingLoanId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPayingLoanId(null)}
        >
          <form
            onSubmit={submitPayment}
            onClick={(e) => e.stopPropagation()}
            className={`${THEME.classes.card} w-[380px] space-y-4`}
          >
            <div className="text-center border-b border-black pb-4">
              <h3 className={THEME.classes.sectionTitle}>Make Payment</h3>
              <p className="text-[10px] font-mono text-zinc-500 mt-1">
                Loan #{payingLoanId} · M-Pesa Paybill
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Amount (KES)</label>
              <input
                type="number"
                className={THEME.classes.input + " text-center text-lg font-bold"}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
                min={1}
              />
            </div>

            <div className="bg-zinc-50 border border-black p-3 text-[10px] font-mono text-zinc-500 uppercase tracking-wider leading-relaxed">
               In simulation: clicking "Pay Now" fires a mock M-Pesa STK Push. In production, this prompts the user device.
            </div>

            <div className="flex gap-2 pt-2 border-t border-black/10">
              <button type="button" className={THEME.classes.btnSecondary + " flex-1"} onClick={() => setPayingLoanId(null)}>Cancel</button>
              <button type="submit" disabled={paySubmitting} className={THEME.classes.btnPrimary + " flex-1"}>
                {paySubmitting ? 'Processing…' : 'Pay Now'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
