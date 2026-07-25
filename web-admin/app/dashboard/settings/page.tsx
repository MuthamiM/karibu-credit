'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { THEME } from '@/theme';

export default function AccountSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Phone Update State
  const [phone, setPhone] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await fetchApi('/users/me');
        setUser(data);
        setPhone(data.phone_number || '');
      } catch (err: any) {
        console.error('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const handlePhoneUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneMsg(null);
    setPhoneLoading(true);

    try {
      const updated = await fetchApi('/users/me/phone', {
        method: 'PUT',
        body: JSON.stringify({ phone_number: phone }),
      });
      setUser(updated);
      setPhoneMsg({ type: 'success', text: `OTP phone number successfully updated to ${updated.phone_number}!` });
    } catch (err: any) {
      setPhoneMsg({ type: 'error', text: err.message || 'Failed to update phone number' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setPasswordLoading(true);
    try {
      await fetchApi('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setPasswordMsg({ type: 'success', text: 'Security password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Current password verification failed' });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', fontSize: '12px' }}>
        LOADING ACCOUNT SECURITY SETTINGS...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase',
          letterSpacing: '-0.02em', color: THEME.colors.textPrimary, fontFamily: 'monospace',
          marginBottom: '0.25rem',
        }}>
          Account Security & OTP Tool
        </h1>
        <p style={{ fontSize: '0.75rem', color: THEME.colors.textMuted, fontFamily: 'monospace' }}>
          MANAGE YOUR ROLE CREDENTIALS, OTP SMS PHONE TARGET, AND ACCESS PRIVILEGES
        </p>
      </div>

      {/* User Info Overview */}
      <div style={{
        background: '#ffffff', border: '1px solid #000', padding: '1.25rem',
        marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem', fontFamily: 'monospace',
      }}>
        <div>
          <span style={{ fontSize: '9px', color: THEME.colors.textMuted, fontWeight: 700, display: 'block' }}>USER IDENTIFIER</span>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#000' }}>{user?.email}</span>
        </div>
        <div>
          <span style={{ fontSize: '9px', color: THEME.colors.textMuted, fontWeight: 700, display: 'block' }}>FULL NAME</span>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#000' }}>{user?.full_name}</span>
        </div>
        <div>
          <span style={{ fontSize: '9px', color: THEME.colors.textMuted, fontWeight: 700, display: 'block' }}>SYSTEM ROLE</span>
          <span style={{
            fontSize: '10px', fontWeight: 900, color: '#ffffff', background: '#000',
            padding: '2px 6px', display: 'inline-block', marginTop: '2px'
          }}>
            {user?.role}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '9px', color: THEME.colors.textMuted, fontWeight: 700, display: 'block' }}>OTP TARGET PHONE</span>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#000' }}>{user?.phone_number || 'NONE SET'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Panel 1: OTP Phone Settings */}
        <div style={{ background: '#ffffff', border: '1px solid #000', padding: '1.5rem' }}>
          <h2 style={{
            fontSize: '0.875rem', fontWeight: 900, textTransform: 'uppercase',
            fontFamily: 'monospace', marginBottom: '0.5rem', borderBottom: '1px solid #000',
            paddingBottom: '0.5rem'
          }}>
             2FA OTP Phone Target
          </h2>
          <p style={{ fontSize: '11px', color: THEME.colors.textMuted, marginBottom: '1.25rem', lineHeight: 1.4 }}>
            Update the phone number used to receive 2FA SMS security codes when logging into your role account.
          </p>

          {phoneMsg && (
            <div style={{
              padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '11px', fontWeight: 700,
              border: '1px solid #000',
              background: phoneMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: phoneMsg.type === 'success' ? '#166534' : '#991b1b',
              fontFamily: 'monospace'
            }}>
              {phoneMsg.text}
            </div>
          )}

          <form onSubmit={handlePhoneUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '0.35rem' }}>
                PHONE NUMBER (E.164 or Local)
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07XXXXXXXX or 254114945842"
                required
                style={{
                  width: '100%', padding: '0.625rem', border: '1px solid #000',
                  fontSize: '12px', fontFamily: 'monospace', outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={phoneLoading}
              style={{
                padding: '0.625rem', background: '#000', color: '#fff',
                border: '1px solid #000', fontSize: '10px', fontWeight: 800,
                fontFamily: 'monospace', cursor: phoneLoading ? 'default' : 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {phoneLoading ? 'SAVING...' : 'UPDATE OTP PHONE →'}
            </button>
          </form>
        </div>

        {/* Panel 2: Change Security Password */}
        <div style={{ background: '#ffffff', border: '1px solid #000', padding: '1.5rem' }}>
          <h2 style={{
            fontSize: '0.875rem', fontWeight: 900, textTransform: 'uppercase',
            fontFamily: 'monospace', marginBottom: '0.5rem', borderBottom: '1px solid #000',
            paddingBottom: '0.5rem'
          }}>
             Security Password Tool
          </h2>
          <p style={{ fontSize: '11px', color: THEME.colors.textMuted, marginBottom: '1.25rem', lineHeight: 1.4 }}>
            Change your account password for security. Requires your current password for authorization.
          </p>

          {passwordMsg && (
            <div style={{
              padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '11px', fontWeight: 700,
              border: '1px solid #000',
              background: passwordMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: passwordMsg.type === 'success' ? '#166534' : '#991b1b',
              fontFamily: 'monospace'
            }}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '0.25rem' }}>
                CURRENT PASSWORD
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '0.5rem', border: '1px solid #000',
                  fontSize: '12px', fontFamily: 'monospace', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '0.25rem' }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                required
                style={{
                  width: '100%', padding: '0.5rem', border: '1px solid #000',
                  fontSize: '12px', fontFamily: 'monospace', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '0.25rem' }}>
                CONFIRM NEW PASSWORD
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{
                  width: '100%', padding: '0.5rem', border: '1px solid #000',
                  fontSize: '12px', fontFamily: 'monospace', outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                padding: '0.625rem', background: '#000', color: '#fff',
                border: '1px solid #000', fontSize: '10px', fontWeight: 800,
                fontFamily: 'monospace', cursor: passwordLoading ? 'default' : 'pointer',
                textTransform: 'uppercase', marginTop: '0.25rem'
              }}
            >
              {passwordLoading ? 'CHANGING...' : 'CHANGE PASSWORD →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
