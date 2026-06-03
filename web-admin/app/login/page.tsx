'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      if (!response.ok) {
        const errDetail = await response.json().catch(() => ({}));
        throw new Error(errDetail.detail || 'Invalid credentials');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#05070e] px-4 py-12 overflow-hidden">
      {/* Dynamic Background Mesh & Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[120px] animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-desert-500/10 blur-[120px] animate-float-delayed"></div>
      <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-amber-500/5 blur-[100px] animate-pulse-glow"></div>
      
      {/* Radial overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#05070e_90%)]"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Glassmorphic Login Card */}
        <div className="card rounded-[32px] p-8 md:p-10">
          
          {/* Logo / Brand Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-desert-500 shadow-[0_0_30px_rgba(15,180,195,0.3)] mb-4">
              <span className="text-3xl font-black text-white">K</span>
              <div className="absolute inset-0 rounded-2xl border border-white/20"></div>
            </div>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight">
              Karibu Credit
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-desert-500 font-semibold">
              Admin Portal
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="premium-input w-full rounded-2xl px-4 py-3 text-sm outline-none placeholder-slate-500"
                  placeholder="name@karibucredit.co.ke"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="premium-input w-full rounded-2xl px-4 py-3 text-sm outline-none placeholder-••••••••"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="relative w-full overflow-hidden group rounded-2xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:shadow-[0_0_25px_rgba(15,180,195,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Authenticating...
                  </span>
                ) : (
                  "Sign In to Console"
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500 tracking-wide">
          © {new Date().getFullYear()} Karibu Credit Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}

