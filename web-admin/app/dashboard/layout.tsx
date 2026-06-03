'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { fetchApi } from '../../lib/api';

/* ─── Icon helpers ─── */
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  grid:        'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z',
  users:       'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  check:       'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  arrowDown:   'M19 13l-7 7-7-7m14-8l-7 7-7-7',
  arrowUp:     'M5 11l7-7 7 7M5 19l7-7 7 7',
  list:        'M4 6h16M4 12h16M4 18h16',
  doc:         'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  shield:      'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  stack:       'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  chart:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z',
  chat:        'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  clock:       'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  gear:        'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  cal:         'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  logout:      'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  bell:        'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  plus:        'M12 4v16m8-8H4',
  person:      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};

/* ─── Role configuration ─── */
const ROLE_META: Record<string, { label: string; color: string; initial: string }> = {
  super_admin:   { label: 'CEO / Managing Director', color: '#3b82f6', initial: 'C' },
  admin:         { label: 'Administrator',           color: '#6366f1', initial: 'A' },
  finance:       { label: 'CFO / Finance',           color: '#059669', initial: 'F' },
  branch_manager:{ label: 'Branch Manager',          color: '#d97706', initial: 'B' },
  loan_officer:  { label: 'Loan Officer',            color: '#0891b2', initial: 'L' },
  collections:   { label: 'Collections Officer',     color: '#dc2626', initial: 'C' },
  compliance:    { label: 'Compliance Officer',      color: '#7c3aed', initial: 'C' },
  credit_engine: { label: 'Credit Scoring Engine',   color: '#0891b2', initial: 'E' },
};

/* ─── Sidebar navigation sections ─── */
const ALL_SECTIONS = [
  {
    title: 'Core Operations',
    items: [
      { label: 'Overview',          path: '/dashboard',                icon: 'grid'    },
      { label: 'Borrowers',         path: '/dashboard/borrowers',      icon: 'users'   },
      { label: 'Loans & Apps',      path: '/dashboard/loans',          icon: 'check'   },
    ],
  },
  {
    title: 'Payments',
    items: [
      { label: 'C2B Paybill',       path: '/dashboard/c2b-monitor',    icon: 'arrowDown' },
      { label: 'B2C Payout',        path: '/dashboard/b2c-payout',     icon: 'arrowUp'   },
      { label: 'Tranches',          path: '/dashboard/tranches',        icon: 'list'      },
    ],
  },
  {
    title: 'Risk & Compliance',
    items: [
      { label: 'CRB Check',         path: '/dashboard/crb-check',          icon: 'doc'   },
      { label: 'Collateral Ledger', path: '/dashboard/collateral',          icon: 'shield' },
      { label: 'Collections Board', path: '/dashboard/collections',         icon: 'stack'  },
      { label: 'PAR & NPL Report',  path: '/dashboard/portfolio-health',    icon: 'chart'  },
    ],
  },
  {
    title: 'System & Policy',
    items: [
      { label: 'SMS Center',        path: '/dashboard/sms-center',         icon: 'chat'   },
      { label: 'Audit Trail',       path: '/dashboard/audit-trail',        icon: 'clock'  },
      { label: 'Penalty Settings',  path: '/dashboard/penalty-settings',   icon: 'gear'   },
      { label: 'Amortization',      path: '/dashboard/amortization',       icon: 'cal'    },
    ],
  },
  {
    title: 'Extended Services',
    items: [
      { label: 'Group Lending',     path: '/dashboard/group-lending',      icon: 'users'  },
      { label: 'Top-Up Apps',       path: '/dashboard/top-ups',            icon: 'plus'   },
      { label: 'Customer Portal',   path: '/dashboard/customer-portal',    icon: 'person' },
    ],
  },
];

