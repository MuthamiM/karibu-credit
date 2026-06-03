'use client';

import { useState } from 'react';
import { fetchApi } from '../../../lib/api';

type CRBResult = {
  national_id: string;
  score: number;
  grading: string;
  listings: number;
  amount_listed: string;
  report_id: string;
  timestamp: string;
};

export default function CRBCheckPage() {
  const [crbId, setCrbId] = useState('');
  const [crbResult, setCrbResult] = useState<CRBResult | null>(null);
  const [crbLoading, setCrbLoading] = useState(false);
  const [error, setError] = useState('');

  const queryCrb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crbId) return;
    setCrbLoading(true);
    setError('');
    setCrbResult(null);

    try {
      const data = await fetchApi('/loans/crb-check', {
        method: 'POST',
        body: JSON.stringify({ national_id: crbId })
      });
      setCrbResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to perform CRB query');
    } finally {
      setCrbLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 550) return 'text-red-600';
    if (score < 700) return 'text-amber-400';
    return 'text-emerald-600';
  };

  return (
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Credit Reference Bureau</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Metropol / TransUnion API Query</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Query borrower risk profiles and pull Credit Scoring indicators directly using national registration identity codes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={queryCrb} className="space-y-5 rounded-2xl border border-white/5 bg-white/[0.02] p-5 self-start">
          <h3 className="text-sm font-semibold text-white">Search CRB Database</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">National ID / Passport Number</label>
            <input
              type="text"
              value={crbId}
              onChange={(e) => setCrbId(e.target.value)}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
              placeholder="e.g. 32904589"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-xs mt-1">
              Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={crbLoading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 py-3 text-xs font-bold text-white shadow-md transition-all duration-200 disabled:opacity-50"
          >
            {crbLoading ? 'Querying Metropol API...' : 'Fetch Risk Profile Score'}
          </button>
        </form>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-4">CRB Response Profile</h3>
          {!crbResult ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-xs">Enter a National ID and query above to display score.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-slate-500">Report Status</span>
                <span className="font-semibold text-emerald-600">VERIFIED REPORT</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Credit Score</span>
                <span className={`text-xl font-extrabold ${getScoreColor(crbResult.score)}`}>{crbResult.score} / 900</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Risk Assessment</span>
                <span className={`font-semibold ${getScoreColor(crbResult.score)}`}>{crbResult.grading}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Negative Listings</span>
                <span className={`font-mono font-semibold ${crbResult.listings > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                  {crbResult.listings} active default listings
                </span>
              </div>

              {crbResult.listings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Listed Default Amount</span>
                  <span className="font-mono font-semibold text-red-600">{crbResult.amount_listed}</span>
                </div>
              )}

              <div className="border-t border-white/5 pt-3 mt-3 text-[10px] text-slate-500 space-y-1">
                <div>Report ID: {crbResult.report_id}</div>
                <div>Query Timestamp: {new Date(crbResult.timestamp).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
