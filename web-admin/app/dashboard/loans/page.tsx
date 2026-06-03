'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

type LoanItem = {
  id: number;
  user_id: number;
  product_type: string;
  principal_amount: number;
  status: string;
};

export default function LoansPage() {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadLoans() {
      try {
        const data = await fetchApi('/loans/');
        setLoans(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    }
    loadLoans();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const updated = await fetchApi(`/loans/${id}/approve`, { method: 'POST' });
      setLoans(loans.map(loan => loan.id === id ? updated : loan));
    } catch (err: unknown) {
      alert(`Approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleReject = async (id: number) => {
    try {
      const updated = await fetchApi(`/loans/${id}/reject`, { method: 'POST' });
      setLoans(loans.map(loan => loan.id === id ? updated : loan));
    } catch (err: unknown) {
      alert(`Rejection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const filteredLoans = loans.filter((loan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      String(loan.id).includes(query) ||
      loan.product_type.toLowerCase().includes(query) ||
      loan.status.toLowerCase().includes(query) ||
      String(loan.user_id).includes(query)
    );
  });

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading loans...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card rounded-3xl p-8">
        <div className="flex items-center gap-3 text-red-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card rounded-[28px] p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Loans</p>
          <h2 className="text-xl font-bold tracking-tight text-white">Loan applications</h2>
        </div>
        <Link
          href="/dashboard/loans/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Application
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-5 relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search by ID, type, status, or borrower..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="premium-input w-full rounded-xl py-2.5 pl-11 pr-4 text-sm outline-none placeholder-slate-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-3.5 font-medium">ID</th>
              <th className="px-4 py-3.5 font-medium">Borrower</th>
              <th className="px-4 py-3.5 font-medium">Type</th>
              <th className="px-4 py-3.5 font-medium">Amount</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredLoans.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <span>{searchQuery ? 'No loans match your search.' : 'No active loans found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLoans.map((loan) => {
                const value = String(loan.status || '').toUpperCase();
                const statusClass =
                  value === 'APPROVED' || value === 'DISBURSED' || value === 'ACTIVE' || value === 'CLEARED'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.1)]'
                    : value === 'PENDING' || value === 'PARTIALLY_DISBURSED'
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      : value === 'REJECTED' || value === 'DEFAULTED'
                        ? 'bg-rose-500/10 text-red-600 border-rose-500/20 shadow-[0_0_6px_rgba(244,63,94,0.1)]'
                        : 'bg-slate-500/10 text-slate-500 border-slate-500/20';

                return (
                  <tr key={loan.id} className="hover:bg-white/[0.03] transition-colors duration-150 group">
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">#{loan.id}</td>
                    <td className="px-4 py-3.5 text-white font-medium">Borrower #{loan.user_id}</td>
                    <td className="px-4 py-3.5 text-slate-500 capitalize">{loan.product_type}</td>
                    <td className="px-4 py-3.5 font-semibold text-white">KES {loan.principal_amount?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClass}`}>
                        {value}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 space-x-2">
                      {value === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleApprove(loan.id)}
                            className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)] transition-all duration-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(loan.id)}
                            className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-rose-500/20 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] transition-all duration-200"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          Showing <span className="text-slate-300 font-medium">{filteredLoans.length}</span> of <span className="text-slate-300 font-medium">{loans.length}</span> loans
        </p>
      </div>
    </div>
  );
}
