'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

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
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading collateral ledger...
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
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Asset Backed Lending</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Collateral Ledger &amp; Valuation Tracker</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Record and manage physical collateral assets attached to SME and logbook loans, including verified appraisals.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] self-start">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
              <tr>
                <th className="px-4 py-3.5 font-medium">Asset ID</th>
                <th className="px-4 py-3.5 font-medium">Borrower</th>
                <th className="px-4 py-3.5 font-medium">Type</th>
                <th className="px-4 py-3.5 font-medium">Valuation</th>
                <th className="px-4 py-3.5 font-medium">Asset Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {collateralList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No collateral assets filed in the ledger.
                  </td>
                </tr>
              ) : (
                collateralList.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3.5 text-slate-500 font-mono">{item.id}</td>
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="font-semibold text-white">{item.borrower}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.details || 'No description'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{item.type}</td>
                    <td className="px-4 py-3.5 font-bold text-white">KES {item.value.toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        item.status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={addCollateral} className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 self-start">
          <h3 className="text-sm font-semibold text-white">Add Collateral Asset</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Active Loan</label>
            <select
              value={newCollateral.loanId}
              onChange={(e) => setNewCollateral({ ...newCollateral, loanId: e.target.value })}
              className="premium-select w-full rounded-xl px-3 py-2 text-xs outline-none"
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
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Asset Category</label>
            <select
              value={newCollateral.type}
              onChange={(e) => setNewCollateral({ ...newCollateral, type: e.target.value })}
              className="premium-select w-full rounded-xl px-3 py-2 text-xs outline-none"
            >
              <option value="Car Logbook">Car Logbook</option>
              <option value="Land Title Deed">Land Title Deed</option>
              <option value="Household Goods">Household Goods</option>
              <option value="Business Inventory">Business Inventory</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Valued Amount (KES)</label>
            <input
              type="number"
              value={newCollateral.value}
              onChange={(e) => setNewCollateral({ ...newCollateral, value: e.target.value })}
              className="premium-input w-full rounded-xl px-3 py-2 text-xs outline-none"
              placeholder="e.g. 500000"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Description &amp; Reference No.</label>
            <input
              type="text"
              value={newCollateral.details}
              onChange={(e) => setNewCollateral({ ...newCollateral, details: e.target.value })}
              className="premium-input w-full rounded-xl px-3 py-2 text-xs outline-none"
              placeholder="e.g. KCA 123Y Logbook Serial"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !newCollateral.loanId}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 py-2.5 text-xs font-bold text-white shadow-md transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? 'Filing...' : 'File Collateral Asset'}
          </button>
        </form>
      </div>
    </div>
  );
}
