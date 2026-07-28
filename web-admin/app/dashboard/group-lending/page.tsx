'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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
  const s = status.toLowerCase();
  const isFilled = s === 'active' || s === 'cleared' || s === 'disbursed';
  const isOutline = s === 'pending' || s === 'suspended';
  
  let badgeClass = THEME.classes.badgeMuted;
  if (isFilled) {
    badgeClass = THEME.classes.badgeFilled;
  } else if (isOutline) {
    badgeClass = THEME.classes.badgeOutline;
  }

  return (
    <span className={badgeClass}>
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
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);

  /* Joint Liability Simulator states */
  const [simulatingDefault, setSimulatingDefault] = useState(false);
  const [defaultingMemberId, setDefaultingMemberId] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('60000');
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

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
    // Reset simulator when opening a new group
    setSimulatingDefault(false);
    setDefaultingMemberId('');
    setSimulationResult(null);
    try {
      const detail = await fetchApi(`/groups/${groupId}`);
      setSelectedGroup(detail);
      if (detail.members && detail.members.length > 0) {
        setDefaultingMemberId(String(detail.members[0].customer_id));
      }
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

  // Group risk categorization profiling
  const groupRiskMeta = useMemo(() => {
    if (!selectedGroup) return null;
    const count = selectedGroup.members?.length || 0;
    if (count < 3) {
      return {
        label: 'CRITICAL',
        color: '#dc2626',
        description: 'Insufficient co-guarantors. Joint liability frameworks require >= 3 active members.'
      };
    } else if (count <= 4) {
      return {
        label: 'HIGH RISK',
        color: '#d97706',
        description: 'Narrow liability base. Co-guarantor claim exposure per member is elevated.'
      };
    } else if (count <= 7) {
      return {
        label: 'MEDIUM RISK',
        color: '#2563eb',
        description: 'Optimal risk-sharing. Co-signed liability balances correctly.'
      };
    } else {
      return {
        label: 'LOW RISK',
        color: '#16a34a',
        description: 'Well diversified joint liability pool. Negligible co-guarantor default exposure.'
      };
    }
  }, [selectedGroup]);

  // Joint guarantee share percent
  const guarantorSharePercent = useMemo(() => {
    if (!selectedGroup || !selectedGroup.members || selectedGroup.members.length === 0) return 0;
    return (100 / selectedGroup.members.length);
  }, [selectedGroup]);

  // Execute co-guarantor claim distribution calculations
  const runDefaultRedistribution = () => {
    if (!selectedGroup || !selectedGroup.members || selectedGroup.members.length < 2) {
      alert("At least two co-guarantor members are required to redistribute liability claims.");
      return;
    }
    const defId = parseInt(defaultingMemberId);
    const defaultingMember = selectedGroup.members.find(m => m.customer_id === defId);
    if (!defaultingMember) {
      alert("Select a defaulting member first.");
      return;
    }

    const amt = parseFloat(defaultAmount) || 0;
    if (amt <= 0) {
      alert("Please specify a valid default debt claim amount.");
      return;
    }

    const coGuarantors = selectedGroup.members.filter(m => m.customer_id !== defId);
    const splitAmount = Math.round((amt / coGuarantors.length) * 100) / 100;

    setSimulationResult({
      defaultingMemberName: defaultingMember.customer_name || `Customer #${defaultingMember.customer_id}`,
      totalDefault: amt,
      splitAmount,
      coGuarantors: coGuarantors.map(cg => ({
        name: cg.customer_name || `Customer #${cg.customer_id}`,
        phone: customers.find(c => c.id === cg.customer_id)?.phone || 'No Phone',
        guaranteeSharePercent: guarantorSharePercent.toFixed(1),
        claimedAmount: splitAmount
      }))
    });
  };

  /* ─── Loading / Error ─── */
  if (loading) {
    const shimmerRows = Array.from({ length: 6 });
    const kpiCards = Array.from({ length: 4 });
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <style>{`
          @keyframes karibuShimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .karibu-skel {
            background: linear-gradient(90deg, #e5e5e5 0px, #f5f5f5 40px, #e5e5e5 80px);
            background-size: 800px 100%;
            animation: karibuShimmer 1.4s linear infinite;
          }
        `}</style>

        <div className="karibu-skel" style={{ height: 20, width: 240, marginBottom: 20, border: '1px solid #000' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {kpiCards.map((_, i) => (
            <div key={i} style={{ border: '1px solid #000', padding: '1rem' }}>
              <div className="karibu-skel" style={{ height: 10, width: '60%', marginBottom: 10, border: '1px solid #000' }} />
              <div className="karibu-skel" style={{ height: 22, width: '80%', border: '1px solid #000' }} />
            </div>
          ))}
        </div>

        <div className="karibu-skel" style={{ height: 220, width: '100%', marginBottom: '1.5rem', border: '1px solid #000' }} />

        <div style={{ border: '1px solid #000' }}>
          {shimmerRows.map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.85rem 1rem',
                borderBottom: i === shimmerRows.length - 1 ? 'none' : '1px solid #000',
              }}
            >
              <div className="karibu-skel" style={{ height: 32, width: 32, flexShrink: 0, border: '1px solid #000' }} />
              <div style={{ flex: 1 }}>
                <div className="karibu-skel" style={{ height: 12, width: '40%', marginBottom: 6, border: '1px solid #000' }} />
                <div className="karibu-skel" style={{ height: 10, width: '25%', border: '1px solid #000' }} />
              </div>
              <div className="karibu-skel" style={{ height: 20, width: 70, border: '1px solid #000' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 56, borderRadius: 0 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={THEME.classes.card}>
        <p className="text-black font-mono text-xs uppercase tracking-wider">⚠ {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className={`${THEME.classes.card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black pb-4`}>
        <div>
          <p className={THEME.classes.subtitle}>Joint Liability</p>
          <h2 className={THEME.classes.title + " mt-1"}>Group Lending Management</h2>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed max-w-2xl">
            Create and manage lending groups, onboard members, and analyze co-guarantor claim distribution ratios under joint liability frameworks.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={THEME.classes.btnPrimary}
        >
          + New Group
        </button>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups', value: groups.length },
          { label: 'Active Groups', value: groups.filter(g => g.status === 'active').length },
          { label: 'Total Members', value: groups.reduce((s, g) => s + g.member_count, 0) },
          { label: 'Group Loans', value: groups.reduce((s, g) => s + g.total_loans, 0) },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-black p-3 bg-white">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {kpi.label}
            </p>
            <p className="text-2xl font-black font-mono text-black mt-2">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ─── Create Group Form (collapsible) ─── */}
      {showCreateForm && (
        <form onSubmit={createGroup} className={`${THEME.classes.card} flex flex-col md:flex-row gap-4 items-end`}>
          <div className="flex-1 w-full">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Group Name</label>
            <input
              type="text"
              className={THEME.classes.input}
              value={newGroup.group_name}
              onChange={(e) => setNewGroup({ ...newGroup, group_name: e.target.value })}
              placeholder="E.G. UMOJA SACCO GROUP"
              required
            />
          </div>
          <div className="flex-1 w-full">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Description</label>
            <input
              type="text"
              className={THEME.classes.input}
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              placeholder="MARKET VENDORS, NAIROBI CBD"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Max Members</label>
            <input
              type="number"
              className={THEME.classes.input}
              value={newGroup.max_members}
              onChange={(e) => setNewGroup({ ...newGroup, max_members: parseInt(e.target.value) || 15 })}
              min={3}
              max={30}
            />
          </div>
          <button type="submit" disabled={submitting} className={THEME.classes.btnPrimary + " w-full md:w-auto"}>
            {submitting ? 'Creating…' : 'Create Group'}
          </button>
        </form>
      )}

      {/* ─── Main Content Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Groups Table */}
        {!isDetailExpanded && (
          <div className={`${THEME.classes.card} lg:col-span-8 overflow-hidden`}>
            <div className="border-b border-black pb-3 mb-4">
              <h3 className={THEME.classes.sectionTitle}>Lending Groups</h3>
            </div>
            <div className="overflow-x-auto border border-black bg-white">
              <table className="min-w-full text-left text-xs font-mono">
                <thead className="bg-black text-white uppercase tracking-wider text-[10px] border-b border-black">
                  <tr>
                    <th className="px-4 py-3 font-bold">Code</th>
                    <th className="px-4 py-3 font-bold">Group Name</th>
                    <th className="px-4 py-3 font-bold">Members</th>
                    <th className="px-4 py-3 font-bold">Loans</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400 uppercase tracking-widest">
                        No lending groups found. Create one to get started.
                      </td>
                    </tr>
                  ) : (
                    groups.map((g) => (
                      <tr key={g.id} className="hover:bg-zinc-50 transition-colors" onClick={() => viewGroupDetails(g.id)}>
                        <td className="px-4 py-3 text-zinc-500 font-bold">{g.group_code}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-black uppercase">{g.group_name}</div>
                          {g.description && (
                            <div className="text-[10px] text-zinc-400 mt-0.5 uppercase">
                              {g.description.length > 50 ? g.description.slice(0, 50) + '…' : g.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-black">{g.member_count}</span>
                          <span className="text-zinc-400 text-[10px]"> / {g.max_members}</span>
                        </td>
                        <td className="px-4 py-3 font-bold">{g.total_loans}</td>
                        <td className="px-4 py-3">{statusBadge(g.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="border border-black bg-white hover:bg-zinc-100 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-black"
                              onClick={() => setAddMemberGroupId(g.id)}
                            >
                              + Member
                            </button>
                            <button
                              className="border border-black bg-black text-white hover:bg-zinc-800 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider"
                              onClick={() => setLoanGroupId(g.id)}
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
          </div>
        )}

        {/* Detail Panel */}
        {selectedGroup && (
          <div className={`${THEME.classes.card} ${isDetailExpanded ? 'lg:col-span-12' : 'lg:col-span-4'} space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto`}>
            <div className="flex justify-between items-center border-b border-black pb-3">
              <div className="flex items-center gap-2">
                <h3 className={THEME.classes.sectionTitle}>{selectedGroup.group_name}</h3>
                <button
                  onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                  title={isDetailExpanded ? "Collapse Details" : "Expand Details"}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    border: '1px solid #000',
                    background: '#fff',
                    color: '#000',
                    cursor: 'pointer',
                    borderRadius: '2px'
                  }}
                >
                  {isDetailExpanded ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H3v5M16 21h5v-5M21 3l-7 7M3 21l7-7" />
                    </svg>
                  )}
                </button>
              </div>
              <button onClick={() => { setSelectedGroup(null); setIsDetailExpanded(false); }} className="font-bold text-xs uppercase hover:underline">✕ Close</button>
            </div>
            
            <div className="flex gap-3 font-mono text-[10px] items-center">
              <span className="text-zinc-500 font-bold">{selectedGroup.group_code}</span>
              {statusBadge(selectedGroup.status)}
            </div>

            {/* NEW FEATURE: Joint Liability Credit Risk Profile */}
            {groupRiskMeta && (
              <div style={{ border: '1px solid #000', padding: '10px', background: '#fafafa', fontFamily: 'monospace', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 'bold', fontSize: '9px', color: '#71717a' }}>JOINT LIABILITY PROFILE:</span>
                  <span style={{ fontWeight: 'bold', color: groupRiskMeta.color }}>{groupRiskMeta.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: '10px', textTransform: 'none', lineHeight: 1.4, color: '#000' }}>
                  {groupRiskMeta.description}
                </p>
                <div style={{ marginTop: 8, borderTop: '1px dashed #ccc', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span>Individual Guarantee Share:</span>
                  <span style={{ fontWeight: 'bold' }}>{guarantorSharePercent.toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* NEW FEATURE: Joint Liability Claims Redistribution Simulator */}
            {selectedGroup.members && selectedGroup.members.length >= 2 && (
              <div style={{ border: '1px solid #000', padding: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: 4 }}>
                  <h4 style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Default Claims Simulator</h4>
                  <button
                    type="button"
                    onClick={() => setSimulatingDefault(!simulatingDefault)}
                    style={{ fontSize: '9px', fontWeight: 'bold', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {simulatingDefault ? 'Hide Sandbox' : 'Simulate Default'}
                  </button>
                </div>

                {simulatingDefault && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '10px', fontFamily: 'monospace' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '8px', fontWeight: 'bold', marginBottom: 2 }}>SELECT DEFAULTING MEMBER</label>
                      <select
                        value={defaultingMemberId}
                        onChange={(e) => setDefaultingMemberId(e.target.value)}
                        className={THEME.classes.input}
                        style={{ height: '28px', padding: '2px 6px', fontSize: '10px' }}
                      >
                        {selectedGroup.members.map(m => (
                          <option key={m.id} value={m.customer_id}>{m.customer_name || `Borrower #${m.customer_id}`}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '8px', fontWeight: 'bold', marginBottom: 2 }}>DEFAULT LIQUIDATION AMOUNT (KES)</label>
                      <input
                        type="number"
                        value={defaultAmount}
                        onChange={(e) => setDefaultAmount(e.target.value)}
                        className={THEME.classes.input}
                        style={{ height: '28px', padding: '2px 6px', fontSize: '10px' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={runDefaultRedistribution}
                      className={THEME.classes.btnPrimary}
                      style={{ fontSize: '9px', padding: '4px 8px', width: '100%', marginTop: 2 }}
                    >
                      Redistribute Claim to Co-Guarantors
                    </button>

                    {simulationResult && (
                      <div style={{ marginTop: 8, padding: '8px', border: '1px solid #ef4444', background: '#fee2e2', color: '#000', fontSize: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#b91c1c', marginBottom: 4, textTransform: 'uppercase' }}>
                           LIABILITY CLAIMS REDISTRIBUTED:
                        </div>
                        <p style={{ margin: '0 0 6px 0', textTransform: 'none', lineHeight: 1.3 }}>
                          <strong>{simulationResult.defaultingMemberName}</strong> default of <strong>KES {simulationResult.totalDefault.toLocaleString()}</strong> has been claimed proportionally from co-signers:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {simulationResult.coGuarantors.map((cg: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #fca5a5', paddingBottom: 2 }}>
                              <span style={{ fontWeight: 'bold' }}>{cg.name}</span>
                              <span style={{ fontWeight: 'black' }}>KES {cg.claimedAmount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedGroup.description && (
              <p className="text-xs text-zinc-500 uppercase leading-relaxed font-mono">{selectedGroup.description}</p>
            )}

            {/* Members list */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-100 pb-1">
                Members ({selectedGroup.members?.length || 0})
              </p>
              <div className="space-y-2">
                {(selectedGroup.members || []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between border border-black bg-zinc-50 p-2 font-mono text-xs uppercase">
                    <span className="font-bold text-black">
                      {m.customer_name || `Customer #${m.customer_id}`}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">
                      {m.role}
                    </span>
                  </div>
                ))}
                {(!selectedGroup.members || selectedGroup.members.length === 0) && (
                  <p className="text-[10px] text-zinc-400 font-mono uppercase text-center py-2">No members onboarded yet</p>
                )}
              </div>
            </div>

            {/* Group Loans */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-100 pb-1">
                Loan History ({selectedGroup.group_loans?.length || 0})
              </p>
              <div className="space-y-3">
                {(selectedGroup.group_loans || []).map((gl) => (
                  <div key={gl.id} className="border border-black p-3 bg-white font-mono text-xs uppercase">
                    <div className="flex justify-between items-center border-b border-zinc-100 pb-1 mb-2">
                      <span className="font-bold text-black">{gl.application_no}</span>
                      {statusBadge(gl.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Principal:</span>
                      <span className="font-bold text-black">KES {gl.principal_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-zinc-500">Tenure:</span>
                      <span>{gl.tenure_months}mo @ {gl.interest_rate}%</span>
                    </div>
                    {gl.total_payable > 0 && (
                      <div className="mt-3 pt-2 border-t border-zinc-100">
                        <div className="flex justify-between text-[9px] text-zinc-400 font-bold mb-1">
                          <span>Repayment Progress</span>
                          <span>{Math.round((gl.total_paid / gl.total_payable) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-200 overflow-hidden">
                          <div
                            className="h-full bg-black transition-all duration-300"
                            style={{ width: `${Math.min(100, (gl.total_paid / gl.total_payable) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!selectedGroup.group_loans || selectedGroup.group_loans.length === 0) && (
                  <p className="text-[10px] text-zinc-400 font-mono uppercase text-center py-2">No group loans filed yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add Member Modal ─── */}
      {addMemberGroupId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setAddMemberGroupId(null)}
        >
          <form
            onSubmit={addMember}
            onClick={(e) => e.stopPropagation()}
            className={`${THEME.classes.card} w-[400px] space-y-4`}
          >
            <h3 className={THEME.classes.sectionTitle}>Add Member to Group</h3>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Select Borrower</label>
              <select
                className={THEME.classes.input}
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
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Role</label>
              <select
                className={THEME.classes.input}
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
              >
                <option value="member">Member</option>
                <option value="chairman">Chairman</option>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2 border-t border-black/10 justify-end">
              <button type="button" className={THEME.classes.btnSecondary} onClick={() => setAddMemberGroupId(null)}>Cancel</button>
              <button type="submit" disabled={submitting} className={THEME.classes.btnPrimary}>
                {submitting ? 'Adding…' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Group Loan Application Modal ─── */}
      {loanGroupId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setLoanGroupId(null)}
        >
          <form
            onSubmit={applyGroupLoan}
            onClick={(e) => e.stopPropagation()}
            className={`${THEME.classes.card} w-[420px] space-y-4`}
          >
            <h3 className={THEME.classes.sectionTitle}>Apply for Group Loan</h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider leading-relaxed">
              The principal will be distributed equally among active group members under joint liability.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Principal (KES)</label>
                <input
                  type="number"
                  className={THEME.classes.input}
                  value={loanForm.principal_amount}
                  onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                  placeholder="E.G. 500000"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Monthly Rate (%)</label>
                <input
                  type="number"
                  className={THEME.classes.input}
                  value={loanForm.interest_rate}
                  onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })}
                  step="0.5"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tenure (months)</label>
                <input
                  type="number"
                  className={THEME.classes.input}
                  value={loanForm.tenure_months}
                  onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })}
                  min={1}
                  max={36}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Purpose</label>
                <input
                  type="text"
                  className={THEME.classes.input}
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  placeholder="WORKING CAPITAL"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-black/10 justify-end">
              <button type="button" className={THEME.classes.btnSecondary} onClick={() => setLoanGroupId(null)}>Cancel</button>
              <button type="submit" disabled={submitting} className={THEME.classes.btnPrimary}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
