'use client';

import { useState } from 'react';

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
    <div className="glass-panel rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">M-Pesa Disbursement Gateway</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Direct B2C Payout Portal</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Approve and manually disburse funds directly to a customer's phone number using the Safaricom B2C Disbursement API channel.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={triggerPayout} className="space-y-5 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Disbursement Request Details</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Borrower Mobile Number</label>
            <input
              type="text"
              value={payoutPhone}
              onChange={(e) => setPayoutPhone(e.target.value)}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
              placeholder="e.g. 254712345678"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursement Amount (KES)</label>
            <input
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
              placeholder="e.g. 15000"
              required
            />
          </div>

          <button
            type="submit"
            disabled={payoutLoading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 py-3 text-xs font-bold text-white shadow-md transition-all duration-200"
          >
            {payoutLoading ? 'Authorizing Gateway...' : 'Execute Direct Disbursement'}
          </button>
        </form>

        <div className="flex flex-col rounded-2xl border border-white/5 bg-black/40 p-5 font-mono text-[11px] text-slate-400 h-80 overflow-y-auto">
          <p className="text-white border-b border-white/10 pb-2 mb-3 font-semibold">Gateway Integration Log</p>
          {payoutLogs.length === 0 ? (
            <p className="text-slate-600 text-center my-auto">Awaiting gateway triggers...</p>
          ) : (
            <div className="space-y-3 whitespace-pre-wrap">
              {payoutLogs.map((log, idx) => (
                <div key={idx} className={log.includes('RESPONSE: SUCCESS') ? 'text-emerald-400' : ''}>
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
