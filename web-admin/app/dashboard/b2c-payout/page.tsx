'use client';

import { useState } from 'react';
import { THEME } from '@/theme';

export default function B2CPayoutPage() {
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLogs, setPayoutLogs] = useState<string[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const triggerPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutPhone || !payoutAmount) return;
    setPayoutLoading(true);
    setPayoutLogs((prev) => [`[${new Date().toLocaleTimeString()}] Initializing B2C Disbursement Request...`, ...prev]);

    setTimeout(() => {
      setPayoutLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] RESPONSE: SUCCESS\nTransaction ID: MPE_B2C_${Math.random().toString(36).substring(2, 8).toUpperCase()}\nAmount Disbursed: KES ${payoutAmount}\nRecipient: ${payoutPhone}\nCode: 200 OK`,
        ...prev,
      ]);
      setPayoutLoading(false);
      setPayoutPhone('');
      setPayoutAmount('');
    }, 1500);
  };

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <p className={THEME.classes.subtitle}>M-Pesa Disbursement Gateway</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>Direct B2C Payout Portal</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Approve and manually disburse funds directly to a customer&apos;s phone number using the Safaricom B2C Disbursement API channel.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <form onSubmit={triggerPayout} style={{ border: '1px solid #000', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Disbursement Request Details</h3>
          
          <div>
            <label className={THEME.classes.textMuted} style={{ display: 'block', marginBottom: 6 }}>Borrower Mobile Number</label>
            <input
              type="text"
              value={payoutPhone}
              onChange={(e) => setPayoutPhone(e.target.value)}
              className={THEME.classes.input}
              placeholder="e.g. 254712345678"
              required
            />
          </div>

          <div>
            <label className={THEME.classes.textMuted} style={{ display: 'block', marginBottom: 6 }}>Disbursement Amount (KES)</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className={THEME.classes.input}
              placeholder="e.g. 15000"
              required
            />
          </div>

          <button
            type="submit"
            disabled={payoutLoading}
            className={THEME.classes.btnPrimary}
            style={{ width: '100%' }}
          >
            {payoutLoading ? 'Authorizing Gateway...' : 'Execute Direct Disbursement'}
          </button>
        </form>

        <div style={{ border: '1px solid #000', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.6875rem', color: '#71717a', height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontWeight: 700, color: '#000', borderBottom: '1px solid #e4e4e7', paddingBottom: 8, marginBottom: 12 }}>Gateway Integration Log</p>
          {payoutLogs.length === 0 ? (
            <p style={{ textAlign: 'center', margin: 'auto', color: '#a1a1aa' }}>Awaiting gateway triggers...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, whiteSpace: 'pre-wrap' }}>
              {payoutLogs.map((log, idx) => (
                <div key={idx} style={{ fontWeight: log.includes('RESPONSE: SUCCESS') ? 700 : 400 }}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
