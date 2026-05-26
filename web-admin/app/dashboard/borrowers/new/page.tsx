'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function OnboardBorrowerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'borrower'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await fetchApi('/users/customer', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      router.push('/dashboard/borrowers');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to onboard borrower');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="glass-panel rounded-[28px] p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/10 to-amber-600/10 border border-amber-500/15">
            <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Borrowers</p>
            <h2 className="text-xl font-bold tracking-tight text-white">Onboard customer</h2>
          </div>
        </div>
        
        {error && (
          <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
            <span className="text-rose-400">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none placeholder-slate-500"
              required
              placeholder="John Doe"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none placeholder-slate-500"
                required
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Phone Number</label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none placeholder-slate-500"
                placeholder="+254700000000"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Temporary Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none placeholder-slate-500"
              required
              placeholder="••••••••"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              Borrower will use this to sign into the mobile app.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Onboarding...
                </span>
              ) : (
                'Register Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
