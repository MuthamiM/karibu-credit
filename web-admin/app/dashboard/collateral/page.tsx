'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

type CollateralItem = {
  id: string; // COL-X
  loan_id: number;
  borrower: string;
  type: string;
  value: number;
  status: 'VERIFIED' | 'PENDING' | 'LIQUIDATED';
  details: string;
};

type LoanOption = {
  id: number;
  borrower: string;
  principal: number;
};

type UserInfo = {
  id: number;
  full_name: string;
};

type LoanItem = {
  id: number;
  user_id: number;
  principal_amount: number;
};

export default function CollateralPage() {
  const [collateralList, setCollateralList] = useState<CollateralItem[]>([]);
  const [loans, setLoans] = useState<LoanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [newCollateral, setNewCollateral] = useState({
    loanId: '',
    type: 'Car Logbook',
    value: '',
    details: '',
  });

  async function loadData() {
    try {
      const [collateralData, loansData, usersData] = await Promise.all([
        fetchApi('/loans/collateral'),
        fetchApi('/loans/'),
        fetchApi('/users/?role=borrower')
      ]);

      setCollateralList(collateralData);

      const userMap = new Map<number, string>();
      usersData.forEach((u: UserInfo) => {
        userMap.set(u.id, u.full_name);
      });

      const options = loansData.map((l: LoanItem) => ({
        id: l.id,
        borrower: userMap.get(l.user_id) || `Borrower #${l.user_id}`,
        principal: l.principal_amount
      }));
      setLoans(options);
      
      if (options.length > 0) {
        setNewCollateral((prev) => ({ ...prev, loanId: String(options[0].id) }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load collateral information');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const addCollateral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollateral.loanId || !newCollateral.value) return;

    setSubmitting(true);
    try {
      await fetchApi(`/loans/${newCollateral.loanId}/collateral`, {
        method: 'POST',
        body: JSON.stringify({
          type: newCollateral.type,
          value: parseFloat(newCollateral.value),
          details: newCollateral.details,
          status: 'PENDING'
        })
      });
      setNewCollateral((prev) => ({
        ...prev,
        value: '',
        details: '',
      }));
      await loadData();
    } catch (err: unknown) {
      alert(`Filing collateral failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    const shimmerRows = Array.from({ length: 8 });
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
        <div className="karibu-skel" style={{ height: 20, width: 220, marginBottom: 24, border: '1px solid #000' }} />
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
      <div className="min-h-[300px] flex items-center justify-center bg-white border border-black p-8 text-black gap-3 font-mono text-xs uppercase tracking-wider">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        Loading collateral ledger...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-black bg-white p-8">
        <div className="flex items-center gap-3 text-black font-mono text-xs uppercase tracking-wider">
          <span></span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={THEME.classes.panel}>
      <div className="border-b border-black pb-4 mb-6">
        <p className={THEME.classes.subtitle}>Asset Backed Lending</p>
        <h2 className={THEME.classes.title + " mt-1"}>Collateral Ledger &amp; Valuation Tracker</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Record and manage physical collateral assets attached to SME and logbook loans, including verified appraisals.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12 items-start">
        {/* Table List */}
        <div className="md:col-span-8 overflow-x-auto border border-black bg-white">
          <table className="min-w-full text-left text-xs font-mono">
            <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
              <tr>
                <th className="px-4 py-3.5 font-bold">Asset ID</th>
                <th className="px-4 py-3.5 font-bold">Borrower</th>
                <th className="px-4 py-3.5 font-bold">Type</th>
                <th className="px-4 py-3.5 font-bold">Valuation</th>
                <th className="px-4 py-3.5 font-bold">Asset Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {collateralList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400 uppercase tracking-widest">
                    No collateral assets filed in the ledger.
                  </td>
                </tr>
              ) : (
                collateralList.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3.5 text-zinc-500 font-bold">{item.id}</td>
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="font-bold text-black uppercase">{item.borrower}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.details || 'No description'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 uppercase">{item.type}</td>
                    <td className="px-4 py-3.5 font-bold text-black">KES {item.value.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={item.status === 'VERIFIED' ? THEME.classes.badgeFilled : THEME.classes.badgeOutline}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Form */}
        <form onSubmit={addCollateral} className={`${THEME.classes.card} md:col-span-4 space-y-4`}>
          <h3 className={THEME.classes.sectionTitle}>Add Collateral Asset</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Select Active Loan</label>
            <select
              value={newCollateral.loanId}
              onChange={(e) => setNewCollateral({ ...newCollateral, loanId: e.target.value })}
              className={THEME.classes.input}
              required
            >
              {loans.length === 0 ? (
                <option value="">No active loans found</option>
              ) : (
                loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    Loan #{l.id} - {l.borrower} (KES {l.principal.toLocaleString()})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Asset Category</label>
            <select
              value={newCollateral.type}
              onChange={(e) => setNewCollateral({ ...newCollateral, type: e.target.value })}
              className={THEME.classes.input}
            >
              <option value="Car Logbook">Car Logbook</option>
              <option value="Land Title Deed">Land Title Deed</option>
              <option value="Household Goods">Household Goods</option>
              <option value="Business Inventory">Business Inventory</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Valued Amount (KES)</label>
            <input
              type="number"
              value={newCollateral.value}
              onChange={(e) => setNewCollateral({ ...newCollateral, value: e.target.value })}
              className={THEME.classes.input}
              placeholder="e.g. 500000"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Description &amp; Reference No.</label>
            <input
              type="text"
              value={newCollateral.details}
              onChange={(e) => setNewCollateral({ ...newCollateral, details: e.target.value })}
              className={THEME.classes.input}
              placeholder="e.g. KCA 123Y Logbook Serial"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !newCollateral.loanId}
            className={THEME.classes.btnPrimary + " w-full"}
          >
            {submitting ? 'Filing...' : 'File Collateral Asset'}
          </button>
        </form>
      </div>
    </div>
  );
}
