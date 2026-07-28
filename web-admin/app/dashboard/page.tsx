'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../lib/api';
import { THEME } from '@/theme';
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
  label, value, sub, icon,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={THEME.classes.card} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: THEME.colors.black }} />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.75rem' }}>
        <div style={{ flex:1, minWidth:0, paddingLeft: '0.25rem' }}>
          <div style={{ fontSize:'9px', fontFamily: 'monospace', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:THEME.colors.textMuted, marginBottom:'0.5rem' }}>
            {label}
          </div>
          <div style={{ fontSize:'1.5rem', fontWeight:900, color:THEME.colors.textPrimary, lineHeight:1.2, letterSpacing:'-0.02em', fontFamily: 'monospace' }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize:'9px', color:THEME.colors.textMuted, marginTop:'0.35rem', fontWeight:600, fontFamily: 'monospace', textTransform: 'uppercase' }}>
              {sub}
            </div>
          )}
        </div>
        <div style={{ width:36, height:36, border: '1px solid #000', display:'flex', alignItems:'center', justifyItems:'center', justifyContent:'center', flexShrink:0, color: '#000' }}>
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
    <div className={THEME.classes.card} style={{ overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:'1rem', borderBottom:'1px solid #000', gap:'1rem', background: '#fff' }}>
        <div>
          <div style={{ fontSize:'0.875rem', fontWeight:700, color:THEME.colors.textPrimary, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:'0.5rem', textTransform: 'uppercase', fontFamily: 'monospace' }}>
            <div style={{ width:4, height:16, background:THEME.colors.black }} />
            {title}
          </div>
          {subtitle && <div style={{ fontSize:'10px', color:THEME.colors.textMuted, marginTop:4, marginLeft:'0.75rem', fontFamily: 'monospace', textTransform: 'uppercase' }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ paddingTop:'1rem' }}>{children}</div>
    </div>
  );
}

/** Status badge */
function Badge({ label, type }: { label: string; type: 'success'|'warning'|'danger'|'info'|'neutral'|'brand' }) {
  const isFilled = type === 'success' || type === 'brand' || type === 'neutral';
  return (
    <span className={isFilled ? THEME.classes.badgeFilled : THEME.classes.badgeOutline}>
      {label}
    </span>
  );
}

/** Thin progress bar */
function ProgressBar({ value, color = '#000000', bg = '#f4f4f5' }: { value: number; color?: string; bg?: string }) {
  return (
    <div style={{ height:6, background: bg, overflow:'hidden', border: '1px solid #000' }}>
      <div style={{ height:'100%', width:`${Math.min(value, 100)}%`, background: color, transition:'width 0.6s ease' }} />
    </div>
  );
}

