'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api';

type Transaction = {
  id: number;
  loan_id: number;
  type: string;
  amount: number;
  reference_code: string;
  created_at: string;
};

type WebhookLog = {
  id: string;
  time: string;
  phone: string;
  amount: number;
  ref: string;
  loanId: string;
  status: 'SUCCESS' | 'VALIDATION_FAILED' | 'RECONCILED';
};

export default function C2BMonitorPage() {
  const [c2bLogs, setC2bLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTransactions() {
    try {
      // Fetch only repayment transactions
      const data = await fetchApi('/loans/transactions');
      
      const mappedLogs = data
        .filter((t: Transaction) => t.type === 'repayment')
        .map((t: Transaction) => {
          const date = new Date(t.created_at);
          const timeStr = date.toLocaleTimeString('en-US', { hour12: false });
          return {
            id: String(t.id),
            time: timeStr,
            phone: '2547*******', // Mask phone number
            amount: t.amount,
            ref: t.reference_code,
            loanId: String(t.loan_id),
            status: 'RECONCILED' as const,
          };
        });

      setC2bLogs(mappedLogs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load repayments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
    // Poll every 10 seconds to keep live callback stream fresh
    const interval = setInterval(loadTransactions, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading webhook stream...
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
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">M-Pesa API Webhooks</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">C2B Webhook Callback Stream</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Live Safaricom Daraja API webhook validations and confirmation requests. Stream parses incoming Paybill payments and matches Account Reference numbers.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">M-Pesa Ref</th>
              <th className="px-4 py-3 font-medium">MSISDN (Phone)</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Acc Ref (Loan)</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {c2bLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No C2B repayments have been processed yet.
                </td>
              </tr>
            ) : (
              c2bLogs.map((log) => {
                const pillColor =
                  log.status === 'RECONCILED'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : log.status === 'SUCCESS'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-red-600 border-rose-500/20';

                return (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-500">{log.time}</td>
                    <td className="px-4 py-3 text-white font-medium">{log.ref}</td>
                    <td className="px-4 py-3 text-slate-300">{log.phone}</td>
                    <td className="px-4 py-3 text-white font-semibold">KES {log.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {log.loanId === 'INVALID' ? <span className="text-red-600">UNMATCHED</span> : `#${log.loanId}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${pillColor}`}>
                        {log.status}
                      </span>
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
