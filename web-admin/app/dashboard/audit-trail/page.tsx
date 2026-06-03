'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

type AuditLog = {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ip: string | null;
};

export default function AuditTrailPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAudit() {
      try {
        const data = await fetchApi('/audit/');
        setAuditLogs(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    }
    loadAudit();
  }, []);

  const actionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('APPROVE') || a.includes('ONBOARD') || a.includes('CREATE'))
      return 'text-emerald-600';
    if (a.includes('REJECT') || a.includes('DEFAULT'))
      return 'text-red-600';
    if (a.includes('CRB') || a.includes('LOGIN'))
      return 'text-sky-400';
    return 'text-amber-400';
  };

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading audit trail...
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
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Security &amp; Auditing</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Immutable Compliance Audit Trail</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Audit track record of administrative commands executed within the credit environment. Protects against insider threats and satisfies CBK requirements.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Operator (User)</th>
              <th className="px-4 py-3 font-medium">Action Event</th>
              <th className="px-4 py-3 font-medium">Execution Details</th>
              <th className="px-4 py-3 font-medium">Source IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                    <span>No audit events recorded yet. Actions will appear here as you operate.</span>
                  </div>
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-medium">{log.user}</td>
                  <td className={`px-4 py-3 font-semibold ${actionColor(log.action)}`}>{log.action}</td>
                  <td className="px-4 py-3 text-slate-300">{log.details}</td>
                  <td className="px-4 py-3 text-slate-500">{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500">
          Showing <span className="text-slate-300 font-medium">{auditLogs.length}</span> audit events
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            {auditLogs.filter(l => l.action.includes('APPROVE') || l.action.includes('ONBOARD') || l.action.includes('CREATE')).length} approvals
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400"></span>
            {auditLogs.filter(l => l.action.includes('REJECT')).length} rejections
          </span>
        </div>
      </div>
    </div>
  );
}
