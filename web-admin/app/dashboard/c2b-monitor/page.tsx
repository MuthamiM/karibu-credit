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

  // Simulator State
  const [simLoanId, setSimLoanId] = useState('');
  const [simPhone, setSimPhone] = useState('254712345678');
  const [simAmount, setSimAmount] = useState('1500');
  const [simTransId, setSimTransId] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simMessage, setSimMessage] = useState('');

  // Generate random M-Pesa transaction code
  useEffect(() => {
    generateRandomTransId();
  }, []);

  function generateRandomTransId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'T';
    for (let i = 0; i < 9; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSimTransId(result);
  }

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

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simLoanId || !simAmount || !simPhone || !simTransId) return;

    setSimLoading(true);
    setSimMessage('');

    try {
      const payload = {
        TransAmount: String(simAmount),
        TransID: simTransId,
        BillRefNumber: String(simLoanId),
        MSISDN: simPhone,
      };

      const res = await fetchApi('/webhooks/mpesa/c2b/confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res && res.ResultCode === 0) {
        setSimMessage(`Success: Simulated Paybill payment of KES ${simAmount} for Loan #${simLoanId} processed!`);
        generateRandomTransId();
        await loadTransactions();
      } else {
        setSimMessage(`Warning: Webhook responded with code ${res?.ResultCode || 'Unknown'}`);
      }
    } catch (err: unknown) {
      setSimMessage(`Error: ${err instanceof Error ? err.message : 'Simulation failed'}`);
    } finally {
      setSimLoading(false);
    }
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Stream table */}
        <div style={{ border: '1px solid #000', overflow: 'hidden' }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', background: '#f4f4f5' }}>
                {['Timestamp', 'M-Pesa Ref', 'MSISDN', 'Amount', 'Acc Ref', 'Result'].map(h => (
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

        {/* Simulator Widget */}
        <div className={THEME.classes.card} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 className={THEME.classes.sectionTitle}>Daraja C2B Webhook Simulator</h3>
          <p className={THEME.classes.textMuted} style={{ textTransform: 'none', fontSize: '11px', lineHeight: 1.4 }}>
            Simulate a successful customer cash payment over Safaricom M-Pesa. This fires the callback handler and triggers our repayment allocation waterfall.
          </p>

          <form onSubmit={handleSimulatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Loan ID (Account Ref)</label>
              <input
                type="number"
                value={simLoanId}
                onChange={(e) => setSimLoanId(e.target.value)}
                placeholder="e.g. 1"
                className={THEME.classes.input}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Phone (MSISDN)</label>
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                className={THEME.classes.input}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Amount (KES)</label>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className={THEME.classes.input}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>M-Pesa Receipt ID</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={simTransId}
                  onChange={(e) => setSimTransId(e.target.value)}
                  className={THEME.classes.input}
                  required
                />
                <button
                  type="button"
                  onClick={generateRandomTransId}
                  className={THEME.classes.btnSecondary}
                  style={{ padding: '0 10px' }}
                >
                  🔄
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={simLoading}
              className={THEME.classes.btnPrimary}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {simLoading ? 'Sending Webhook...' : 'Simulate Payment'}
            </button>
          </form>

          {simMessage && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              border: '1px solid #000',
              fontFamily: 'monospace',
              fontSize: '10px',
              wordBreak: 'break-word',
              background: simMessage.startsWith('Error') ? '#fee2e2' : '#f4f4f5'
            }}>
              {simMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
