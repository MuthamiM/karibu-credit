'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { fetchApi } from '../../lib/api';
import { THEME } from '@/theme';

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
  super_admin:   { label: 'CEO / Managing Director', color: '#000000', initial: 'C' },
  admin:         { label: 'Administrator',           color: '#18181b', initial: 'A' },
  finance:       { label: 'CFO / Finance',           color: '#27272a', initial: 'F' },
  branch_manager:{ label: 'Branch Manager',          color: '#3f3f46', initial: 'B' },
  loan_officer:  { label: 'Loan Officer',            color: '#52525b', initial: 'L' },
  collections:   { label: 'Collections Officer',     color: '#71717a', initial: 'C' },
  compliance:    { label: 'Compliance Officer',      color: '#a1a1aa', initial: 'C' },
  credit_engine: { label: 'Credit Scoring Engine',   color: '#d4d4d8', initial: 'E' },
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
      { label: 'Credit Appraisal',  path: '/dashboard/crb-check',          icon: 'doc'   },
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
      { label: 'My Security & OTP', path: '/dashboard/settings',           icon: 'shield' },
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
  if (['loan_officer', 'branch_manager', 'finance', 'compliance', 'credit_engine'].includes(role)) risk.push(ALL_SECTIONS[2].items[0]);
  if (['loan_officer','collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[1]);
  if (['collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[2]);
  if (['branch_manager','collections'].includes(role)) risk.push(ALL_SECTIONS[2].items[3]);
  if (risk.length) filtered.push({ title: 'Risk & Compliance', items: risk });

  const sys = [ALL_SECTIONS[3].items[4]]; // Security & OTP is accessible to all logged in users
  if (['collections'].includes(role)) sys.push(ALL_SECTIONS[3].items[0]);
  if (['compliance','finance'].includes(role)) sys.push(ALL_SECTIONS[3].items[1]);
  if (['finance','credit_engine'].includes(role)) sys.push(ALL_SECTIONS[3].items[2]);
  if (['loan_officer'].includes(role)) sys.push(ALL_SECTIONS[3].items[3]);
  filtered.push({ title: 'System & Policy', items: sys });

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
  const [topSearchValue, setTopSearchValue] = useState<string>('');
  const [user,       setUser]       = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string>('loan_officer');
  const logoutBtnRef = useRef<HTMLButtonElement>(null);
  const [loading,    setLoading]    = useState<boolean>(true);
  const [collapsed,  setCollapsed]  = useState<boolean>(false);

  /* Notifications state */
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [notifications, setNotifications] = useState([
    { id: 1, text: "New loan application LAF-0034 submitted for review.", read: false, time: "5m ago" },
    { id: 2, text: "CRB check for Borrower Muthami passed with score 710.", read: true, time: "1h ago" },
    { id: 3, text: "SMS reminder sent to Borrower Jane Doe (Overdue 3 days).", read: false, time: "2h ago" },
    { id: 4, text: "System payout KES 150,000 for LAF-0012 disbursed successfully.", read: true, time: "1d ago" },
  ]);

  const toggleRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'read') return n.read;
    return true;
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const profile = await fetchApi('/users/me');
        setUser(profile);
        const role = profile.role ? profile.role.toLowerCase() : 'super_admin';
        setActiveRole(role);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);


  useEffect(() => {
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      setTopSearchValue(sp.get('search') ?? '');
    } catch {
      setTopSearchValue('');
    }
  }, [pathname]);

  const handleTopSearchChange = (value: string) => {
    setTopSearchValue(value);
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (value) params.set('search', value);
      else params.delete('search');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const sync = () => {
      const r = localStorage.getItem('preview_role');
      if (r) setActiveRole(r);
    };
    window.addEventListener('preview-role-changed', sync);
    return () => window.removeEventListener('preview-role-changed', sync);
  }, []);

  const handleLogout = () => {
    console.log('LOGOUT HANDLER FIRED');
    localStorage.removeItem('token');
    localStorage.removeItem('preview_role');
    router.push('/login');
  };

  useEffect(() => {
    const btn = logoutBtnRef.current;
    if (!btn) return;
    const rawHandler = (e: Event) => {
      console.log('RAW DOM LISTENER FIRED');
      handleLogout();
    };
    btn.addEventListener('click', rawHandler);
    return () => btn.removeEventListener('click', rawHandler);
  }, []);

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:THEME.colors.bg, gap:'0.75rem', color:THEME.colors.textSecondary, fontSize:'0.875rem', fontFamily: 'monospace' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" style={{ animation:'spin 0.8s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        LOADING WORKSPACE…
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      {/* ── MINIMAL FLOATING SIDEBAR ── */}
      <div className="sidebar-layout">
        <aside className="sidebar-nav fade-in" style={{ width: collapsed ? 68 : 260, borderRadius: 0, border: '1px solid #000' }}>
          {/* Logo */}
          <div style={{ height: 72, display:'flex', alignItems:'center', gap:'0.875rem', padding: collapsed ? '0 1.1rem' : '0 1.5rem', borderBottom:'1px solid #000', flexShrink:0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 0, flexShrink: 0,
              background: '#000',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontWeight:900, fontSize:18,
            }}>K</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 900, color:THEME.colors.textPrimary, letterSpacing:'-0.01em', textTransform: 'uppercase', fontFamily: 'monospace' }}>Karibu Credit</div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color:THEME.colors.textMuted, textTransform: 'uppercase', fontFamily: 'monospace' }}>Workspace</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, minHeight:0, overflowY:'auto', padding:'1.5rem 0', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            {sections.map((section, si) => (
              <div key={si}>
                {!collapsed && <p style={{ padding: '0 1.5rem 0.5rem', fontSize: '10px', fontWeight: 700, color: THEME.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace' }}>{section.title}</p>}
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {section.items.map((item) => {
                    const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        title={collapsed ? item.label : undefined}
                        className={`sidebar-item${active ? ' active' : ''}`}
                        style={collapsed ? { justifyContent:'center', padding:'0.625rem', margin: '0.25rem 0.625rem', borderRadius: 0 } : { borderRadius: 0, margin: '0.125rem 1rem' }}
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
          <div style={{ padding:'1rem', borderTop:'1px solid #000', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : undefined, gap: collapsed ? 0 : '0.75rem', padding: collapsed ? '0.5rem 0' : '0.5rem', background: '#f4f4f5', border: '1px solid #000', borderRadius: 0, marginBottom: '0.5rem' }}>
              <div style={{
                width:36, height:36, borderRadius:0, flexShrink:0,
                background: `linear-gradient(135deg, ${roleMeta.color}, #000000)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontWeight:900, fontSize:15,
              }}>
                {(user?.full_name || 'A').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ minWidth:0, flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:THEME.colors.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {user?.full_name || 'Staff Console'}
                  </div>
                  <div style={{ fontSize:'9px', color: THEME.colors.textMuted, fontWeight:600 }}>
                    {roleMeta.label}
                  </div>
                </div>
              )}
            </div>
            
            <button
              ref={logoutBtnRef}
              onClick={handleLogout}
              className="sidebar-item"
              style={{ width:'100%', background:'transparent', border: '1px solid #000', cursor:'pointer', justifyContent: collapsed ? 'center' : undefined, color:'#000', borderRadius: 0, padding: collapsed ? '0.625rem' : '0.5rem 1rem', margin: 0, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}
            >
              <Icon d={ICONS.logout} size={18} />
              {!collapsed && <span style={{ marginLeft: '4px' }}>Sign Out</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* ── CLEAN TOPBAR & MAIN CONTENT ── */}
      <div className="main-content">
        <header className="topbar" style={{ borderBottom: '1px solid #000', gap: '0.75rem' }}>
          {/* Left: hamburger + page title */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexShrink: 0, minWidth: 0 }}>
            <button
              onClick={() => setCollapsed(p => !p)}
              style={{ width:32, height:32, borderRadius:0, background:'#ffffff', border:'1px solid #000', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#000', flexShrink:0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize:'1rem', fontWeight:900, color:THEME.colors.textPrimary, letterSpacing:'-0.02em', textTransform: 'uppercase', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pageName(pathname)}
              </h1>
              <div style={{ fontSize:'9px', color:THEME.colors.textMuted, fontWeight:700, marginTop: 1, textTransform: 'uppercase', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                Workspace
              </div>
            </div>
          </div>

          {/* Center: Search (flexible) */}
          <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 200, display:'flex', alignItems:'center', background:'#ffffff', border:'1px solid #000', borderRadius: 0, padding:'0.35rem 0.75rem' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="SEARCH..."
              value={topSearchValue}
              onChange={(e) => handleTopSearchChange(e.target.value)}
              style={{ border:'none', outline:'none', background:'transparent', fontSize:'9px', fontFamily: 'monospace', textTransform: 'uppercase', marginLeft:'0.4rem', width:'100%', color:THEME.colors.textPrimary }}
            />
          </div>

          {/* Right: actions (never shrink) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', flexShrink: 0 }}>
            <Link
              href="/dashboard/settings"
              title="Account Security & OTP Settings"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                background: '#ffffff', border: '1px solid #000',
                borderRadius: 0, padding: '0.35rem 0.625rem',
                fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase',
                color: '#000', whiteSpace: 'nowrap', textDecoration: 'none', fontWeight: 800
              }}
            >
              <Icon d={ICONS.shield} size={12} />
              <span>ROLE: {user?.role || 'STAFF'}</span>
            </Link>


            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(p => !p)}
                style={{ width:32, height:32, borderRadius:0, background:'#ffffff', border:'1px solid #000', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#000', position:'relative', flexShrink: 0, zIndex: 10 }}
              >
                <Icon d={ICONS.bell} size={16} />
                {notifications.some(n => !n.read) && (
                  <span style={{ position:'absolute', top:6, right:6, width:5, height:5, background:'#000', border:'1px solid #fff', pointerEvents:'none' }} />
                )}
              </button>

              {notificationsOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  width: '320px',
                  background: '#ffffff',
                  border: '2px solid #000',
                  boxShadow: '4px 4px 0px 0px #000',
                  zIndex: 100,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase'
                }}>
                  {/* Dropdown Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #000' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#000' }}>Notifications</span>
                    <button
                      onClick={markAllAsRead}
                      style={{ fontSize: '9px', fontWeight: 700, color: '#000', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Mark all read
                    </button>
                  </div>

                  {/* Dropdown Tabs */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#f4f4f5' }}>
                    {(['all', 'unread', 'read'] as const).map(tab => {
                      const count = tab === 'all' 
                        ? notifications.length 
                        : tab === 'unread' 
                          ? notifications.filter(n => !n.read).length 
                          : notifications.filter(n => n.read).length;
                      const active = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            flex: 1,
                            padding: '0.5rem 0',
                            fontSize: '9px',
                            fontWeight: active ? 900 : 600,
                            color: active ? '#fff' : '#000',
                            background: active ? '#000' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'center',
                            borderRight: tab !== 'read' ? '1px solid #000' : 'none'
                          }}
                        >
                          {tab} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Dropdown List */}
                  <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {filteredNotifications.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '10px', color: '#71717a' }}>
                        No notifications found
                      </div>
                    ) : (
                      filteredNotifications.map(n => (
                        <div
                          key={n.id}
                          style={{
                            padding: '0.75rem',
                            borderBottom: '1px solid #e4e4e7',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            background: n.read ? '#fff' : '#fafafa'
                          }}
                        >
                          <div style={{
                            fontSize: '10px',
                            fontWeight: n.read ? 500 : 800,
                            color: '#000',
                            lineHeight: 1.3
                          }}>
                            {n.text}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '8px', color: '#71717a' }}>{n.time}</span>
                            <button
                              onClick={() => toggleRead(n.id)}
                              style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                background: 'transparent',
                                border: 'none',
                                color: '#000',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              {n.read ? 'Mark Unread' : 'Mark Read'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <Link href="/dashboard/borrowers/new" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', border:'1px solid #000', background:'#fff', color:'#000', padding:'0.4rem 0.75rem', fontSize:'10px', fontWeight:700, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.03em', whiteSpace:'nowrap', flexShrink:0, textDecoration:'none', cursor:'pointer', transition:'background 0.15s' }}>
              + Borrower
            </Link>
            <Link href="/dashboard/loans/new" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', border:'1px solid #000', background:'#000', color:'#ffffff', padding:'0.4rem 0.875rem', fontSize:'10px', fontWeight:700, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'0.03em', whiteSpace:'nowrap', flexShrink:0, textDecoration:'none', cursor:'pointer', transition:'background 0.15s' }}>
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
