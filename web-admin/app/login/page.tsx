'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { THEME } from '@/theme';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
      background: THEME.colors.bg,
    }}>
      {/* ─── LEFT: Stark Black Brand Panel ─── */}
      <div style={{
        flex: '0 0 45%',
        background: THEME.colors.black,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        position: 'relative',
        borderRight: `1px solid ${THEME.colors.grayDark}`,
      }}>
        {/* Subtle grid pattern overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 360, textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: 56, height: 56,
            background: THEME.colors.white,
            border: `2px solid ${THEME.colors.white}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 2rem',
            borderRadius: '4px',
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: THEME.colors.black, letterSpacing: '-0.02em' }}>K</span>
          </div>

          <h1 style={{
            fontSize: '1.75rem', fontWeight: 800, color: THEME.colors.white,
            letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: '0.75rem',
            textTransform: 'uppercase',
          }}>
            Karibu Credit
          </h1>
          <p style={{
            fontSize: '0.8125rem', color: THEME.colors.textMuted, lineHeight: 1.6,
            marginBottom: '3rem', fontWeight: 400,
          }}>
            ADMINISTRATIVE CONSOLE V2 //
            SECURED LOAN DISBURSEMENT & CREDIT EVALUATION
          </p>

          {/* Stark Stats Column */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            marginBottom: '3rem', textAlign: 'left',
          }}>
            {[
              { value: 'KES 2.4B+', label: 'TOTAL DISBURSED' },
              { value: '15,000+', label: 'ACTIVE BORROWERS' },
              { value: '99.8%', label: 'UPTIME SLA' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '0.75rem 1rem',
                border: `1px solid ${THEME.colors.textMuted}`,
                background: '#09090b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '4px',
              }}>
                <div style={{ fontSize: '0.6875rem', color: THEME.colors.textMuted, fontWeight: 500 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: THEME.colors.white }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Grayscale Badges */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center',
            fontSize: '0.625rem', color: THEME.colors.textMuted, fontWeight: 600,
          }}>
            <span>[ SOC 2 COMPLIANT ]</span>
            <span>[ CBK LICENSED ]</span>
            <span>[ ENCRYPTED ]</span>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Login Form Panel ─── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        background: THEME.colors.surface,
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontSize: '1.375rem', fontWeight: 800, color: THEME.colors.black,
              letterSpacing: '-0.03em', marginBottom: '0.5rem',
              textTransform: 'uppercase',
            }}>
              Console Authenticator
            </h2>
            <p style={{ fontSize: '0.75rem', color: THEME.colors.textMuted, fontWeight: 500 }}>
              ENTER SYSTEM PRIVILEGES TO RE-ROUTE PORTFOLIO
            </p>
          </div>

          {/* Error message in monochrome */}
          {error && (
            <div style={{
              marginBottom: '1.5rem', padding: '0.75rem 1rem',
              background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
            }}>
              <span style={{ fontWeight: 'bold' }}>[!] ERROR:</span>
              <span style={{ color: THEME.colors.black, fontWeight: 'bold' }}>{error.toUpperCase()}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Email Field */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                color: THEME.colors.black, marginBottom: '0.5rem',
              }}>
                EMAIL ADDRESS
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@karibucredit.co.ke"
                required
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                  fontSize: '0.8125rem', color: THEME.colors.black,
                  outline: 'none', transition: 'all 0.1s ease',
                  borderRadius: '4px',
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={e => { e.target.style.boxShadow = `0 0 0 2px ${THEME.colors.black}`; }}
                onBlur={e => { e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{
                  fontSize: '0.6875rem', fontWeight: 700, color: THEME.colors.black,
                }}>
                  SECURITY KEY
                </label>
                <button type="button" style={{
                  background: 'none', border: 'none', fontSize: '0.625rem',
                  color: THEME.colors.textMuted, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}>
                  [ FORGOT KEY ]
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem',
                    background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                    fontSize: '0.8125rem', color: THEME.colors.black,
                    outline: 'none', transition: 'all 0.1s ease',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px ${THEME.colors.black}`; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: THEME.colors.black, cursor: 'pointer',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPassword ? (
                    <span style={{ fontSize: 10, fontWeight: 'bold' }}>HIDE</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 'bold' }}>SHOW</span>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '0.875rem',
                background: THEME.colors.black,
                color: THEME.colors.white, border: `1px solid ${THEME.colors.black}`,
                fontSize: '0.75rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                letterSpacing: '0.05em',
                marginTop: '0.5rem',
                borderRadius: '4px',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={e => { if (!loading) { (e.target as HTMLElement).style.background = THEME.colors.grayDark; } }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = THEME.colors.black; }}
            >
              {loading ? (
                <span>[ AUTHENTICATING... ]</span>
              ) : (
                <span>SIGN IN →</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: '3rem', paddingTop: '1.5rem',
            borderTop: `1px solid ${THEME.colors.border}`,
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.625rem', color: THEME.colors.textMuted, lineHeight: 1.6 }}>
              PROTECTED BY SECURE ENCLAVE MODULE.
              <br />
              © {new Date().getFullYear()} KARIBU CREDIT INC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
