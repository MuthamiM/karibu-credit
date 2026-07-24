'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

interface SMSLog {
  id: string;
  recipient: string;
  phone: string;
  time: string;
  status: 'QUEUED' | 'DELIVERED' | 'FAILED';
  content: string;
}

export default function SMSCenterPage() {
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Template settings
  const [smsTemplate, setSmsTemplate] = useState('DISBURSED');
  const [customSmsText, setCustomSmsText] = useState(
    'Dear {name}, your loan application has been approved and KES {amount} has been disbursed to your M-Pesa account. Thank you.'
  );

  // Dispatcher sandbox states
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');
  const [sandboxAmount, setSandboxAmount] = useState('45,000');
  const [sandboxBalance, setSandboxBalance] = useState('15,000');
  const [sandboxDays, setSandboxDays] = useState('5');
  const [isSending, setIsSending] = useState(false);

  // Live Phone Simulation states
  const [showPhone, setShowPhone] = useState(false);
  const [simulatedPhoneContent, setSimulatedPhoneContent] = useState('');
  const [simulatedPhoneSender, setSimulatedPhoneSender] = useState('');

  // Initial SMS outbox logs
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([
    { id: '1', recipient: 'Alice Wambui', phone: '+254712345678', time: '21:02:11', status: 'DELIVERED', content: 'Dear Alice, your loan of KES 50000 is approved...' },
    { id: '2', recipient: 'Karanja Ventures', phone: '+254722334455', time: '20:55:04', status: 'DELIVERED', content: 'Dear Karanja, your repayment of KES 12000 was received.' },
    { id: '3', recipient: 'David Kiprop', phone: '+254700112233', time: '20:00:22', status: 'QUEUED', content: 'Dear David, your payment of KES 25000 is due in 3 days.' },
  ]);

  // Load borrowers from API
  useEffect(() => {
    async function loadBorrowers() {
      try {
        const data = await fetchApi('/users/?role=borrower');
        setBorrowers(data);
        if (data.length > 0) {
          setSelectedBorrowerId(String(data[0].id));
          if (data[0].phone_number) {
            setCustomPhoneNumber(data[0].phone_number);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load borrowers');
      } finally {
        setLoading(false);
      }
    }
    loadBorrowers();
  }, []);

  // Find currently selected borrower details
  const selectedBorrower = useMemo(() => {
    return borrowers.find((b) => String(b.id) === selectedBorrowerId) || null;
  }, [borrowers, selectedBorrowerId]);

  // Update custom phone when selected borrower changes
  useEffect(() => {
    if (selectedBorrower?.phone_number) {
      setCustomPhoneNumber(selectedBorrower.phone_number);
    }
  }, [selectedBorrower]);

  // Dynamic variable placeholder resolver
  const resolvedSMSText = useMemo(() => {
    const name = selectedBorrower ? selectedBorrower.full_name : 'Valued Customer';
    return customSmsText
      .replace(/{name}/g, name)
      .replace(/{amount}/g, sandboxAmount)
      .replace(/{balance}/g, sandboxBalance)
      .replace(/{days}/g, sandboxDays);
  }, [customSmsText, selectedBorrower, sandboxAmount, sandboxBalance, sandboxDays]);

  // Handle Send Real SMS via Gateway
  const handleSendRealSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPhone = customPhoneNumber.trim();
    if (!targetPhone) {
      alert('Please enter a target phone number.');
      return;
    }

    setIsSending(true);

    try {
      const res = await fetchApi('/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          phone: targetPhone,
          message: resolvedSMSText,
        }),
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-KE', { hour12: false });
      const recipientLabel = selectedBorrower ? selectedBorrower.full_name : `Recipient (${targetPhone})`;

      const newLog: SMSLog = {
        id: String(Date.now()),
        recipient: recipientLabel,
        phone: targetPhone,
        time: timeStr,
        status: res.status === 'success' ? 'DELIVERED' : 'QUEUED',
        content: resolvedSMSText,
      };

      setSmsLogs((prev) => [newLog, ...prev]);
      
      // Trigger live phone notification popup
      setSimulatedPhoneSender(recipientLabel);
      setSimulatedPhoneContent(resolvedSMSText);
      setShowPhone(true);
    } catch (err: unknown) {
      alert(`SMS dispatch error: ${err instanceof Error ? err.message : 'Failed to send SMS'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div>
        <p className={THEME.classes.subtitle}>Automated Communications</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>SMS Notification Logs & Gateway Dispatcher</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Configure automated texts generated by loan lifecycle events (Termux HTTP SMS Gateway) and dispatch SMS broadcasts to any phone number.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Template Config & Sandbox Dispatcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section 1: Template Editor */}
          <div style={{ border: '1px solid #000', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #000', paddingBottom: 6 }}>
              1. Template Configuration
            </h3>
            
            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Trigger Event</label>
              <select
                value={smsTemplate}
                onChange={(e) => {
                  setSmsTemplate(e.target.value);
                  if (e.target.value === 'DISBURSED') {
                    setCustomSmsText('Dear {name}, your loan application has been approved and KES {amount} has been disbursed to your M-Pesa account. Thank you.');
                  } else if (e.target.value === 'PAID') {
                    setCustomSmsText('Dear {name}, we have received your repayment of KES {amount}. Your new outstanding balance is KES {balance}.');
                  } else {
                    setCustomSmsText('ALERT: Dear {name}, your loan is overdue by {days} days. Please pay KES {amount} immediately to avoid CRB blacklisting.');
                  }
                }}
                className={THEME.classes.input}
              >
                <option value="DISBURSED">Loan Disbursement Confirmation</option>
                <option value="PAID">Repayment Receipt Notification</option>
                <option value="OVERDUE">Late Arrears Warning Alert</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>SMS Template Body</label>
              <textarea
                value={customSmsText}
                onChange={(e) => setCustomSmsText(e.target.value)}
                className={THEME.classes.input}
                style={{ height: 85, resize: 'none', fontFamily: 'monospace', fontSize: '11px' }}
              />
              <p style={{ fontSize: '9px', color: '#71717a', textTransform: 'none', marginTop: 4 }}>
                Available tags: <code style={{ fontWeight: 'bold', color: '#000' }}>{"{name}"}</code>, <code style={{ fontWeight: 'bold', color: '#000' }}>{"{amount}"}</code>, <code style={{ fontWeight: 'bold', color: '#000' }}>{"{balance}"}</code>, <code style={{ fontWeight: 'bold', color: '#000' }}>{"{days}"}</code>
              </p>
            </div>

            <button
              type="button"
              onClick={() => alert('SMS Template saved.')}
              className={THEME.classes.btnSecondary}
              style={{ width: '100%' }}
            >
              Save Event Template
            </button>
          </div>

          {/* Section 2: Interactive Gateway Dispatcher */}
          <div style={{ border: '1px solid #000', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #000', paddingBottom: 6 }}>
              2. Termux Gateway Dispatcher
            </h3>

            {loading ? (
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#71717a' }}>Loading recipient borrowers...</p>
            ) : error ? (
              <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#ef4444' }}>{error}</p>
            ) : (
              <form onSubmit={handleSendRealSMS} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Select Borrower (Optional Preset)</label>
                  <select
                    value={selectedBorrowerId}
                    onChange={(e) => setSelectedBorrowerId(e.target.value)}
                    className={THEME.classes.input}
                  >
                    <option value="">-- Custom Target Number --</option>
                    {borrowers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name} ({b.phone_number || 'No Phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Target Phone Number (Any Recipient)</label>
                  <input
                    type="text"
                    value={customPhoneNumber}
                    onChange={(e) => setCustomPhoneNumber(e.target.value)}
                    placeholder="e.g. +254712345678 or 0114945842"
                    className={THEME.classes.input}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>{"{amount}"}</label>
                    <input
                      type="text"
                      value={sandboxAmount}
                      onChange={(e) => setSandboxAmount(e.target.value)}
                      className={THEME.classes.input}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>{"{balance}"}</label>
                    <input
                      type="text"
                      value={sandboxBalance}
                      onChange={(e) => setSandboxBalance(e.target.value)}
                      className={THEME.classes.input}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>{"{days}"}</label>
                    <input
                      type="number"
                      value={sandboxDays}
                      onChange={(e) => setSandboxDays(e.target.value)}
                      className={THEME.classes.input}
                      required
                    />
                  </div>
                </div>

                <div style={{ background: '#fafafa', border: '1px dashed #000', padding: '10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '8px', fontWeight: 900, color: '#71717a' }}>REAL-TIME RESOLVED TEXT PREVIEW:</span>
                  <p style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'none', margin: 0, color: '#000', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {resolvedSMSText}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSending || !customPhoneNumber.trim()}
                  className={THEME.classes.btnPrimary}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {isSending ? 'Sending via Termux Gateway...' : '📱 Dispatch SMS via Termux'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Outbox Delivery Queue */}
        <div style={{ border: '1px solid #000', padding: '1.25rem', background: '#fff', minHeight: 450 }}>
          <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.25rem', borderBottom: '1px solid #000', paddingBottom: 6 }}>
            SMS Outbox Delivery Queue
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {smsLogs.map((log) => (
              <div key={log.id} style={{ border: '1px solid #e4e4e7', padding: '0.75rem', fontSize: '0.6875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{log.recipient}</span>
                  <span style={{ color: '#71717a', fontSize: '0.625rem', fontFamily: 'monospace' }}>{log.time}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#a1a1aa', fontFamily: 'monospace', marginBottom: 6 }}>
                  Phone: {log.phone}
                </div>
                <p style={{ color: '#000', textTransform: 'none', fontFamily: 'monospace', fontSize: '11px', margin: '4px 0', lineHeight: 1.4 }}>
                  {log.content}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <span className={log.status === 'DELIVERED' ? THEME.classes.badgeFilled : THEME.classes.badgeOutline} style={{ fontSize: '8px' }}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Phone Overlay Notification Preview */}
      {showPhone && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '280px',
          background: '#000',
          borderRadius: '28px',
          padding: '8px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
          border: '3px solid #18181b',
          zIndex: 9999,
          animation: 'slideUp 0.3s ease-out',
        }}>
          {/* CSS Animation injection */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideUp {
              from { transform: translateY(100%) scale(0.9); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
          `}} />

          {/* Screen */}
          <div style={{
            background: '#1c1c1e',
            borderRadius: '22px',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            color: '#fff',
            padding: '12px',
            position: 'relative',
          }}>
            {/* Top Speaker/Notch */}
            <div style={{
              width: '110px',
              height: '18px',
              background: '#000',
              borderRadius: '0 0 12px 12px',
              margin: '-12px auto 8px auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }} />

            {/* Simulated Status Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#a1a1aa', padding: '0 4px 10px 4px', fontWeight: 600 }}>
              <span>08:48</span>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span>LTE</span>
                <span style={{ fontSize: '7px' }}>🔋 94%</span>
              </div>
            </div>

            {/* Notification Bubble */}
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '10px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>💬 MESSAGES</span>
                <span style={{ fontSize: '8px', color: '#a1a1aa' }}>now</span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', background: '#e9e9eb', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: 4 }}>
                KARIBU_CR
              </div>
              <p style={{ fontSize: '10px', margin: 0, color: '#e5e5ea', lineHeight: 1.4 }}>
                {simulatedPhoneContent}
              </p>
            </div>

            {/* Mock SMS Thread view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '9px', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
              <span style={{ color: '#71717a', textAlign: 'center', fontSize: '8px' }}>iMessage Today 8:48 AM</span>
              <div style={{
                background: '#3a3a3c',
                alignSelf: 'flex-start',
                padding: '6px 10px',
                borderRadius: '12px',
                maxWidth: '85%',
                color: '#fff',
                fontSize: '9.5px',
                lineHeight: 1.3
              }}>
                {simulatedPhoneContent}
              </div>
            </div>

            {/* Close Overlay Button */}
            <button
              onClick={() => setShowPhone(false)}
              style={{
                width: '100%',
                background: '#ff3b30',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px',
                fontSize: '9px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: 15,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Dismiss Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