/** Alert/Notice banner */
function AlertBanner({ icon, title, body }: {
  icon: React.ReactNode; title: string; body: string; type?: 'info'|'warning'|'success'|'danger';
}) {
  return (
    <div style={{ background: '#ffffff', border:'1px solid #000000', padding:'0.75rem 1.25rem', display:'flex', alignItems:'center', gap:'0.875rem' }}>
      <span style={{ flexShrink:0, color: '#000', display:'flex' }}>{icon}</span>
      <div style={{ flex:1, fontSize:'10px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
        <span style={{ fontWeight:700, color: '#000' }}>{title} </span>
        <span style={{ color:THEME.colors.textSecondary }}>{body}</span>
      </div>
    </div>
  );
}

/** Shared table wrapper */
function DataTable({ headers, children }: {
  headers: string[]; children: React.ReactNode; empty?: string;
}) {
  return (
    <div style={{ overflowX:'auto', border:'1px solid #000' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <thead style={{ background: '#000', color: '#fff', textTransform: 'uppercase' }}>
          <tr>{headers.map(h => <th key={h} style={{ padding: '0.625rem 0.875rem', fontWeight: 700, textAlign: 'left', fontSize: '10px' }}>{h}</th>)}</tr>
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
    legend: { labels: { color: '#000000', font: { size: 10, family: 'Inter', weight: 'bold' }, boxWidth: 12 } },
    tooltip: { backgroundColor: '#000000', bodyFont: { family: 'Inter', size: 11 }, titleFont: { family: 'Inter', size: 11 }, cornerRadius: 0 },
  },
  scales: {
    x: { ticks: { color: '#000000', font: { size: 10 } }, grid: { display: false } },
    y: { ticks: { color: '#000000', font: { size: 10 } }, grid: { color: '#e4e4e7' } },
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
  const [stats,        setStats]        = useState<any>({});
  const [loading,      setLoading]      = useState<boolean>(true);

  useEffect(() => {
    async function loadRole() {
      const override = localStorage.getItem('preview_role');
      if (override) { setActiveRole(override); return; }
      try {
        const me = await fetchApi('/users/me');
        if (me?.role) setActiveRole(me.role);
      } catch { /* fall back to default */ }
    }
    loadRole();
    const sync = () => {
      const r = localStorage.getItem('preview_role');
      if (r) setActiveRole(r);
    };
    window.addEventListener('preview-role-changed', sync);
    return () => window.removeEventListener('preview-role-changed', sync);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [s, l, b, t] = await Promise.allSettled([
          fetchApi('/loans/stats'),
          fetchApi('/loans/'),
          fetchApi('/users/'),
          fetchApi('/loans/transactions'),
        ]);
        if (s.status === 'fulfilled') setStats(s.value);
        if (l.status === 'fulfilled') setLoans(l.value);
        if (b.status === 'fulfilled') setBorrowers(b.value);
        if (t.status === 'fulfilled') setTransactions(t.value);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

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
      <div className="min-h-[300px] flex items-center justify-center bg-white border border-black p-8 text-black gap-3 font-mono text-base uppercase tracking-wider">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        Loading dashboard data...
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
      { label: 'Disbursements', data: [12.4, 15.1, 18.2, 14.8, 21.3, 26.0], backgroundColor: THEME.colors.black, borderWidth: 1 },
      { label: 'Collections',   data: [8.5,  11.2, 13.6, 12.1, 16.5, 22.4], backgroundColor: THEME.colors.textMuted, borderWidth: 1 },
    ],
  };

  const doughnutData = {
    labels: ['Logbook Loans', 'SME Capital', 'Agribusiness', 'Personal'],
    datasets: [{ data: [45, 30, 15, 10], backgroundColor: [THEME.colors.black, '#3f3f46', '#71717a', '#e4e4e7'], borderWidth: 1, borderColor: '#fff' }],
  };

  return (
    <div className="fade-in space-y-8">
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
        title="Executive Briefing:"
        body="Total Loan Book grew +22.4% MoM. Branch audit compliance completed. PAR 30 is within policy threshold."
      />

      {/* KPIs Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Loan Portfolio" value={`KES ${(stats.total_outstanding_value || 64200000).toLocaleString()}`} sub="+12.4% MoM"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="0"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>} />
        <KpiCard label="Monthly Revenue (MTD)" value={`KES ${(stats.total_repaid || 22400000).toLocaleString()}`} sub="+8.6% of target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard label="Net Profit Margin" value="24.8%" sub="Within target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
        <KpiCard label="Active Customers" value={borrowers.length || 358} sub="+18 this week"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>} />
      </div>

      {/* KPIs Row 2 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Disbursements Today" value="KES 2,450,000" sub="100% Daraja SLA"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>} />
        <KpiCard label="PAR 30 Rate" value="4.82%" sub="Safe (< 5.0%)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
        <KpiCard label="NPL Rate (PAR 90+)" value="1.84%" sub="Safe (< 3.0%)"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        <KpiCard label="Collection Rate" value="94.6%" sub="Target: 95.0%"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Disbursements vs Collections" subtitle="KES Millions — last 6 months">
            <div style={{ height:260 }}>
              <Bar data={barData} options={CHART_OPTS_BASE as any} />
            </div>
          </Panel>
        </div>
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
      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-2">
        <Panel title="Branch Portfolio Health" subtitle="Real-time performance">
          <DataTable headers={['Branch Office', 'Portfolio Size', 'PAR 30', 'Collection Rate']}>
            {branches.map((b, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight:700, color:THEME.colors.black }}>{b.name}</div>
                  <div style={{ fontSize:'9px', color:THEME.colors.textMuted }}>Mgr: {b.manager}</div>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {b.portfolio.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Badge
                    label={`${b.PAR30}%`}
                    type={b.PAR30 > 8 ? 'neutral' : b.PAR30 > 5 ? 'warning' : 'success'}
                  />
                </td>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{b.collectionRate}%</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="P&L Budget vs Actual (MTD)" subtitle="Operating performance">
          <DataTable headers={['Account Line', 'Budget', 'Actual', 'Variance']}>
            {plLines.map((pl, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{pl.line}</td>
                <td style={{ padding: '0.75rem 1rem' }}>KES {pl.budget.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {pl.actual.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <span style={{ fontWeight:700, color: THEME.colors.black }}>
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
    <div className="fade-in space-y-8">
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>}
        title="Daraja Status:"
        body="Connected & stable. 99.8% reconciliation SLA maintained over 24 hours."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Interest Income MTD" value="KES 14,820,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
        <KpiCard label="Processing Fees MTD" value="KES 3,250,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="0"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
        <KpiCard label="Insurance Commission" value="KES 840,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
        <KpiCard label="Operating Expenses" value="KES 4,120,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard label="Gross Profit MTD" value="KES 18,910,000"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard label="Total Provision Reserve" value={`KES ${(stats.total_defaulted_value || 8450000).toLocaleString()}`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
      </div>

      <Panel
        title="Daraja B2C / C2B Settlement Audit"
        subtitle="Auto-updated every 30 seconds"
        action={
          <span className={THEME.classes.badgeFilled}>
            LIVE
          </span>
        }
      >
        <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-3 items-start">
          <div className="lg:col-span-2">
            <DataTable headers={['Transaction Pool', 'Tx Count', 'Total Value', 'SLA Status']}>
              {reconciliations.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{r.source}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{r.count}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {r.amount.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><Badge label={r.status} type={r.status === 'PENDING' ? 'warning' : 'success'} /></td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className={THEME.classes.card + " space-y-3 bg-zinc-50"}>
            <div style={{ fontSize:'10px', fontWeight:700, color: '#000', fontFamily: 'monospace' }}>2 Settlement Discrepancies</div>
            <p style={{ fontSize:'11px', color:THEME.colors.textSecondary, lineHeight:1.5 }}>
              Two ZamuPay API transactions did not return callbacks within the 30-min SLA. Automated recovery cron initiated.
            </p>
            <div style={{ fontSize:'10px', fontFamily:'monospace', background:'white', border: '1px solid #000', padding:'0.625rem', color:THEME.colors.textSecondary }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}><span>ZAMU-781A8X</span><strong>KES 50,000</strong></div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}><span>ZAMU-902Y1T</span><strong>KES 50,000</strong></div>
            </div>
            <button className={THEME.classes.btnPrimary + " w-full text-base"}>
              Re-Trigger Reconciliation
            </button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Recent Ledger Transactions"
        action={<button className={THEME.classes.btnSecondary + " text-base"}>Export Report →</button>}
      >
        <DataTable headers={['Tx Ref ID', 'Loan', 'Type', 'Amount', 'Date']}>
          {transactions.slice(0, 8).map(tx => (
            <tr key={tx.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight:700, fontFamily:'monospace', color:THEME.colors.black }}>{tx.reference_code || `TXN-00${tx.id}`}</td>
              <td style={{ padding: '0.75rem 1rem' }}>#{tx.loan_id}</td>
              <td style={{ padding: '0.75rem 1rem' }}>
                <Badge
                  label={tx.type.toUpperCase()}
                  type={tx.type === 'repayment' ? 'success' : tx.type === 'disbursement' ? 'brand' : 'neutral'}
                />
              </td>
              <td style={{ padding: '0.75rem 1rem', fontWeight:700, color:THEME.colors.textPrimary }}>KES {tx.amount.toLocaleString()}</td>
              <td style={{ padding: '0.75rem 1rem' }}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</td>
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
    { label: 'PAR 1–7 Days',   pct: 65, count: 22 },
    { label: 'PAR 8–30 Days',  pct: 22, count: 8 },
    { label: 'PAR 31–90 Days', pct: 10, count: 3 },
    { label: 'PAR 90+ Days',   pct: 3,  count: 1 },
  ];

  return (
    <div className="fade-in space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Branch Active Loans" value={loans.length || 142} sub="As of today"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>} />
        <KpiCard label="Branch Book Value" value="KES 24,500,000" sub="+5.2% MoM"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
        <KpiCard label="Branch PAR 30 Rate" value="3.82%" sub="Within target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
        <KpiCard label="Manager Escalations" value="3 Pending" sub="Awaiting review"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>} />
      </div>

      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Branch Officer Performance Board" subtitle="TAT and collection rates per officer">
            <DataTable headers={['Loan Officer', 'Apps Assigned', 'Avg TAT', 'PAR 30']}>
              {officers.map((o, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{o.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{o.assigned} apps</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>
                    {o.tat} hrs
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Badge label={`${o.PAR30}%`} type={o.PAR30 > 8 ? 'danger' : o.PAR30 > 5 ? 'warning' : 'success'} />
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>

        <Panel title="Arrears (PAR) Breakdown" subtitle="Accounts currently in arrears">
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {parData.map((p, i) => (
              <div key={i}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', fontWeight:700, color:THEME.colors.textSecondary, marginBottom:6, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  <span>{p.label}</span>
                  <span>{p.count} ({p.pct}%)</span>
                </div>
                <ProgressBar value={p.pct} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="High-Value Approval Queue" subtitle="Applications ≥ KES 500,000 escalated to branch manager">
        {highValueLoans.length === 0 ? (
          <div style={{ padding:'2rem', textAlign:'center', color:THEME.colors.textMuted, fontSize:'11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            No high-value applications pending branch manager approval.
          </div>
        ) : (
          <DataTable headers={['Reference', 'Borrower', 'Product', 'Amount', 'Action']}>
            {highValueLoans.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700, color:THEME.colors.black }}>{l.application_no || `LAF-${l.id}`}</td>
                <td style={{ padding: '0.75rem 1rem' }}>User #{l.user_id}</td>
                <td style={{ padding: '0.75rem 1rem', textTransform:'uppercase' }}>{l.product_type}</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {l.principal_amount.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <button className={THEME.classes.btnPrimary + " text-[10px] py-1 px-2.5"} onClick={() => handleApprove(l.id)}>
                      Approve & Disburse
                    </button>
                    <button className={THEME.classes.btnSecondary + " text-[10px] py-1 px-2.5"} onClick={() => alert('Audit requested')}>
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
    <div className="fade-in space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="My Queue Today" value={`${pendingQueue.length} apps`} sub="Pending review"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>} />
        <KpiCard label="Approval Rate (MTD)" value="78.2%" sub="Above target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard label="Avg Review TAT" value="16.4 hrs" sub="SLA: 24h max"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <KpiCard label="Collection Rate" value="96.8%" sub="Origination"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>} />
      </div>

      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-1 w-full2 items-start">
        {/* Queue */}
        <div className="lg:col-span-8">
          <Panel title="Application Queue" subtitle="Click a row to start appraisal · 24h SLA">
            {pendingQueue.length === 0 ? (
              <div style={{ padding:'3rem', textAlign:'center', color:THEME.colors.textMuted, fontSize:'11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                Your application queue is empty — great work!
              </div>
            ) : (
              <DataTable headers={['Reference', 'Borrower', 'Product', 'Amount', '']}>
                {pendingQueue.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => { setSelectedLoan(l); setChecklist({ idVerified:false, kraPINVerified:false, crbStatusGood:false, payslipVerified:false, guarantorAppraisal:false }); }}
                    style={{ cursor:'pointer', background: selectedLoan?.id === l.id ? '#f4f4f5' : undefined, borderBottom: '1px solid #e4e4e7' }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight:700, color:THEME.colors.black }}>{l.application_no || `LAF-${l.id}`}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>User #{l.user_id}</td>
                    <td style={{ padding: '0.75rem 1rem', textTransform:'uppercase' }}>{l.product_type}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {l.principal_amount.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button className={THEME.classes.btnSecondary + " text-[10px] py-1 px-2.5"}>
                        Open →
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
        </div>

        {/* Appraisal panel */}
        <div className={`${THEME.classes.card} lg:col-span-4 flex flex-col min-h-[440px]`}>
          {selectedLoan ? (
            <>
              <div className="flex justify-between items-center border-b border-black pb-3 mb-4">
                <div style={{ fontSize:'12px', fontWeight:700, textTransform: 'uppercase', fontFamily: 'monospace' }}>Appraise Applicant</div>
                <span className={THEME.classes.badgeFilled}>{selectedLoan.application_no || `LAF-${selectedLoan.id}`}</span>
              </div>

              {/* Score summary */}
              <div className="border border-black bg-zinc-50 p-4 font-mono text-base uppercase space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Credit Score</span>
                  <span className="font-bold text-black">710 / 1000 — GOOD</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-200">
                  <span className="text-zinc-500">Recommended Limit</span>
                  <span className="font-bold text-black">KES 500,000</span>
                </div>
              </div>

              {/* Checklist */}
              <div className="mb-4 space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-100 pb-1">
                  Mandatory Appraisal Steps
                </div>
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} className="flex items-center gap-2.5 cursor-pointer font-mono text-base uppercase text-zinc-700">
                    <input
                      type="checkbox"
                      checked={checklist[item.key as keyof typeof checklist]}
                      onChange={() => toggleItem(item.key)}
                      style={{ accentColor:'#000000', width:14, height:14 }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-auto space-y-2 pt-4 border-t border-zinc-100">
                <button
                  className={THEME.classes.btnPrimary + " w-full text-base"}
                  disabled={!isComplete}
                  onClick={handleApprove}
                >
                  {isComplete ? 'Approve & Release Funds' : 'Complete checklist to enable'}
                </button>
                <div className="flex gap-2">
                  <button className={THEME.classes.btnSecondary + " flex-1 text-base"} onClick={handleReject}>Reject</button>
                  <button className={THEME.classes.btnSecondary + " flex-1 text-base"} onClick={() => alert('Escalated to Branch Manager.')}>Escalate</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 font-mono text-base uppercase tracking-widest text-zinc-400">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <div>Select an application to begin appraisal</div>
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
    <div className="fade-in space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Delinquent Cases" value={arrearsQueue.length || 18} sub="Outstanding recovery"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        <KpiCard label="My Promises to Pay" value="8 active" sub="SLA tracking"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard label="Recovery Value (MTD)" value="KES 4,120,000" sub="Target: 5.0M"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} />
      </div>

      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-1 w-full2 items-start">
        {/* Recovery queue */}
        <div className="lg:col-span-8">
          <Panel title="Arrears &amp; Recovery Queue" subtitle="Click a case to execute follow-up protocols">
            {arrearsQueue.length === 0 ? (
              <div style={{ padding:'3rem', textAlign:'center', color:THEME.colors.textMuted, fontSize:'11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                No active defaults — great portfolio health!
              </div>
            ) : (
              <DataTable headers={['Reference', 'Product', 'Outstanding', 'Penalties', 'Recovery Action']}>
                {arrearsQueue.map(c => {
                  const days = c.par_days || 15;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      style={{ cursor:'pointer', background: selectedCase?.id === c.id ? '#f4f4f5' : undefined, borderBottom: '1px solid #e4e4e7' }}
                    >
                      <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>
                        <div style={{ color:THEME.colors.black }}>{c.application_no || `L-${c.id}`}</div>
                        <div style={{ fontSize:'9px', color:THEME.colors.textMuted }}>{days} days overdue</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textTransform:'uppercase' }}>{c.product_type}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {(c.outstanding_balance || 150000).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {(c.penalty_balance || 15000).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize:'10px', color:THEME.colors.textMuted }}>{getAdvice(days)}</td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </Panel>
        </div>

        {/* Case actions */}
        <div className={`${THEME.classes.card} lg:col-span-4 flex flex-col min-h-[440px]`}>
          {selectedCase ? (
            <>
              <div className="flex justify-between items-center border-b border-black pb-3 mb-4 font-mono uppercase text-base">
                <div className="font-bold">Manage Recovery</div>
                <span className={THEME.classes.badgeFilled}>{selectedCase.application_no || `LAF-${selectedCase.id}`}</span>
              </div>
              
              <div className="border border-black bg-zinc-50 p-4 font-mono text-base uppercase space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Overdue</span>
                  <span className="font-bold">KES {((selectedCase.outstanding_balance || 150000) + (selectedCase.penalty_balance || 15000)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-200">
                  <span className="text-zinc-500">Phone Contact</span>
                  <span className="font-bold">+254 700 000 000</span>
                </div>
              </div>

              {/* SMS history */}
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-100 pb-1 mb-2">
                SMS History
              </div>
              <div className="space-y-2 max-h-[140px] overflow-y-auto mb-4 font-mono uppercase text-[9px]">
                {[
                  { days:'5 days overdue', msg:'Your payment of KES 15,200 is past due. Late penalty applied.' },
                  { days:'15 days overdue', msg:'CRB Pre-listing Warning: Pay within 7 days to avoid negative listing.' },
                ].map((s, i) => (
                  <div key={i} className="border border-zinc-200 bg-white p-2.5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{s.days}</span>
                      <span className="font-bold text-black">Delivered</span>
                    </div>
                    <p className="text-zinc-600 font-normal">"{s.msg}"</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-2 pt-4 border-t border-zinc-100">
                <button className={THEME.classes.btnSecondary + " w-full text-base"} onClick={() => setRestructureOpen(true)}>
                  Propose Loan Restructuring
                </button>
                <div className="flex gap-2">
                  <button className={THEME.classes.btnPrimary + " flex-1 text-base"} onClick={() => alert('CRB Negative Listing registered.')}>
                    CRB List
                  </button>
                  <button className={THEME.classes.btnSecondary + " flex-1 text-base"} onClick={() => alert('Promise-to-pay logged.')}>
                    Log Promise
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 font-mono text-base uppercase tracking-widest text-zinc-400">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>Select a delinquent case to manage recovery</div>
            </div>
          )}
        </div>
      </div>

      {/* Restructure modal */}
      {restructureOpen && selectedCase && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${THEME.classes.card} w-full max-w-[440px] space-y-4`}>
            <h3 className={THEME.classes.sectionTitle}>Propose Restructuring Plan</h3>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              Loan: {selectedCase.application_no || `LAF-${selectedCase.id}`}
            </p>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tenure Extension</label>
              <select value={tenure} onChange={e => setTenure(e.target.value)} className={THEME.classes.input}>
                <option value="3">Extend by +3 Months</option>
                <option value="6">Extend by +6 Months</option>
                <option value="9">Extend by +9 Months</option>
                <option value="12">Extend by +12 Months</option>
              </select>
            </div>
            <div className="border border-black bg-zinc-50 p-4 font-mono text-base uppercase space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">New Instalment</span>
                <span className="font-bold text-black">KES 12,450 / mo</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200">
                <span className="text-zinc-500">Previous Instalment</span>
                <span className="font-bold text-zinc-400">KES 18,200 / mo</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-black/10">
              <button className={THEME.classes.btnPrimary + " flex-1"} onClick={handleRestructure}>Forward to Manager</button>
              <button className={THEME.classes.btnSecondary + " flex-1"} onClick={() => setRestructureOpen(false)}>Cancel</button>
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
    <div className="fade-in space-y-8">
      <AlertBanner
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        title="Compliance Alert:"
        body="CBK Monthly Returns draft is ready. 3 days remaining to file without penalty."
      />

      <Panel
        title="CBK Regulatory Report Tracker"
        subtitle="NDTCP Regulations 2025 — filing obligations"
      >
        <DataTable headers={['CBK Filing', 'Due Date', 'Auto-Draft Status', 'Late Penalty', 'Action']}>
          {cbkReports.map((rpt, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{rpt.name}</td>
              <td style={{ padding: '0.75rem 1rem' }}>{rpt.due}</td>
              <td style={{ padding: '0.75rem 1rem' }}><Badge label={rpt.autoDraft} type={rpt.autoDraft === 'Completed' ? 'success' : rpt.autoDraft === 'In Progress' ? 'warning' : 'neutral'} /></td>
              <td style={{ padding: '0.75rem 1rem', fontSize:'10px', color:THEME.colors.black, fontWeight:700 }}>{rpt.penalty}</td>
              <td style={{ padding: '0.75rem 1rem' }}>
                <div style={{ display:'flex', gap:6 }}>
                  <button className={THEME.classes.btnPrimary + " text-[10px] py-1 px-2.5"} onClick={() => alert(`${rpt.name} PDF generated.`)}>
                    Export PDF
                  </button>
                  <button className={THEME.classes.btnSecondary + " text-[10px] py-1 px-2.5"} onClick={() => alert(`${rpt.name} CSV exported.`)}>
                    CSV
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-2">
        <Panel title="AML Transaction Flags" subtitle="Transactions ≥ KES 300,000 requiring review">
          {amlTransactions.length === 0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:THEME.colors.textMuted, fontSize:'11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
              No transactions flagged under AML guidelines.
            </div>
          ) : (
            <DataTable headers={['Tx Code', 'Type', 'Amount', 'Action']}>
              {amlTransactions.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{tx.reference_code || `TX-${tx.id}`}</td>
                  <td style={{ padding: '0.75rem 1rem', textTransform:'uppercase' }}>{tx.type}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>KES {tx.amount.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button className={THEME.classes.btnPrimary + " text-[10px] py-1 px-2.5"} onClick={() => alert('Flag cleared.')}>
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
            <div style={{ padding:'2rem', textAlign:'center', color:THEME.colors.textMuted, fontSize:'11px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
              All accounts have been KYC-verified.
            </div>
          ) : (
            <DataTable headers={['Full Name', 'Email', 'Phone', 'Verify']}>
              {kycQueue.map(kyc => (
                <tr key={kyc.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight:700 }}>{kyc.full_name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{kyc.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{kyc.phone_number || '+254 700 000 000'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button className={THEME.classes.btnPrimary + " text-[10px] py-1 px-2.5"} onClick={() => handleVerifyKyc(kyc.id)}>
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
      backgroundColor: [THEME.colors.black, '#3f3f46', '#71717a', '#a1a1aa', '#e4e4e7'],
      borderWidth: 1,
      borderColor: '#fff'
    }],
  };

  const ELIGIBILITY = [
    { tier: 'Excellent', range: '800–1000', status: 'All products, no restrictions', limit: 'KES 1,000,000' },
    { tier: 'Good', range: '650–799', status: 'All products, standard terms', limit: 'KES 500,000' },
    { tier: 'Fair', range: '500–649', status: 'Most products, collateral required', limit: 'KES 200,000' },
    { tier: 'Poor', range: '300–499', status: 'Micro-loans only, 1 guarantor required', limit: 'KES 30,000' },
    { tier: 'Very Poor', range: '<300', status: 'Auto-rejected at screening', limit: 'KES 0' },
  ];

  return (
    <div className="fade-in space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg Portfolio Credit Score" value="672 / 1000" sub="GOOD — healthy"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard label="KYC Verification Rate" value="92.4%" sub="Well above target"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} />
        <KpiCard label="CRB Listing Rate" value="4.2%" sub="Monitor closely"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>} />
        <KpiCard label="Highest Score" value="910 / 1000" sub="Top borrower"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>} />
      </div>

      <div className="grid gap-6 grid-cols-1 w-full lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Score Distribution Histogram" subtitle="Portfolio credit score spread">
            <div style={{ height: 280 }}>
              <Bar data={histData} options={CHART_OPTS_BASE as any} />
            </div>
          </Panel>
        </div>

        <Panel title="Model Weight Tuning" subtitle="Adjust credit scoring parameters">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { key: 'repaymentHistory', label: 'Repayment History' },
              { key: 'accountAge', label: 'Account History Age' },
              { key: 'loanUtilisation', label: 'Credit Utilisation' },
              { key: 'crbScore', label: 'TransUnion CRB Score' },
            ].map(item => (
              <div key={item.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: THEME.colors.textSecondary, marginBottom: 6, fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  <span>{item.label}</span>
                  <span>{weights[item.key as keyof typeof weights]}%</span>
                </div>
                <input
                  type="range" min={5} max={60}
                  value={weights[item.key as keyof typeof weights]}
                  onChange={e => setWeights(p => ({ ...p, [item.key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: THEME.colors.black }}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', padding: '0.75rem', border: '1px solid #000', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase' }}>
            <span>Total:</span>
            <span>{totalWeight}% / 100%</span>
          </div>

          <button className={THEME.classes.btnPrimary + " w-full mt-4 text-base"} onClick={handleApply}>
            Commit Weights & Re-Score
          </button>
        </Panel>
      </div>

      <Panel title="Credit Score Tier Eligibility Matrix" subtitle="Automated product eligibility by score band">
        <DataTable headers={['Tier', 'Score Range', 'Eligibility', 'Credit Ceiling']}>
          {ELIGIBILITY.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{row.tier}</td>
              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{row.range}</td>
              <td style={{ padding: '0.75rem 1rem', color: THEME.colors.textSecondary }}>{row.status}</td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{row.limit}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}
