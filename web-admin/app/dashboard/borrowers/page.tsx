'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

type Borrower = {
  id: number;
  full_name: string;
  email: string;
  phone_number?: string | null;
  is_active: boolean;
};

export default function BorrowersPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadBorrowers() {
      try {
        const data = await fetchApi('/users/?role=borrower');
        setBorrowers(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load borrowers');
      } finally {
        setLoading(false);
      }
    }
    loadBorrowers();
  }, []);

  const filteredBorrowers = borrowers.filter((b) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      b.full_name.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query) ||
      (b.phone_number && b.phone_number.includes(query)) ||
      String(b.id).includes(query)
    );
  });

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading borrowers...
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
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Borrowers</p>
          <h2 className="text-xl font-bold tracking-tight text-white">Customer portfolio</h2>
        </div>
        <Link
          href="/dashboard/borrowers/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          Onboard Borrower
        </Link>
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, email, phone, or ID..."
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
              <th className="px-4 py-3.5 font-medium">Customer</th>
              <th className="px-4 py-3.5 font-medium">Email</th>
              <th className="px-4 py-3.5 font-medium">Phone</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredBorrowers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    <span>{searchQuery ? 'No borrowers match your search.' : 'No borrowers found.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredBorrowers.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03] transition-colors duration-150 group">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-amber-400">
                        {user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white">{user.full_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">ID #{user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{user.phone_number || '—'}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      user.is_active
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.1)]'
                        : 'bg-rose-500/10 text-red-600 border-rose-500/20 shadow-[0_0_6px_rgba(244,63,94,0.1)]'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          Showing <span className="text-slate-300 font-medium">{filteredBorrowers.length}</span> of <span className="text-slate-300 font-medium">{borrowers.length}</span> customers
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            {borrowers.filter(b => b.is_active).length} active
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400"></span>
            {borrowers.filter(b => !b.is_active).length} inactive
          </span>
        </div>
      </div>
    </div>
  );
}
