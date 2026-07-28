'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { THEME } from '@/theme';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp' | 'forgot_request' | 'forgot_otp' | 'forgot_new_password'>('credentials');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const router = useRouter();

  const formatAuthError = (message: string) => {
    const cleaned = message
      .replace(/^ERROR:\s*/i, '')
      .replace(/_/g, ' ')
      .trim();

    if (!cleaned) {
      return 'Sign in failed. Please try again.';
    }

    if (/invalid credentials/i.test(cleaned)) {
      return 'The email/phone or security key is incorrect.';
    }

    if (/rate limit/i.test(cleaned)) {
      return cleaned.replace(/retry/i, 'try again');
    }

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429 && data.detail?.retry_after_seconds) {
          setOtpCooldown(data.detail.retry_after_seconds);
          throw new Error(`Rate limit exceeded. Please retry in ${data.detail.retry_after_seconds} seconds.`);
        }
        throw new Error(typeof data.detail === 'string' ? data.detail : data.detail?.error || 'Invalid credentials');
      }

      if (data.otp_required && data.pending_token) {
        setPendingToken(data.pending_token);
        setPhoneHint(data.phone_hint || '');
        setStep('otp');
        setOtpCooldown(30);
      } else if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pending_token: pendingToken,
            code: otpCode.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429 && data.detail?.retry_after_seconds) {
          throw new Error(`Rate limit exceeded. Please wait ${data.detail.retry_after_seconds} seconds.`);
        }
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Invalid or expired OTP code');
      }

      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/forgot-password-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to request reset OTP');
      }

      if (data.otp_required && data.pending_token) {
        setPendingToken(data.pending_token);
        setPhoneHint(data.phone_hint || '');
        setOtpCode('');
        setStep('forgot_otp');
        setOtpCooldown(30);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgotPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pending_token: pendingToken,
            code: otpCode.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'OTP verification failed');
      }

      if (data.otp_confirmed && data.reset_token) {
        setResetToken(data.reset_token);
        setStep('forgot_new_password');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/complete-password-change`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reset_token: resetToken,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Password change failed');
      }

      alert('Password updated successfully! Please log in.');
      setStep('credentials');
      setPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password change failed');
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
            <span>[ ENCRYPTED 2FA ]</span>
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
              {step === 'credentials' && 'Console Authenticator'}
              {step === 'otp' && '2FA OTP Verification'}
              {step === 'forgot_request' && 'Reset Security Key'}
              {step === 'forgot_otp' && 'Verify Identity (OTP)'}
              {step === 'forgot_new_password' && 'Enter New Security Key'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: THEME.colors.textMuted, fontWeight: 500 }}>
              {step === 'credentials' && 'ENTER SYSTEM PRIVILEGES TO RE-ROUTE PORTFOLIO'}
              {step === 'otp' && `ENTER 6-DIGIT CODE SENT TO ${phoneHint}`}
              {step === 'forgot_request' && 'ENTER REGISTERED EMAIL/PHONE TO RECEIVE OTP'}
              {step === 'forgot_otp' && `ENTER 6-DIGIT SECURITY CODE SENT TO ${phoneHint}`}
              {step === 'forgot_new_password' && 'SET A STRONGER SECURITY ACCESS KEY'}
            </p>
          </div>

          {/* Error message in monochrome */}
          {error && (
            <div style={{
              marginBottom: '1.5rem', padding: '0.75rem 1rem',
              background: '#f8f8f8', border: `1px solid ${THEME.colors.black}`,
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Sign in failed:</span>
              <span style={{ color: THEME.colors.black }}>{' '}{formatAuthError(error)}</span>
            </div>
          )}

          {/* Credentials Step */}
          {step === 'credentials' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                  color: THEME.colors.black, marginBottom: '0.5rem',
                }}>
                  PHONE NUMBER OR EMAIL
                </label>
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="+2547XXXXXXXX or name@karibucredit.co.ke"
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

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: THEME.colors.black,
                  }}>
                    SECURITY KEY
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep('forgot_request'); setError(''); }}
                    style={{
                      background: 'none', border: 'none', fontSize: '0.625rem',
                      color: THEME.colors.textMuted, fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    [ FORGOT KEY ]
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    minLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Min. 6 characters"
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

              <button
                id="login-submit"
                type="submit"
                disabled={loading || otpCooldown > 0}
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
                  <span>[ SENDING OTP VIA GATEWAY... ]</span>
                ) : otpCooldown > 0 ? (
                  <span>RESEND AVAILABLE IN {otpCooldown}s</span>
                ) : (
                  <span>REQUEST OTP →</span>
                )}
              </button>
            </form>
          )}

          {/* Login OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                  color: THEME.colors.black, marginBottom: '0.5rem',
                }}>
                  OTP CODE
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  minLength={6}
                  value={otpCode}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 6) setOtpCode(v); }}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                    fontSize: '1rem', color: THEME.colors.black, letterSpacing: '0.2em',
                    textAlign: 'center', outline: 'none', transition: 'all 0.1s ease',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={e => { e.target.style.boxShadow = `0 0 0 2px ${THEME.colors.black}`; }}
                  onBlur={e => { e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <button
                id="otp-submit"
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
                  <span>[ VERIFYING... ]</span>
                ) : (
                  <span>VERIFY & LOG IN →</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                style={{
                  background: 'none', border: 'none', fontSize: '0.6875rem',
                  color: THEME.colors.textMuted, fontWeight: 600, cursor: 'pointer',
                  textAlign: 'center', marginTop: '0.5rem',
                }}
              >
                ← Back to Login Credentials
              </button>
            </form>
          )}

          {/* Forgot Password: Request OTP Step */}
          {step === 'forgot_request' && (
            <form onSubmit={handleForgotPasswordRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                  color: THEME.colors.black, marginBottom: '0.5rem',
                }}>
                  PHONE NUMBER OR EMAIL
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="+2547XXXXXXXX or name@karibucredit.co.ke"
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                    fontSize: '0.8125rem', color: THEME.colors.black,
                    outline: 'none', borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCooldown > 0}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: THEME.colors.black,
                  color: THEME.colors.white, border: `1px solid ${THEME.colors.black}`,
                  fontSize: '0.75rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                  borderRadius: '4px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {loading ? '[ SENDING RESET OTP... ]' : otpCooldown > 0 ? `RESEND AVAILABLE IN ${otpCooldown}s` : 'SEND RESET OTP →'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                style={{
                  background: 'none', border: 'none', fontSize: '0.6875rem',
                  color: THEME.colors.textMuted, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* Forgot Password: Verify OTP Step */}
          {step === 'forgot_otp' && (
            <form onSubmit={handleVerifyForgotPasswordOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                  color: THEME.colors.black, marginBottom: '0.5rem',
                }}>
                  RESET CODE
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  minLength={6}
                  value={otpCode}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 6) setOtpCode(v); }}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                    fontSize: '1rem', color: THEME.colors.black, letterSpacing: '0.2em',
                    textAlign: 'center', outline: 'none', borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: THEME.colors.black,
                  color: THEME.colors.white, border: `1px solid ${THEME.colors.black}`,
                  fontSize: '0.75rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                  borderRadius: '4px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {loading ? '[ VERIFYING... ]' : 'VERIFY RESET CODE →'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('forgot_request'); setError(''); }}
                style={{
                  background: 'none', border: 'none', fontSize: '0.6875rem',
                  color: THEME.colors.textMuted, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ← Back to Request Reset
              </button>
            </form>
          )}

          {/* Forgot Password: Enter New Password Step */}
          {step === 'forgot_new_password' && (
            <form onSubmit={handleCompletePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
                  color: THEME.colors.black, marginBottom: '0.5rem',
                }}>
                  NEW SECURITY KEY
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: THEME.colors.surface, border: `1px solid ${THEME.colors.black}`,
                    fontSize: '0.8125rem', color: THEME.colors.black,
                    outline: 'none', borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: THEME.colors.black,
                  color: THEME.colors.white, border: `1px solid ${THEME.colors.black}`,
                  fontSize: '0.75rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer',
                  borderRadius: '4px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {loading ? '[ UPDATING ACCESS KEY... ]' : 'UPDATE ACCESS KEY →'}
              </button>
            </form>
          )}

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
