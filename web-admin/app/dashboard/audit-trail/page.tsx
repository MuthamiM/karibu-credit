'use client';

import { useEffect, useState, useCallback } from 'react';
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

const ACTION_TYPES = [
  'APPROVE_LOAN',
  'REJECT_LOAN',
  'CREATE_LOAN_ADMIN',
  'APPLY_LOAN',
  'DISBURSE_TRANCHE',
  'LOAN_TOPUP',
  'UPDATE_PENALTY_SETTINGS',
  'CRB_CHECK',
  'ATTACH_COLLATERAL',
  'ONBOARD_BORROWER',
  'UPDATE_CUSTOMER',
  'BLACKLIST_CUSTOMER',
];

function actionBadge(action: string) {
  const a = action.toUpperCase();
  if (a.includes('APPROVE') || a.includes('ONBOARD') || a.includes('CREATE'))
    return THEME.classes.badgeFilled;
  if (a.includes('REJECT') || a.includes('BLACKLIST') || a.includes('DEFAULT'))
    return THEME.classes.badgeMuted;
  if (a.includes('UPDATE') || a.includes('TOPUP') || a.includes('DISBURSE'))
    return THEME.classes.badgeOutline;
  return THEME.classes.badgeMuted;
}

export default function AuditTrailPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter.trim()) params.set('user', userFilter.trim());
    return `/audit/?${params.toString()}`;
  }, [actionFilter, userFilter, limit]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi(buildUrl());
      setAuditLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const approvalCount = auditLogs.filter(
    (l) => l.action.includes('APPROVE') || l.action.includes('ONBOARD') || l.action.includes('CREATE')
  ).length;
  const rejectionCount = auditLogs.filter((l) => l.action.includes('REJECT')).length;

  return (
    <div className={THEME.classes.panel}>
      {/* Page header */}
      <div className="border-b border-black pb-4 mb-6">
        <p className={THEME.classes.subtitle}>Security &amp; Auditing</p>
        <h2 className={THEME.classes.title + ' mt-1'}>Immutable Compliance Audit Trail</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Audit track record of administrative commands executed within the credit environment.
          Protects against insider threats and satisfies CBK regulatory requirements.
        </p>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Filter by Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className={THEME.classes.input}
          >
            <option value="">All Actions</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Filter by User Email
          </label>
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadAudit()}
            className={THEME.classes.input}
            placeholder="e.g. john@karibu.co.ke"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Max Records
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className={THEME.classes.input}
          >
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n} records
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-black bg-white p-4 mb-4">
          <p className="font-mono text-xs uppercase tracking-wider text-black">⚠ {error}</p>
        </div>
      )}

      {/* Table */}
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
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-3 text-zinc-400 uppercase tracking-widest text-[10px]">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    Loading audit trail...
                  </div>
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-400 uppercase tracking-widest text-[10px]">
                  No audit events match your filters.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-KE')}
                  </td>
                  <td className="px-4 py-3 text-black font-semibold">{log.user}</td>
                  <td className="px-4 py-3">
                    <span className={actionBadge(log.action)}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-800 max-w-md">
                    <span title={log.details}>{log.details}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{log.ip || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="mt-4 flex items-center justify-between px-1 font-mono text-[10px] uppercase text-zinc-400 tracking-wider">
        <p>
          Showing <span className="text-black font-bold">{auditLogs.length}</span> audit event
          {auditLogs.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-black border border-black" />
            {approvalCount} approvals / creations
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-white border border-black" />
            {rejectionCount} rejections
          </span>
        </div>
      </div>
    </div>
  );
}
