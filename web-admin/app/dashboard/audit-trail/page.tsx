'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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

  const actionFontWeight = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('APPROVE') || a.includes('ONBOARD') || a.includes('CREATE') || a.includes('REJECT') || a.includes('DEFAULT'))
      return 'font-bold text-black';
    return 'text-zinc-600';
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-white border border-black p-8 text-black gap-3 font-mono text-xs uppercase tracking-wider">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        Loading audit trail...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-black bg-white p-8">
        <div className="flex items-center gap-3 text-black font-mono text-xs uppercase tracking-wider">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={THEME.classes.panel}>
      <div className="border-b border-black pb-4 mb-6">
        <p className={THEME.classes.subtitle}>Security &amp; Auditing</p>
        <h2 className={THEME.classes.title + " mt-1"}>Immutable Compliance Audit Trail</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Audit track record of administrative commands executed within the credit environment. Protects against insider threats and satisfies CBK requirements.
        </p>
      </div>

      <div className="overflow-x-auto border border-black bg-white">
        <table className="min-w-full text-left text-xs font-mono">
          <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
            <tr>
              <th className="px-4 py-3.5 font-bold">Timestamp</th>
              <th className="px-4 py-3.5 font-bold">Operator (User)</th>
              <th className="px-4 py-3.5 font-bold">Action Event</th>
              <th className="px-4 py-3.5 font-bold">Execution Details</th>
              <th className="px-4 py-3.5 font-bold">Source IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-400 uppercase tracking-widest">
                  No audit events recorded yet. Actions will appear here as you operate.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-500">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-black font-semibold">{log.user}</td>
                  <td className={`px-4 py-3 ${actionFontWeight(log.action)}`}>{log.action}</td>
                  <td className="px-4 py-3 text-zinc-800">{log.details}</td>
                  <td className="px-4 py-3 text-zinc-500">{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center justify-between px-1 font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
        <p>
          Showing <span className="text-black font-bold">{auditLogs.length}</span> audit events
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 bg-black border border-black"></span>
            {auditLogs.filter(l => l.action.includes('APPROVE') || l.action.includes('ONBOARD') || l.action.includes('CREATE')).length} approvals
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 bg-white border border-black"></span>
            {auditLogs.filter(l => l.action.includes('REJECT')).length} rejections
          </span>
        </div>
      </div>
    </div>
  );
}