function getFilteredSections(role: string) {
  if (role === 'super_admin' || role === 'admin') return ALL_SECTIONS;
  const filtered = [];
  const core = [ALL_SECTIONS[0].items[0]];
  if (['loan_officer','branch_manager','compliance'].includes(role)) core.push(ALL_SECTIONS[0].items[1]);
  if (['loan_officer','branch_manager'].includes(role)) core.push(ALL_SECTIONS[0].items[2]);
  filtered.push({ title: 'Core Operations', items: core });

  const payments = ['finance'].includes(role) ? ALL_SECTIONS[1].items : [];
  if (payments.length) filtered.push({ title: 'Payments', items: payments });

  const risk = [];
  if (['loan_officer','compliance','credit_engine'].includes(role)) risk.push(ALL_SECTIONS[2].items[0]);
  if (['loan_officer','collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[1]);
  if (['collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[2]);
  if (['branch_manager','collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[3]);
  if (risk.length) filtered.push({ title: 'Risk & Compliance', items: risk });

  const sys = [];
  if (['collections'].includes(role)) sys.push(ALL_SECTIONS[3].items[0]);
  if (['compliance','finance'].includes(role)) sys.push(ALL_SECTIONS[3].items[1]);
  if (['finance','credit_engine'].includes(role)) sys.push(ALL_SECTIONS[3].items[2]);
  if (['loan_officer'].includes(role)) sys.push(ALL_SECTIONS[3].items[3]);
  sys.push(ALL_SECTIONS[3].items[4]); // Always show Documentation
  if (sys.length) filtered.push({ title: 'System & Policy', items: sys });

  const ext = [];
  if (['loan_officer','branch_manager'].includes(role)) ext.push(ALL_SECTIONS[4].items[0]); // Group Lending
  if (['loan_officer','finance'].includes(role)) ext.push(ALL_SECTIONS[4].items[1]); // Top-Ups
  if (['loan_officer','finance','branch_manager','collections'].includes(role)) ext.push(ALL_SECTIONS[4].items[2]); // Customer Portal
  if (ext.length) filtered.push({ title: 'Extended Services', items: ext });

  return filtered;
}

/* ─── Breadcrumb helper ─── */
function pageName(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  if (seg === 'dashboard') return 'Overview';
  return seg.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,       setUser]       = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string>('loan_officer');
  const [loading,    setLoading]    = useState<boolean>(true);
  const [collapsed,  setCollapsed]  = useState<boolean>(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const profile = await fetchApi('/users/me');
        setUser(profile);
        const saved = localStorage.getItem('preview_role');
        const role  = saved || profile.role;
        setActiveRole(role);
        if (!saved) localStorage.setItem('preview_role', profile.role);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    const sync = () => {
      const r = localStorage.getItem('preview_role');
      if (r) setActiveRole(r);
    };
    window.addEventListener('preview-role-changed', sync);
    return () => window.removeEventListener('preview-role-changed', sync);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('preview_role');
    router.push('/login');
  };

  const handleRoleChange = (role: string) => {
    localStorage.setItem('preview_role', role);
    setActiveRole(role);
    window.dispatchEvent(new Event('preview-role-changed'));
  };

  const sections      = getFilteredSections(activeRole);
  const roleMeta      = ROLE_META[activeRole] || ROLE_META.loan_officer;
  const isPrivileged  = user?.role === 'super_admin' || user?.role === 'admin';

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)', gap:'0.75rem', color:'var(--text-secondary)', fontSize:'0.875rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-mid)" strokeWidth="2" style={{ animation:'spin 0.8s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      {/* ── MINIMAL FLOATING SIDEBAR ── */}
      <div className="sidebar-layout">
        <aside className="sidebar-nav fade-in" style={{ width: collapsed ? 68 : 260 }}>
          {/* Logo */}
          <div style={{ height: 72, display:'flex', alignItems:'center', gap:'0.875rem', padding: collapsed ? '0 1.1rem' : '0 1.5rem', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'var(--brand)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontWeight:700, fontSize:18,
            }}>K</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>Karibu Credit</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color:'var(--text-muted)' }}>Workspace</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, overflowY:'auto', padding:'1.5rem 0', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            {sections.map((section, si) => (
              <div key={si}>
                {!collapsed && <p style={{ padding: '0 1.5rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.title}</p>}
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {section.items.map((item) => {
                    const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        title={collapsed ? item.label : undefined}
                        className={`sidebar-item${active ? ' active' : ''}`}
                        style={collapsed ? { justifyContent:'center', padding:'0.625rem', margin: '0.25rem 0.625rem', borderRadius: '10px' } : { borderRadius: '10px', margin: '0.125rem 1rem' }}
                      >
                        <Icon d={ICONS[item.icon]} size={18} />
                        {!collapsed && <span style={{ marginLeft: '4px' }}>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User card / Footer */}
          <div style={{ padding:'1rem', borderTop:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding: '0.5rem', background: 'var(--surface-2)', borderRadius: '12px', marginBottom: '0.5rem' }}>
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                background: `linear-gradient(135deg, ${roleMeta.color}, #0f172a)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontWeight:600, fontSize:15,
              }}>
                {(user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ minWidth:0, flex: 1 }}>
                  <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.full_name || 'Staff Console'}
                  </div>
                  <div style={{ fontSize:'0.75rem', color: 'var(--text-muted)', fontWeight:500 }}>
                    {roleMeta.label}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleLogout}
              className="sidebar-item"
              style={{ width:'100%', background:'transparent', cursor:'pointer', justifyContent: collapsed ? 'center' : undefined, color:'var(--danger)', borderRadius: '10px', padding: collapsed ? '0.625rem' : '0.5rem 1rem', margin: 0 }}
            >
              <Icon d={ICONS.logout} size={18} />
              {!collapsed && <span style={{ marginLeft: '4px', fontWeight: 600 }}>Sign Out</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* ── CLEAN TOPBAR & MAIN CONTENT ── */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
            <button
              onClick={() => setCollapsed(p => !p)}
              style={{ width:36, height:36, borderRadius:10, background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-secondary)', flexShrink:0, boxShadow: 'var(--shadow-sm)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div>
              <h1 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                {pageName(pathname)}
              </h1>
              <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', fontWeight:500, marginTop: 2 }}>
                Welcome back to your workspace
              </div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            {/* Search Bar (Mockup for UI aesthetics) */}
            <div style={{ display:'flex', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius: '10px', padding:'0.45rem 1rem', width: 240, boxShadow: 'var(--shadow-sm)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Search..." style={{ border:'none', outline:'none', background:'transparent', fontSize:'0.8125rem', marginLeft:'0.5rem', width:'100%', color:'var(--text-primary)' }} disabled />
            </div>

            {isPrivileged && (
              <div style={{
                display:'flex', alignItems:'center', gap:'0.5rem',
                background:'var(--surface)', border:'1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                borderRadius:'10px', padding:'0.45rem 1rem',
                fontSize:'0.8125rem', color:'var(--text-secondary)',
              }}>
                <span style={{ fontWeight:500, color:'var(--text-muted)' }}>Role:</span>
                <select
                  value={activeRole}
                  onChange={e => handleRoleChange(e.target.value)}
                  style={{ background:'transparent', border:'none', outline:'none', fontSize:'0.8125rem', fontWeight:600, color:'var(--brand)', cursor:'pointer' }}
                >
                  {Object.entries(ROLE_META).map(([val, meta]) => (
                    <option key={val} value={val}>{meta.label}</option>
                  ))}
                </select>
              </div>
            )}

            <button style={{ width:40, height:40, borderRadius:10, background:'var(--surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-secondary)', position:'relative', boxShadow: 'var(--shadow-sm)' }}>
              <Icon d={ICONS.bell} size={18} />
              <span style={{ position:'absolute', top:8, right:8, width:8, height:8, borderRadius:'50%', background:'var(--danger)', border:'2px solid var(--surface)' }} />
            </button>
            
            <Link href="/dashboard/borrowers/new" className="btn btn-secondary" style={{ padding:'0.55rem 1rem', borderRadius: 10, fontWeight: 600 }}>
              + Borrower
            </Link>
            <Link href="/dashboard/loans/new" className="btn btn-primary" style={{ padding:'0.55rem 1.25rem', borderRadius: 10, fontWeight: 600 }}>
              New Application
            </Link>
          </div>
        </header>

        <main className="page-body fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
