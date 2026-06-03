'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

/* ─── Types ─── */
type LoanItem = {
  id: number; user_id: number; customer_id?: number;
  product_type: string; principal_amount: number;
  amount_requested?: number; status: string; created_at: string;
  application_no?: string; outstanding_balance?: number;
  total_paid?: number; penalty_balance?: number; par_days?: number;
  officer_id?: number; branch_id?: number;
  customer?: { full_name: string; phone: string; kyc_status: string; credit_score: number; };
};

type BorrowerItem = {
  id: number; full_name: string; email: string; is_active: boolean;
  phone_number?: string; role?: string;
  customer_profile?: { kyc_status: string; credit_score: number; max_loan_limit: number; };
};

type TransactionItem = {
  id: number; loan_id: number; type: string;
  amount: number; reference_code: string; created_at: string;
};

type CollateralItem = {
  id: string; loan_id: number; borrower: string;
  type: string; value: number; status: string; details: string;
};

/* ─── Shared Design Sub-components ─── */

/** KPI metric card with SVG icon */
function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'violet';
}) {
  const colors: Record<string, { bg: string; text: string; card: string }> = {
    blue:   { bg: '#eef2ff', text: '#4f46e5', card: '#4f46e5' },
    teal:   { bg: '#f0fdfa', text: '#0d9488', card: '#0d9488' },
    green:  { bg: '#ecfdf5', text: '#10b981', card: '#10b981' },
    amber:  { bg: '#fffbeb', text: '#f59e0b', card: '#f59e0b' },
    red:    { bg: '#fef2f2', text: '#ef4444', card: '#ef4444' },
    violet: { bg: '#f5f3ff', text: '#8b5cf6', card: '#8b5cf6' },
  };
  const c = colors[color];
  return (
    <div className="stat-card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: c.card }} />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.75rem' }}>
        <div style={{ flex:1, minWidth:0, paddingLeft: '0.25rem' }}>
          <div style={{ fontSize:'0.8125rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', marginBottom:'0.75rem' }}>
            {label}
          </div>
          <div style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--text-primary)', lineHeight:1.2, letterSpacing:'-0.02em' }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.35rem', fontWeight:500 }}>
              {sub}
            </div>
          )}
        </div>
        <div style={{ width:40, height:40, borderRadius:8, background: c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: c.text }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/** Section panel (card with header) */
function Panel({ title, subtitle, action, children }: {
  title: string; subtitle?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.5rem', borderBottom:'1px solid var(--border)', gap:'1rem', background: '#fff' }}>
        <div>
          <div style={{ fontSize:'1.125rem', fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <div style={{ width:4, height:18, background:'var(--brand)', borderRadius:4 }} />
            {title}
          </div>
          {subtitle && <div style={{ fontSize:'0.8125rem', color:'var(--text-muted)', marginTop:4, marginLeft:'0.75rem' }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding:'1.5rem' }}>{children}</div>
    </div>
  );
}

/** Status badge */
function Badge({ label, type }: { label: string; type: 'success'|'warning'|'danger'|'info'|'neutral'|'brand' }) {
  return <span className={`badge badge-${type}`}>{label}</span>;
}

/** Thin progress bar */
function ProgressBar({ value, color = '#2563eb', bg = '#e2e8f0' }: { value: number; color?: string; bg?: string }) {
  return (
    <div style={{ height:6, borderRadius:99, background: bg, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(value, 100)}%`, background: color, borderRadius:99, transition:'width 0.6s ease' }} />
    </div>
  );
}

/** Alert/Notice banner */
function AlertBanner({ icon, title, body, type = 'info' }: {
  icon: React.ReactNode; title: string; body: string; type?: 'info'|'warning'|'success'|'danger';
}) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#3b82f6' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
    danger:  { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  };
  const c = colors[type];
  return (
    <div style={{ background: c.bg, border:`1px solid ${c.border}`, borderRadius:8, padding:'0.875rem 1.25rem', display:'flex', alignItems:'center', gap:'0.875rem' }}>
      <span style={{ flexShrink:0, color: c.text, display:'flex' }}>{icon}</span>
      <div style={{ flex:1, fontSize:'0.8125rem' }}>
        <span style={{ fontWeight:600, color: c.text }}>{title} </span>
        <span style={{ color:'var(--text-secondary)' }}>{body}</span>
      </div>
    </div>
  );
}

/** Shared table wrapper */
function DataTable({ headers, children, empty }: {
  headers: string[]; children: React.ReactNode; empty?: string;
}) {
  return (
    <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid var(--border)' }}>
      <table className="data-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ─── Chart defaults ─── */
const CHART_OPTS_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#475569', font: { size: 11, family: 'Inter' }, boxWidth: 12 } },
    tooltip: { bodyFont: { family: 'Inter', size: 12 }, titleFont: { family: 'Inter', size: 12 } },
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#e2e8f0' } },
    y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: '#e2e8f0' } },
  },
};


/* ─────────────────────────────────────────────────────────────────────────────
   ROOT DASHBOARD PAGE
   ───────────────────────────────────────────────────────────────────────────── */
export default function DashboardOverview() {
  const [activeRole, setActiveRole] = useState<string>('loan_officer');
  const [loans,        setLoans]        = useState<LoanItem[]>([]);
  const [borrowers,    setBorrowers]    = useState<BorrowerItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [collateral,   setCollateral]   = useState<CollateralItem[]>([]);
  const [stats,        setStats]        = useState<any>({});
  const [loading,      setLoading]      = useState<boolean>(true);

  useEffect(() => {
    const sync = () => {
      const r = localStorage.getItem('preview_role');
      if (r) setActiveRole(r);
    };
    sync();
    window.addEventListener('preview-role-changed', sync);
    return () => window.removeEventListener('preview-role-changed', sync);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [s, l, b, t, c] = await Promise.allSettled([
          fetchApi('/loans/stats'),
          fetchApi('/loans/'),
          fetchApi('/users/'),
          fetchApi('/loans/transactions'),
          fetchApi('/loans/collateral'),
        ]);
        if (s.status === 'fulfilled') setStats(s.value);
        if (l.status === 'fulfilled') setLoans(l.value);
        if (b.status === 'fulfilled') setBorrowers(b.value);
        if (t.status === 'fulfilled') setTransactions(t.value);
        if (c.status === 'fulfilled') setCollateral(c.value);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', color:'var(--text-muted)', fontSize:'0.875rem', padding:'2rem' }}>
        <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid var(--brand)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        Loading dashboard data…
      </div>
    );
  }

  switch (activeRole) {
    case 'super_admin':
    case 'admin':
      return <CeoDashboard stats={stats} loans={loans} borrowers={borrowers} />;
    case 'finance':
      return <CfoDashboard stats={stats} transactions={transactions} />;
    case 'branch_manager':
      return <BranchManagerDashboard loans={loans} borrowers={borrowers} />;
    case 'loan_officer':
      return <LoanOfficerDashboard loans={loans} borrowers={borrowers} />;
    case 'collections':
      return <CollectionsOfficerDashboard loans={loans} />;
    case 'compliance':
      return <ComplianceOfficerDashboard loans={loans} borrowers={borrowers} transactions={transactions} />;
    case 'credit_engine':
      return <CreditScoreDashboard loans={loans} borrowers={borrowers} />;
    default:
      return <LoanOfficerDashboard loans={loans} borrowers={borrowers} />;
  }
}


/* ─────────────────────────────────────────────────────────────────────────────
   1. CEO / MANAGING DIRECTOR DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function CeoDashboard({ stats, loans, borrowers }: { stats: any; loans: LoanItem[]; borrowers: BorrowerItem[] }) {
  const [plLines] = useState([
    { line: 'Interest Income',        budget: 15000000, actual: 16200000, variance: 8.0,  category: 'income' },
    { line: 'Processing Fees',        budget: 3500000,  actual: 3820000,  variance: 9.1,  category: 'income' },
    { line: 'Late Payment Fines',     budget: 1200000,  actual: 1980000,  variance: 65.0, category: 'income' },
    { line: 'Operational Staff Cost', budget: 4500000,  actual: 4400000,  variance: -2.2, category: 'expense' },
    { line: 'Marketing & Onboarding', budget: 2000000,  actual: 2350000,  variance: 17.5, category: 'expense' },
    { line: 'Infrastructure & SMS',   budget: 800000,   actual: 1100000,  variance: 37.5, category: 'expense' },
  ]);

  const [branches] = useState([
    { name: 'Nairobi HQ',          manager: 'M. Muthami', portfolio: 24500000, activeCount: 142, PAR30: 2.1, collectionRate: 98.2 },
    { name: 'Mombasa Road Branch', manager: 'S. Kiprop',  portfolio: 18200000, activeCount: 96,  PAR30: 4.8, collectionRate: 94.6 },
    { name: 'Kisumu Hub',          manager: 'A. Ochieng', portfolio: 12100000, activeCount: 68,  PAR30: 7.2, collectionRate: 91.2 },
    { name: 'Nakuru Town Office',  manager: 'J. Mwangi',  portfolio: 9400000,  activeCount: 52,  PAR30: 9.6, collectionRate: 86.8 },
  ]);

  const barData = {
    labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      { label: 'Disbursements', data: [12.4, 15.1, 18.2, 14.8, 21.3, 26.0], backgroundColor: '#6366f1', borderRadius: 6 },
      { label: 'Collections',   data: [8.5,  11.2, 13.6, 12.1, 16.5, 22.4], backgroundColor: '#10b981', borderRadius: 6 },
    ],
  };

  const doughnutData = {
    labels: ['Logbook Loans', 'SME Capital', 'Agribusiness', 'Personal'],
    datasets: [{ data: [45, 30, 15, 10], backgroundColor: ['#6366f1','#10b981','#0ea5e9','#f59e0b'], borderWidth: 0, hoverOffset: 6 }],
  };

  function varColor(cat: string, v: number) {
    if (cat === 'income') return '#059669';
    if (v > 20) return '#dc2626';
    if (v > 10) return '#d97706';
    return '#059669';
  }

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
        type="info"
        title="Executive Briefing:"
        body="Total Loan Book grew +22.4% MoM. Branch audit compliance completed. PAR 30 is within policy threshold."
      />

      {/* KPIs Row 1 */}
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard color="blue"   label="Total Loan Portfolio"   value={`KES ${(stats.total_outstanding_value || 64200000).toLocaleString()}`} sub="+12.4% MoM"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>} />
        <KpiCard color="green"  label="Monthly Revenue (MTD)"  value={`KES ${(stats.total_repaid || 22400000).toLocaleString()}`} sub="+8.6% of target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard color="teal"   label="Net Profit Margin"      value="24.8%" sub="Within target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
        <KpiCard color="violet" label="Active Customers"       value={borrowers.length || 358} sub="+18 this week"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
      </div>

      {/* KPIs Row 2 */}
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard color="teal"  label="Disbursements Today" value="KES 2,450,000" sub="100% Daraja SLA"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>} />
        <KpiCard color="amber" label="PAR 30 Rate"         value="4.82%" sub="Safe (< 5.0%)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        <KpiCard color="red"   label="NPL Rate (PAR 90+)"  value="1.84%" sub="Safe (< 3.0%)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        <KpiCard color="green"  label="Collection Rate"    value="94.6%" sub="Target: 95.0%"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
        <Panel title="Disbursements vs Collections" subtitle="KES Millions — last 6 months">
          <div style={{ height:260 }}>
            <Bar data={barData} options={CHART_OPTS_BASE as any} />
          </div>
        </Panel>
        <Panel title="Portfolio by Product Mix">
          <div style={{ height:260, display:'flex', justifyContent:'center' }}>
            <Doughnut
              data={doughnutData}
              options={{ ...CHART_OPTS_BASE, plugins: { ...CHART_OPTS_BASE.plugins }, scales: undefined } as any}
            />
          </div>
        </Panel>
      </div>

      {/* Branch Health & P&L */}
      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'1fr 1fr' }}>
        <Panel title="Branch Portfolio Health" subtitle="Real-time performance">
          <DataTable headers={['Branch Office', 'Portfolio Size', 'PAR 30', 'Collection Rate']}>
            {branches.map((b, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{b.name}</div>
                  <div style={{ fontSize:'0.6875rem', color:'var(--text-muted)' }}>Mgr: {b.manager}</div>
                </td>
                <td style={{ fontWeight:600 }}>KES {b.portfolio.toLocaleString()}</td>
                <td>
                  <Badge
                    label={`${b.PAR30}%`}
                    type={b.PAR30 > 8 ? 'danger' : b.PAR30 > 5 ? 'warning' : 'success'}
                  />
                </td>
                <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{b.collectionRate}%</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="P&L Budget vs Actual (MTD)" subtitle="Operating performance">
          <DataTable headers={['Account Line', 'Budget', 'Actual', 'Variance']}>
            {plLines.map((pl, i) => (
              <tr key={i}>
                <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{pl.line}</td>
                <td>KES {pl.budget.toLocaleString()}</td>
                <td style={{ fontWeight:600 }}>KES {pl.actual.toLocaleString()}</td>
                <td>
                  <span style={{ fontWeight:700, color: varColor(pl.category, pl.variance) }}>
                    {pl.variance > 0 ? '+' : ''}{pl.variance}%
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   2. CFO / FINANCE DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function CfoDashboard({ stats, transactions }: { stats: any; transactions: TransactionItem[] }) {
  const [reconciliations] = useState([
    { source: 'B2C Disbursed Sent',       count: 182,  amount: 9840000,  status: 'MATCHED' },
    { source: 'B2C Confirmed Callback',   count: 180,  amount: 9740000,  status: 'MATCHED' },
    { source: 'B2C Pending Callback',     count: 2,    amount: 100000,   status: 'PENDING' },
    { source: 'C2B Paybill 420537 MTD',   count: 1420, amount: 22400000, status: 'MATCHED' },
  ]);

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>}
        type="success"
        title="Daraja Status:"
        body="Connected & stable. 99.8% reconciliation SLA maintained over 24 hours."
      />

      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard color="green"  label="Interest Income MTD"    value="KES 14,820,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
        <KpiCard color="teal"   label="Processing Fees MTD"    value="KES 3,250,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
        <KpiCard color="blue"   label="Insurance Commission"   value="KES 840,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
        <KpiCard color="amber"  label="Operating Expenses"     value="KES 4,120,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard color="green"  label="Gross Profit MTD"       value="KES 18,910,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard color="red"    label="Total Provision Reserve" value={`KES ${(stats.total_defaulted_value || 8450000).toLocaleString()}`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
      </div>

      <Panel
        title="Daraja B2C / C2B Settlement Audit"
        subtitle="Auto-updated every 30 seconds"
        action={
          <span style={{ fontSize:'0.75rem', color:'var(--success)', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} />
            Live
          </span>
        }
      >
        <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
          <DataTable headers={['Transaction Pool', 'Tx Count', 'Total Value', 'SLA Status']}>
            {reconciliations.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{r.source}</td>
                <td style={{ fontWeight:700 }}>{r.count}</td>
                <td style={{ fontWeight:700 }}>KES {r.amount.toLocaleString()}</td>
                <td><Badge label={r.status} type={r.status === 'PENDING' ? 'warning' : 'success'} /></td>
              </tr>
            ))}
          </DataTable>

          <div style={{ background:'var(--warning-light)', border:'1px solid #fde68a', borderRadius:12, padding:'1rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--warning)' }}>2 Settlement Discrepancies</div>
            <p style={{ fontSize:'0.75rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
              Two KCB API transactions did not return callbacks within the 30-min SLA. Automated recovery cron initiated.
            </p>
            <div style={{ fontSize:'0.6875rem', fontFamily:'monospace', background:'white', borderRadius:8, padding:'0.625rem', color:'var(--text-secondary)' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span>KCB-781A8X</span><strong>KES 50,000</strong></div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span>KCB-902Y1T</span><strong>KES 50,000</strong></div>
            </div>
            <button className="btn btn-success" style={{ fontSize:'0.75rem', marginTop:'auto' }}>
              Re-Trigger Reconciliation
            </button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Recent Ledger Transactions"
        action={<button className="btn btn-secondary" style={{ fontSize:'0.75rem' }}>Export Report →</button>}
      >
        <DataTable headers={['Tx Ref ID', 'Loan', 'Type', 'Amount', 'Date']}>
          {transactions.slice(0, 8).map(tx => (
            <tr key={tx.id}>
              <td style={{ fontWeight:700, fontFamily:'monospace', color:'var(--brand)' }}>{tx.reference_code || `TXN-00${tx.id}`}</td>
              <td>#{tx.loan_id}</td>
              <td>
                <Badge
                  label={tx.type.toUpperCase()}
                  type={tx.type === 'repayment' ? 'success' : tx.type === 'disbursement' ? 'brand' : 'info'}
                />
              </td>
              <td style={{ fontWeight:700, color:'var(--text-primary)' }}>KES {tx.amount.toLocaleString()}</td>
              <td>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   3. BRANCH MANAGER DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function BranchManagerDashboard({ loans, borrowers }: { loans: LoanItem[]; borrowers: BorrowerItem[] }) {
  const [officers] = useState([
    { name: 'David Kipkorir', assigned: 48, approved: 35, tat: 14.5, collectionRate: 97.4, PAR30: 2.4 },
    { name: 'Sarah Wambui',   assigned: 42, approved: 30, tat: 16.2, collectionRate: 95.8, PAR30: 3.1 },
    { name: 'Mark Omwansa',   assigned: 35, approved: 22, tat: 21.0, collectionRate: 91.8, PAR30: 6.8 },
    { name: 'Grace Mutheu',   assigned: 28, approved: 18, tat: 25.5, collectionRate: 86.4, PAR30: 9.2 },
  ]);

  const highValueLoans = loans.filter(l => l.principal_amount >= 500000 && l.status === 'pending');

  const handleApprove = async (id: number) => {
    try {
      await fetchApi(`/loans/${id}/approve`, { method: 'POST' });
      alert(`Loan #${id} approved and disbursed.`);
      window.location.reload();
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const parData = [
    { label: 'PAR 1–7 Days',   pct: 65, count: 22, color: '#10b981' },
    { label: 'PAR 8–30 Days',  pct: 22, count: 8,  color: '#f59e0b' },
    { label: 'PAR 31–90 Days', pct: 10, count: 3,  color: '#ef4444' },
    { label: 'PAR 90+ Days',   pct: 3,  count: 1,  color: '#991b1b' },
  ];

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard color="blue"  label="Branch Active Loans"  value={loans.length || 142} sub="As of today"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>} />
        <KpiCard color="teal"  label="Branch Book Value"    value="KES 24,500,000" sub="+5.2% MoM"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard color="green" label="Branch PAR 30 Rate"   value="3.82%" sub="Within target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
        <KpiCard color="amber" label="Manager Escalations"  value="3 Pending" sub="Awaiting review"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>} />
      </div>

      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
        <Panel title="Branch Officer Performance Board" subtitle="TAT and collection rates per officer">
          <DataTable headers={['Loan Officer', 'Apps Assigned', 'Avg TAT', 'PAR 30']}>
            {officers.map((o, i) => (
              <tr key={i}>
                <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{o.name}</td>
                <td>{o.assigned} apps</td>
                <td style={{ fontWeight:600, color: o.tat > 24 ? 'var(--danger)' : o.tat > 20 ? 'var(--warning)' : 'var(--text-primary)' }}>
                  {o.tat} hrs
                </td>
                <td>
                  <Badge label={`${o.PAR30}%`} type={o.PAR30 > 8 ? 'danger' : o.PAR30 > 5 ? 'warning' : 'success'} />
                </td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="Arrears (PAR) Breakdown" subtitle="Accounts currently in arrears">
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {parData.map((p, i) => (
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', fontWeight:500, color:'var(--text-secondary)', marginBottom:6 }}>
                  <span>{p.label}</span>
                  <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{p.count} ({p.pct}%)</span>
                </div>
                <ProgressBar value={p.pct} color={p.color} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="High-Value Approval Queue" subtitle="Applications ≥ KES 500,000 escalated to branch manager">
        {highValueLoans.length === 0 ? (
          <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>
            No high-value applications pending branch manager approval.
          </div>
        ) : (
          <DataTable headers={['Reference', 'Borrower', 'Product', 'Amount', 'Action']}>
            {highValueLoans.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight:700, color:'var(--brand)', fontFamily:'monospace' }}>{l.application_no || `LAF-${l.id}`}</td>
                <td>User #{l.user_id}</td>
                <td style={{ textTransform:'capitalize' }}>{l.product_type}</td>
                <td style={{ fontWeight:700, color:'var(--text-primary)' }}>KES {l.principal_amount.toLocaleString()}</td>
                <td>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <button className="btn btn-success" style={{ fontSize:'0.6875rem', padding:'0.35rem 0.75rem' }} onClick={() => handleApprove(l.id)}>
                      Approve & Disburse
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize:'0.6875rem', padding:'0.35rem 0.75rem' }} onClick={() => alert('Appraisal requested')}>
                      Audit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   4. LOAN OFFICER DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function LoanOfficerDashboard({ loans, borrowers }: { loans: LoanItem[]; borrowers: BorrowerItem[] }) {
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [checklist, setChecklist] = useState({
    idVerified: false, kraPINVerified: false,
    crbStatusGood: false, payslipVerified: false, guarantorAppraisal: false,
  });

  const pendingQueue = loans.filter(l => l.status === 'pending');
  const isComplete   = Object.values(checklist).every(Boolean);

  const toggleItem = (k: string) => setChecklist(p => ({ ...p, [k]: !p[k as keyof typeof p] }));

  const handleApprove = async () => {
    if (!selectedLoan) return;
    try { await fetchApi(`/loans/${selectedLoan.id}/approve`, { method:'POST' }); alert('Approved!'); window.location.reload(); }
    catch (e: any) { alert(e.message); }
  };
  const handleReject = async () => {
    if (!selectedLoan) return;
    try { await fetchApi(`/loans/${selectedLoan.id}/reject`, { method:'POST' }); alert('Rejected.'); window.location.reload(); }
    catch (e: any) { alert(e.message); }
  };

  const CHECKLIST_ITEMS = [
    { key:'idVerified',        label:'IPRS National ID Verified' },
    { key:'kraPINVerified',    label:'KRA Tax PIN validated' },
    { key:'crbStatusGood',     label:'TransUnion CRB clearance attached' },
    { key:'payslipVerified',   label:'Payslip & Bank Statements confirmed' },
    { key:'guarantorAppraisal',label:'Borrower interview note logged' },
  ];

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard color="blue"  label="My Queue Today"      value={`${pendingQueue.length} apps`} sub="Pending review"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} />
        <KpiCard color="green" label="Approval Rate (MTD)" value="78.2%" sub="Above target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard color="amber" label="Avg Review TAT"      value="16.4 hrs" sub="SLA: 24h max"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <KpiCard color="teal"  label="Collection Rate"     value="96.8%" sub="Origination"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>} />
      </div>

      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
        {/* Queue */}
        <Panel title="Application Queue" subtitle="Click a row to start appraisal · 24h SLA">
          {pendingQueue.length === 0 ? (
            <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>
              Your application queue is empty — great work!
            </div>
          ) : (
            <DataTable headers={['Reference', 'Borrower', 'Product', 'Amount', '']}>
              {pendingQueue.map(l => (
                <tr
                  key={l.id}
                  onClick={() => { setSelectedLoan(l); setChecklist({ idVerified:false, kraPINVerified:false, crbStatusGood:false, payslipVerified:false, guarantorAppraisal:false }); }}
                  style={{ cursor:'pointer', background: selectedLoan?.id === l.id ? 'var(--brand-light)' : undefined }}
                >
                  <td style={{ fontWeight:700, fontFamily:'monospace', color:'var(--brand)' }}>{l.application_no || `LAF-${l.id}`}</td>
                  <td>User #{l.user_id}</td>
                  <td style={{ textTransform:'capitalize' }}>{l.product_type}</td>
                  <td style={{ fontWeight:700, color:'var(--text-primary)' }}>KES {l.principal_amount.toLocaleString()}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ fontSize:'0.6875rem', padding:'0.25rem 0.625rem' }}>
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        {/* Appraisal panel */}
        <div className="card" style={{ padding:'1.5rem', display:'flex', flexDirection:'column', minHeight:440 }}>
          {selectedLoan ? (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div style={{ fontSize:'0.875rem', fontWeight:700, color:'var(--text-primary)' }}>Appraise Applicant</div>
                <span className="badge badge-brand">{selectedLoan.application_no || `LAF-${selectedLoan.id}`}</span>
              </div>

              {/* Score summary */}
              <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, padding:'0.875rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:6 }}>
                  <span style={{ color:'var(--text-muted)', fontWeight:600 }}>Credit Score</span>
                  <span style={{ fontWeight:700, color:'var(--success)' }}>710 / 1000 — GOOD</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', paddingTop:6, borderTop:'1px solid var(--border)' }}>
                  <span style={{ color:'var(--text-muted)', fontWeight:600 }}>Recommended Limit</span>
                  <span style={{ fontWeight:700, color:'var(--text-primary)' }}>KES 500,000</span>
                </div>
              </div>

              {/* Checklist */}
              <div style={{ marginBottom:'1rem' }}>
                <div style={{ fontSize:'0.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:'0.5rem' }}>
                  Mandatory Appraisal Steps
                </div>
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.4rem 0', cursor:'pointer', fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={checklist[item.key as keyof typeof checklist]}
                      onChange={() => toggleItem(item.key)}
                      style={{ accentColor:'var(--brand)', width:15, height:15 }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <button
                  className="btn btn-success"
                  disabled={!isComplete}
                  onClick={handleApprove}
                  style={{ fontSize:'0.8125rem', padding:'0.625rem' }}
                >
                  {isComplete ? 'Approve & Release Funds' : 'Complete checklist to enable'}
                </button>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button className="btn btn-danger" onClick={handleReject} style={{ flex:1, fontSize:'0.75rem' }}>Reject</button>
                  <button className="btn btn-secondary" onClick={() => alert('Escalated to Branch Manager.')} style={{ flex:1, fontSize:'0.75rem' }}>Escalate</button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', textAlign:'center', gap:'0.75rem' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <div style={{ fontSize:'0.8125rem' }}>Select an application to begin verification and appraisal</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   5. COLLECTIONS OFFICER DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function CollectionsOfficerDashboard({ loans }: { loans: LoanItem[] }) {
  const [selectedCase, setSelectedCase] = useState<LoanItem | null>(null);
  const [restructureOpen, setRestructureOpen] = useState(false);
  const [tenure, setTenure] = useState('3');

  const arrearsQueue = loans.filter(l => ['defaulted','active'].includes(l.status.toLowerCase()));

  const getAdvice = (days: number) => {
    if (days <= 7)  return 'Automated soft SMS reminders';
    if (days <= 30) return 'Officer call required — log promise';
    if (days <= 90) return 'Field visit & demand letters';
    return 'CRB blacklist & legal action';
  };

  const handleRestructure = () => {
    alert(`Restructure proposal submitted for Loan #${selectedCase?.id}: +${tenure} months extension. Awaiting manager approval.`);
    setRestructureOpen(false);
  };

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard color="red"   label="My Arrears Cases"       value={`${arrearsQueue.length} active`} sub="Require follow-up"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        <KpiCard color="teal"  label="Recovery Target (MTD)" value="KES 8,450,000" sub="78% collected"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard color="blue"  label="Restructured Accounts" value="12 borrowers" sub="This month"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>} />
        <KpiCard color="amber" label="CRB Submissions Today" value="2 negative" sub="Listings filed"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />
      </div>

      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
        {/* Arrears queue */}
        <Panel title="Arrears Recovery Queue" subtitle="Sorted by delinquency severity">
          {arrearsQueue.length === 0 ? (
            <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>
              No accounts currently in delinquency status.
            </div>
          ) : (
            <DataTable headers={['Reference', 'Days Overdue', 'Outstanding', 'Fine Accrued', 'Recommended Action']}>
              {arrearsQueue.map(c => {
                const days = c.status === 'defaulted' ? 95 : 12;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    style={{ cursor:'pointer', background: selectedCase?.id === c.id ? '#fff1f2' : undefined }}
                  >
                    <td style={{ fontWeight:700, fontFamily:'monospace', color:'var(--danger)' }}>{c.application_no || `LAF-${c.id}`}</td>
                    <td>
                      <Badge label={`${days} days`} type={days > 90 ? 'danger' : 'warning'} />
                    </td>
                    <td style={{ fontWeight:600 }}>KES {(c.outstanding_balance || 150000).toLocaleString()}</td>
                    <td style={{ color:'var(--danger)', fontWeight:600 }}>KES {(c.penalty_balance || 15000).toLocaleString()}</td>
                    <td style={{ fontSize:'0.6875rem', color:'var(--text-muted)' }}>{getAdvice(days)}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Panel>

        {/* Case actions */}
        <div className="card" style={{ padding:'1.5rem', display:'flex', flexDirection:'column', minHeight:440 }}>
          {selectedCase ? (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div style={{ fontSize:'0.875rem', fontWeight:700 }}>Manage Recovery</div>
                <span className="badge badge-danger">{selectedCase.application_no || `LAF-${selectedCase.id}`}</span>
              </div>
              <div style={{ background:'var(--danger-light)', border:'1px solid var(--danger-border)', borderRadius:8, padding:'0.875rem', marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', marginBottom:6 }}>
                  <span style={{ color:'var(--danger)', fontWeight:600 }}>Total Overdue</span>
                  <span style={{ fontWeight:700 }}>KES {((selectedCase.outstanding_balance || 150000) + (selectedCase.penalty_balance || 15000)).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem' }}>
                  <span style={{ color:'var(--danger)', fontWeight:600 }}>Phone Contact</span>
                  <span style={{ fontWeight:600, color:'var(--brand-mid)' }}>+254 700 000 000</span>
                </div>
              </div>

              {/* SMS history */}
              <div style={{ fontSize:'0.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:'0.5rem' }}>
                SMS History
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:'1rem', maxHeight:140, overflowY:'auto' }}>
                {[
                  { days:'7 days ago', msg:'Your payment of KES 15,200 is 5 days past due. Late penalty applied.' },
                  { days:'30 days ago', msg:'CRB Pre-listing Warning: Pay within 7 days to avoid negative listing.' },
                ].map((s, i) => (
                  <div key={i} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8, padding:'0.5rem 0.625rem', fontSize:'0.6875rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span style={{ color:'var(--text-muted)' }}>{s.days}</span>
                      <span style={{ color:'var(--success)', fontWeight:600 }}>Delivered</span>
                    </div>
                    <p style={{ color:'var(--text-secondary)' }}>"{s.msg}"</p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <button className="btn btn-primary" style={{ background:'var(--warning)', boxShadow:'none', fontSize:'0.8125rem', padding:'0.625rem' }} onClick={() => setRestructureOpen(true)}>
                  Propose Loan Restructuring
                </button>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button className="btn btn-danger" style={{ flex:1, fontSize:'0.75rem' }} onClick={() => alert('CRB Negative Listing registered.')}>
                    CRB Negative Listing
                  </button>
                  <button className="btn btn-secondary" style={{ flex:1, fontSize:'0.75rem' }} onClick={() => alert('Promise-to-pay logged.')}>
                    Log Promise
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', textAlign:'center', gap:'0.75rem' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ fontSize:'0.8125rem' }}>Select a delinquent account to manage recovery actions</div>
            </div>
          )}
        </div>
      </div>

      {/* Restructure modal */}
      {restructureOpen && selectedCase && (
        <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0, 0, 0, 0.4)', backdropFilter:'blur(4px)', padding:'1rem' }}>
          <div className="card" style={{ width:'100%', maxWidth:440, padding:'1.75rem' }}>
            <h3 style={{ fontSize:'1.0625rem', fontWeight:700, marginBottom:4 }}>Propose Restructuring Plan</h3>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'1.25rem' }}>
              Loan: {selectedCase.application_no || `LAF-${selectedCase.id}`}
            </p>
            <div style={{ marginBottom:'1rem' }}>
              <label className="form-label">Tenure Extension</label>
              <select value={tenure} onChange={e => setTenure(e.target.value)} className="form-input">
                <option value="3">Extend by +3 Months</option>
                <option value="6">Extend by +6 Months</option>
                <option value="9">Extend by +9 Months</option>
                <option value="12">Extend by +12 Months</option>
              </select>
            </div>
            <div style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:10, padding:'0.875rem', marginBottom:'1.25rem', fontSize:'0.8125rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--text-muted)' }}>New Instalment</span>
                <strong style={{ color:'var(--success)' }}>KES 12,450 / mo</strong>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--text-muted)' }}>Previous Instalment</span>
                <strong>KES 18,200 / mo</strong>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.75rem' }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleRestructure}>Forward to Manager</button>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setRestructureOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   6. COMPLIANCE OFFICER DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function ComplianceOfficerDashboard({ loans, borrowers, transactions }: { loans: LoanItem[]; borrowers: BorrowerItem[]; transactions: TransactionItem[] }) {
  const [cbkReports] = useState([
    { name: 'Monthly Loan Returns',         due: 'May 31, 2026', autoDraft: 'Completed',          penalty: 'CBK notice + fine',       status: 'DRAFT' },
    { name: 'NPL & Credit Loss Provisions', due: 'May 31, 2026', autoDraft: 'Completed',          penalty: 'CBK notice',              status: 'DRAFT' },
    { name: 'Consumer Complaints Log',      due: 'Jun 30, 2026', autoDraft: 'In Progress',        penalty: 'CBK notice',              status: 'PENDING' },
    { name: 'Quarterly Prudential Returns', due: 'Jun 30, 2026', autoDraft: 'Manual Seeded',      penalty: 'Licence review risk',     status: 'PENDING' },
    { name: 'Annual AML Board Compliance',  due: 'Dec 31, 2026', autoDraft: 'Partially Complete', penalty: 'Serious regulatory action', status: 'PENDING' },
  ]);

  const kycQueue       = borrowers.filter(b => b.customer_profile?.kyc_status === 'PENDING');
  const amlTransactions = transactions.filter(t => t.amount >= 300000);

  const handleVerifyKyc = (id: number) => {
    alert(`KYC validation completed for user #${id}.`);
    window.location.reload();
  };

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        type="warning"
        title="Compliance Alert:"
        body="CBK Monthly Returns draft is ready. 3 days remaining to file without penalty."
      />

      <Panel
        title="CBK Regulatory Report Tracker"
        subtitle="NDTCP Regulations 2025 — filing obligations"
      >
        <DataTable headers={['CBK Filing', 'Due Date', 'Auto-Draft Status', 'Late Penalty', 'Action']}>
          {cbkReports.map((rpt, i) => (
            <tr key={i}>
              <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{rpt.name}</td>
              <td>{rpt.due}</td>
              <td><Badge label={rpt.autoDraft} type={rpt.autoDraft === 'Completed' ? 'success' : rpt.autoDraft === 'In Progress' ? 'warning' : 'neutral'} /></td>
              <td style={{ fontSize:'0.6875rem', color:'var(--danger)' }}>{rpt.penalty}</td>
              <td>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-primary" style={{ fontSize:'0.6875rem', padding:'0.25rem 0.625rem' }} onClick={() => alert(`${rpt.name} PDF generated.`)}>
                    Export PDF
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize:'0.6875rem', padding:'0.25rem 0.625rem' }} onClick={() => alert(`${rpt.name} CSV exported.`)}>
                    CSV
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'1fr 1fr' }}>
        <Panel title="AML Transaction Flags" subtitle="Transactions ≥ KES 300,000 requiring review">
          {amlTransactions.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>
              No transactions currently flagged under AML guidelines.
            </div>
          ) : (
            <DataTable headers={['Tx Code', 'Type', 'Amount', 'Action']}>
              {amlTransactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontWeight:700, fontFamily:'monospace' }}>{tx.reference_code || `TX-${tx.id}`}</td>
                  <td style={{ textTransform:'capitalize' }}>{tx.type}</td>
                  <td style={{ fontWeight:700, color:'var(--danger)' }}>KES {tx.amount.toLocaleString()}</td>
                  <td>
                    <button className="btn btn-success" style={{ fontSize:'0.6875rem', padding:'0.25rem 0.625rem' }} onClick={() => alert('Flag cleared.')}>
                      Clear Flag
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title="KYC Verification Queue" subtitle="48-hour SLA for onboarding">
          {kycQueue.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)', fontSize:'0.8125rem' }}>
              All accounts have been fully KYC-verified.
            </div>
          ) : (
            <DataTable headers={['Full Name', 'Email', 'Phone', 'Verify']}>
              {kycQueue.map(kyc => (
                <tr key={kyc.id}>
                  <td style={{ fontWeight:600, color:'var(--text-primary)' }}>{kyc.full_name}</td>
                  <td style={{ color:'var(--text-muted)' }}>{kyc.email}</td>
                  <td>{kyc.phone_number || '+254 700 000 000'}</td>
                  <td>
                    <button className="btn btn-primary" style={{ fontSize:'0.6875rem', padding:'0.25rem 0.625rem', background:'var(--info)' }} onClick={() => handleVerifyKyc(kyc.id)}>
                      Verify
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
   7. CREDIT SCORING ENGINE DASHBOARD
   ───────────────────────────────────────────────────────────────────────────── */
function CreditScoreDashboard({ loans, borrowers }: { loans: LoanItem[]; borrowers: BorrowerItem[] }) {
  const [weights, setWeights] = useState({
    repaymentHistory: 40, accountAge: 20, loanUtilisation: 20, crbScore: 20,
  });

  const totalWeight = weights.repaymentHistory + weights.accountAge + weights.loanUtilisation + weights.crbScore;

  const handleApply = () => {
    if (totalWeight !== 100) { alert(`Weights must sum to 100%. Current: ${totalWeight}%`); return; }
    alert('Weights updated. Nightly re-score triggered.');
  };

  const histData = {
    labels: ['200–300', '300–499', '500–649', '650–799', '800–1000'],
    datasets: [{
      label: 'Borrower Count',
      data: [12, 45, 92, 148, 61],
      backgroundColor: ['#ef4444','#f59e0b','#0ea5e9','#6366f1','#10b981'],
      borderRadius: 6,
    }],
  };

  const ELIGIBILITY = [
    { tier:'Excellent', range:'800–1000', status:'All products, no restrictions',         limit:'KES 1,000,000', color:'var(--success)' },
    { tier:'Good',      range:'650–799',  status:'All products, standard terms',          limit:'KES 500,000',   color:'var(--success)' },
    { tier:'Fair',      range:'500–649',  status:'Most products, collateral required',    limit:'KES 200,000',   color:'var(--warning)' },
    { tier:'Poor',      range:'300–499',  status:'Micro-loans only, 1 guarantor required',limit:'KES 30,000',   color:'var(--danger)'  },
    { tier:'Very Poor', range:'<300',     status:'Auto-rejected at screening',            limit:'KES 0',         color:'var(--danger)'  },
  ];

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
      <div style={{ display:'grid', gap:'1rem', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <KpiCard color="green"  label="Avg Portfolio Score"   value="672 / 1000" sub="GOOD — healthy"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard color="blue"   label="KYC Verification Rate" value="92.4%" sub="Well above target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
        <KpiCard color="red"    label="CRB Listing Rate"      value="4.2%" sub="Monitor closely"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        <KpiCard color="teal"   label="Highest Score"         value="910 / 1000" sub="Top borrower"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />
      </div>

      <div style={{ display:'grid', gap:'1.5rem', gridTemplateColumns:'2fr 1fr' }}>
        <Panel title="Score Distribution Histogram" subtitle="Portfolio credit score spread">
          <div style={{ height:280 }}>
            <Bar data={histData} options={CHART_OPTS_BASE as any} />
          </div>
        </Panel>

        <Panel title="Model Weight Tuning" subtitle="Adjust credit scoring parameters">
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[
              { key:'repaymentHistory', label:'Repayment History', default: 40 },
              { key:'accountAge',       label:'Account History Age', default: 20 },
              { key:'loanUtilisation',  label:'Credit Utilisation', default: 20 },
              { key:'crbScore',         label:'TransUnion CRB Score', default: 20 },
            ].map(item => (
              <div key={item.key}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>
                  <span>{item.label}</span>
                  <span style={{ color:'var(--info)' }}>{weights[item.key as keyof typeof weights]}%</span>
                </div>
                <input
                  type="range" min={5} max={60}
                  value={weights[item.key as keyof typeof weights]}
                  onChange={e => setWeights(p => ({ ...p, [item.key]: Number(e.target.value) }))}
                  style={{ width:'100%', accentColor:'var(--info)' }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop:'1rem', padding:'0.75rem', borderRadius:8, background: totalWeight === 100 ? 'var(--success-light)' : 'var(--danger-light)', display:'flex', justifyContent:'space-between', fontSize:'0.8125rem', fontWeight:700 }}>
            <span>Total:</span>
            <span style={{ color: totalWeight === 100 ? 'var(--success)' : 'var(--danger)' }}>{totalWeight}% / 100%</span>
          </div>

          <button className="btn btn-primary" onClick={handleApply} style={{ width:'100%', marginTop:'0.875rem', background:'var(--info)' }}>
            Commit Weights & Re-Score
          </button>
        </Panel>
      </div>

      <Panel title="Credit Score Tier Eligibility Matrix" subtitle="Automated product eligibility by score band">
        <DataTable headers={['Tier', 'Score Range', 'Eligibility', 'Credit Ceiling']}>
          {ELIGIBILITY.map((row, i) => (
            <tr key={i}>
              <td><span style={{ fontWeight:700, color: row.color }}>{row.tier}</span></td>
              <td style={{ fontFamily:'monospace', fontWeight:600 }}>{row.range}</td>
              <td style={{ color:'var(--text-secondary)' }}>{row.status}</td>
              <td style={{ fontWeight:700, color:'var(--text-primary)' }}>{row.limit}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
