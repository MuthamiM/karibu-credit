'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

/* ─── Types ─── */
type GroupMember = {
  id: number;
  group_id: number;
  customer_id: number;
  role: string;
  is_active: boolean;
  joined_at: string;
  customer_name: string | null;
};

type GroupLoan = {
  id: number;
  group_id: number;
  application_no: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  total_payable: number;
  total_paid: number;
  outstanding_balance: number;
  status: string;
  purpose: string | null;
  created_at: string;
};

type LendingGroup = {
  id: number;
  group_code: string;
  group_name: string;
  description: string | null;
  status: string;
  max_members: number;
  member_count: number;
  total_loans: number;
  created_at: string;
  members?: GroupMember[];
  group_loans?: GroupLoan[];
};

type CustomerOption = {
  id: number;
  full_name: string;
  phone: string;
};

/* ─── Status badge helper ─── */
function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    suspended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dissolved: 'bg-rose-500/10 text-red-600 border-rose-500/20',
    pending: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    disbursed: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    cleared: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    defaulted: 'bg-rose-500/10 text-red-600 border-rose-500/20',
    rejected: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  };
  const cls = map[status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

export default function GroupLendingPage() {
  const [groups, setGroups] = useState<LendingGroup[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* Create Group state */
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroup, setNewGroup] = useState({ group_name: '', description: '', max_members: 15 });
  const [submitting, setSubmitting] = useState(false);

  /* Add Member state */
  const [addMemberGroupId, setAddMemberGroupId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({ customer_id: '', role: 'member' });

  /* Group Loan Application state */
  const [loanGroupId, setLoanGroupId] = useState<number | null>(null);
  const [loanForm, setLoanForm] = useState({ principal_amount: '', interest_rate: '5', tenure_months: '6', purpose: '' });

  /* Detail Panel state */
  const [selectedGroup, setSelectedGroup] = useState<LendingGroup | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadData() {
    try {
      const [groupsData, borrowersData] = await Promise.all([
        fetchApi('/groups/'),
        fetchApi('/users/?role=borrower'),
      ]);
      setGroups(groupsData);
      setCustomers(
        borrowersData.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          phone: u.phone_number || '',
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function viewGroupDetails(groupId: number) {
    setDetailLoading(true);
    try {
      const detail = await fetchApi(`/groups/${groupId}`);
      setSelectedGroup(detail);
    } catch {
      /* silent */
    } finally {
      setDetailLoading(false);
    }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetchApi('/groups/create', {
        method: 'POST',
        body: JSON.stringify(newGroup),
      });
      setNewGroup({ group_name: '', description: '', max_members: 15 });
      setShowCreateForm(false);
      await loadData();
    } catch (err: unknown) {
      alert(`Create failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addMemberGroupId || !memberForm.customer_id) return;
    setSubmitting(true);
    try {
      await fetchApi('/groups/join', {
        method: 'POST',
        body: JSON.stringify({
          group_id: addMemberGroupId,
          customer_id: parseInt(memberForm.customer_id),
          role: memberForm.role,
        }),
      });
      setMemberForm({ customer_id: '', role: 'member' });
      setAddMemberGroupId(null);
      await loadData();
      if (selectedGroup?.id === addMemberGroupId) viewGroupDetails(addMemberGroupId);
    } catch (err: unknown) {
      alert(`Join failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function applyGroupLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!loanGroupId) return;
    setSubmitting(true);
    try {
      await fetchApi('/groups/apply', {
        method: 'POST',
        body: JSON.stringify({
          group_id: loanGroupId,
          principal_amount: parseFloat(loanForm.principal_amount),
          interest_rate: parseFloat(loanForm.interest_rate),
          tenure_months: parseInt(loanForm.tenure_months),
          purpose: loanForm.purpose || null,
        }),
      });
      setLoanForm({ principal_amount: '', interest_rate: '5', tenure_months: '6', purpose: '' });
      setLoanGroupId(null);
      await loadData();
    } catch (err: unknown) {
      alert(`Application failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '2rem' }}>
        <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>⚠ {error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ─── Header ─── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
        padding: '1.5rem 1.75rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div>
          <p style={{ fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0ea5e9' }}>
            Joint Liability
          </p>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            Group Lending Management
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6, maxWidth: 520 }}>
            Create and manage lending groups, onboard members, and process group loan applications under joint liability frameworks.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
          style={{ fontSize: '0.75rem', padding: '0.5rem 1rem', flexShrink: 0 }}
        >
          + New Group
        </button>
      </div>

      {/* ─── KPI Strip ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total Groups', value: groups.length, color: '#6366f1' },
          { label: 'Active Groups', value: groups.filter(g => g.status === 'active').length, color: '#10b981' },
          { label: 'Total Members', value: groups.reduce((s, g) => s + g.member_count, 0), color: '#0ea5e9' },
          { label: 'Group Loans', value: groups.reduce((s, g) => s + g.total_loans, 0), color: '#f59e0b' },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {kpi.label}
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: kpi.color, marginTop: 4 }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Create Group Form (collapsible) ─── */}
      {showCreateForm && (
        <form onSubmit={createGroup} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
          padding: '1.5rem', boxShadow: 'var(--shadow-card)',
          display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '1rem', alignItems: 'end',
        }}>
          <div>
            <label className="form-label">Group Name</label>
            <input
              type="text"
              className="form-input"
              value={newGroup.group_name}
              onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
              placeholder="e.g. Umoja Sacco Group"
              required
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-input"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              placeholder="Market vendors, Nairobi CBD"
            />
          </div>
          <div>
            <label className="form-label">Max Members</label>
            <input
              type="number"
              className="form-input"
              value={newGroup.max_members}
              onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) || 15 })}
              min={3}
              max={30}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: 40 }}>
            {submitting ? 'Creating…' : 'Create Group'}
          </button>
        </form>
      )}

      {/* ─── Main Content Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '1fr 400px' : '1fr', gap: '1.25rem' }}>
        {/* Groups Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Group Name</th>
                <th>Members</th>
                <th>Loans</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No lending groups found. Create one to get started.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => viewGroupDetails(g.id)}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{g.group_code}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{g.group_name}</div>
                      {g.description && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {g.description.length > 50 ? g.description.slice(0, 50) + '…' : g.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0ea5e9' }}>{g.member_count}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}> / {g.max_members}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{g.total_loans}</td>
                    <td>{statusBadge(g.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}
                          onClick={(e) => { e.stopPropagation(); setAddMemberGroupId(g.id); }}
                        >
                          + Member
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', color: '#6366f1' }}
                          onClick={(e) => { e.stopPropagation(); setLoanGroupId(g.id); }}
                        >
                          Apply Loan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedGroup && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
            padding: '1.25rem', boxShadow: 'var(--shadow-card)',
            display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'auto', maxHeight: 'calc(100vh - 340px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{selectedGroup.group_name}</h3>
              <button onClick={() => setSelectedGroup(null)} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{selectedGroup.group_code}</span>
              {statusBadge(selectedGroup.status)}
            </div>
            {selectedGroup.description && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedGroup.description}</p>
            )}

            {/* Members list */}
            <div>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Members ({selectedGroup.members?.length || 0})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selectedGroup.members || []).map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '0.5rem 0.75rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {m.customer_name || `Customer #${m.customer_id}`}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: m.role === 'chairman' ? '#f59e0b' : m.role === 'treasurer' ? '#10b981' : 'var(--text-muted)',
                    }}>
                      {m.role}
                    </span>
                  </div>
                ))}
                {(!selectedGroup.members || selectedGroup.members.length === 0) && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>No members yet</p>
                )}
              </div>
            </div>

            {/* Group Loans */}
            <div>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Loan History ({selectedGroup.group_loans?.length || 0})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selectedGroup.group_loans || []).map((gl) => (
                  <div key={gl.id} style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '0.625rem 0.75rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#6366f1' }}>{gl.application_no}</span>
                      {statusBadge(gl.status)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        KES {gl.principal_amount?.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {gl.tenure_months}mo @ {gl.interest_rate}%
                      </span>
                    </div>
                    {gl.total_payable > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                          <span>Repaid</span>
                          <span>KES {gl.total_paid?.toLocaleString()} / {gl.total_payable?.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, marginTop: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${Math.min(100, (gl.total_paid / gl.total_payable) * 100)}%`,
                            background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!selectedGroup.group_loans || selectedGroup.group_loans.length === 0) && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>No group loans yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add Member Modal ─── */}
      {addMemberGroupId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
          onClick={() => setAddMemberGroupId(null)}
        >
          <form
            onSubmit={addMember}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '1.5rem', width: 400, boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Add Member to Group</h3>
            <div>
              <label className="form-label">Select Borrower</label>
              <select
                className="form-input"
                value={memberForm.customer_id}
                onChange={(e) => setMemberForm({ ...memberForm, customer_id: e.target.value })}
                required
              >
                <option value="">Choose a borrower…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
              >
                <option value="member">Member</option>
                <option value="chairman">Chairman</option>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAddMemberGroupId(null)}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Group Loan Application Modal ─── */}
      {loanGroupId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}
          onClick={() => setLoanGroupId(null)}
        >
          <form
            onSubmit={applyGroupLoan}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
              padding: '1.5rem', width: 420, boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Apply for Group Loan</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The principal will be distributed equally among active group members under joint liability.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Principal (KES)</label>
                <input
                  type="number"
                  className="form-input"
                  value={loanForm.principal_amount}
                  onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                  placeholder="e.g. 500000"
                  required
                />
              </div>
              <div>
                <label className="form-label">Monthly Rate (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={loanForm.interest_rate}
                  onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                  step="0.5"
                />
              </div>
              <div>
                <label className="form-label">Tenure (months)</label>
                <input
                  type="number"
                  className="form-input"
                  value={loanForm.tenure_months}
                  onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })}
                  min={1}
                  max={36}
                />
              </div>
              <div>
                <label className="form-label">Purpose</label>
                <input
                  type="text"
                  className="form-input"
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  placeholder="Working capital"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setLoanGroupId(null)}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
