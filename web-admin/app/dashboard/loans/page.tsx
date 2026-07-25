'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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
      <div className="min-h-[300px] flex items-center justify-center bg-white border border-black p-8 text-black gap-3 font-mono text-xs uppercase tracking-wider">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        Loading loans...
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
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black pb-4">
        <div>
          <p className={THEME.classes.subtitle}>Loans</p>
          <h2 className={THEME.classes.title}>Loan applications</h2>
        </div>
        <Link href="/dashboard/loans/new" className={THEME.classes.btnPrimary}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Application
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-5 relative">
        <svg className="absolute left-4 top-3.5 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="SEARCH BY ID, TYPE, STATUS, OR BORROWER..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={THEME.classes.input + " pl-11"}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-black bg-white">
        <table className="min-w-full text-left text-xs font-mono">
          <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
            <tr>
              <th className="px-4 py-3.5 font-bold">ID</th>
              <th className="px-4 py-3.5 font-bold">Borrower</th>
              <th className="px-4 py-3.5 font-bold">Type</th>
              <th className="px-4 py-3.5 font-bold">Amount</th>
              <th className="px-4 py-3.5 font-bold">Status</th>
              <th className="px-4 py-3.5 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {filteredLoans.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-400 uppercase tracking-widest">
                  {searchQuery ? 'No loans match your search.' : 'No active loans found.'}
                </td>
              </tr>
            ) : (
              filteredLoans.map((loan) => {
                const value = String(loan.status || '').toUpperCase();
                const isDisbursed = value === 'APPROVED' || value === 'DISBURSED' || value === 'ACTIVE' || value === 'CLEARED';
                const isPending = value === 'PENDING' || value === 'PARTIALLY_DISBURSED';
                
                let badgeClass = THEME.classes.badgeMuted;
                if (isDisbursed) {
                  badgeClass = THEME.classes.badgeFilled;
                } else if (isPending) {
                  badgeClass = THEME.classes.badgeOutline;
                }

                return (
                  <tr key={loan.id} className="hover:bg-zinc-50 transition-colors duration-150">
                    <td className="px-4 py-3.5 text-zinc-500 font-bold">#{loan.id}</td>
                    <td className="px-4 py-3.5 text-black font-semibold">Borrower #{loan.user_id}</td>
                    <td className="px-4 py-3.5 text-zinc-500 uppercase">{loan.product_type}</td>
                    <td className="px-4 py-3.5 font-bold text-black">KES {loan.principal_amount?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3.5">
                      <span className={badgeClass}>
                        {value}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 space-x-2">
                      {value === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleApprove(loan.id)}
                            className="border border-black bg-black text-white hover:bg-zinc-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(loan.id)}
                            className="border border-black bg-white text-black hover:bg-zinc-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-zinc-400">—</span>
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
      <div className="mt-4 flex items-center justify-between px-1 font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
        <p>
          Showing <span className="text-black font-bold">{filteredLoans.length}</span> of <span className="text-black font-bold">{loans.length}</span> loans
        </p>
      </div>
    </div>
  );
}
