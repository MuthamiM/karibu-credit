'use client';

import { useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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

  return (
    <div className={THEME.classes.panel}>
      <div className="border-b border-black pb-4 mb-6">
        <p className={THEME.classes.subtitle}>Credit Reference Bureau</p>
        <h2 className={THEME.classes.title + " mt-1"}>Metropol / TransUnion API Query</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Query borrower risk profiles and pull Credit Scoring indicators directly using national registration identity codes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={queryCrb} className={`${THEME.classes.card} space-y-5 self-start`}>
          <h3 className={THEME.classes.sectionTitle}>Search CRB Database</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">National ID / Passport Number</label>
            <input
              type="text"
              value={crbId}
              onChange={(e) => setCrbId(e.target.value)}
              className={THEME.classes.input}
              placeholder="e.g. 32904589"
              required
            />
          </div>

          {error && (
            <div className="text-black font-mono text-xs mt-1 uppercase tracking-wider">
              ⚠️ Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={crbLoading}
            className={THEME.classes.btnPrimary + " w-full"}
          >
            {crbLoading ? 'Querying Metropol API...' : 'Fetch Risk Profile Score'}
          </button>
        </form>

        <div className={THEME.classes.card}>
          <h3 className={THEME.classes.sectionTitle + " mb-4 pb-2 border-b border-black"}>CRB Response Profile</h3>
          {!crbResult ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 font-mono text-xs uppercase tracking-widest">
              <span className="text-3xl mb-2">🔍</span>
              <p>Enter a National ID and query above to display score.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs font-mono uppercase tracking-wider">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Report Status</span>
                <span className={THEME.classes.badgeFilled}>VERIFIED REPORT</span>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Credit Score</span>
                <span className="text-xl font-black text-black">{crbResult.score} / 900</span>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Risk Assessment</span>
                <span className="font-bold text-black">{crbResult.grading}</span>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Negative Listings</span>
                <span className={`font-bold ${crbResult.listings > 0 ? 'text-black underline' : 'text-zinc-600'}`}>
                  {crbResult.listings} active default listings
                </span>
              </div>

              {crbResult.listings > 0 && (
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Listed Default Amount</span>
                  <span className="font-bold text-black">{crbResult.amount_listed}</span>
                </div>
              )}

              <div className="pt-3 mt-3 text-[10px] text-zinc-400 space-y-1">
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
