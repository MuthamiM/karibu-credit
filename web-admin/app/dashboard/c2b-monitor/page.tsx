'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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
      const data = await fetchApi('/loans/transactions');
      
      const mappedLogs = data
        .filter((t: Transaction) => t.type === 'repayment')
        .map((t: Transaction) => {
          const date = new Date(t.created_at);
          const timeStr = date.toLocaleTimeString('en-US', { hour12: false });
          return {
            id: String(t.id),
            time: timeStr,
            phone: '2547*******',
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
    const interval = setInterval(loadTransactions, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={THEME.classes.panel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        <span className={THEME.classes.textMuted}>Loading webhook stream...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={THEME.classes.panel}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>⚠ Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <p className={THEME.classes.subtitle}>M-Pesa API Webhooks</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>C2B Webhook Callback Stream</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Live Safaricom Daraja API webhook validations and confirmation requests. Stream parses incoming Paybill payments and matches Account Reference numbers.
        </p>
      </div>

      <div style={{ border: '1px solid #000', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000', background: '#f4f4f5' }}>
              {['Timestamp', 'M-Pesa Ref', 'MSISDN (Phone)', 'Amount', 'Acc Ref (Loan)', 'Result'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontFamily: 'monospace' }}>
            {c2bLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#71717a' }}>
                  No C2B repayments have been processed yet.
                </td>
              </tr>
            ) : (
              c2bLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '0.75rem 1rem', color: '#71717a' }}>{log.time}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{log.ref}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#71717a' }}>{log.phone}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>KES {log.amount.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#71717a' }}>
                    {log.loanId === 'INVALID' ? <span style={{ fontWeight: 700 }}>UNMATCHED</span> : `#${log.loanId}`}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className={THEME.classes.badgeFilled}>{log.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
