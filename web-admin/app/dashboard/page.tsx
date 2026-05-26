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
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const lineChartData = {
  labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [
    {
      label: 'Disbursements',
      data: [1200000, 1500000, 1800000, 1400000, 2100000, 2600000],
      borderColor: '#0FB4C3',
      backgroundColor: 'rgba(15, 180, 195, 0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointBackgroundColor: '#0FB4C3',
      pointBorderColor: '#05070e',
      pointBorderWidth: 1.5,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
    {
      label: 'Repayments',
      data: [800000, 1100000, 1300000, 1200000, 1600000, 2200000],
      borderColor: '#B04F22',
      backgroundColor: 'rgba(176, 79, 34, 0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointBackgroundColor: '#B04F22',
      pointBorderColor: '#05070e',
      pointBorderWidth: 1.5,
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  ]
};

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: '#f7f1eb',
        boxWidth: 8,
        boxHeight: 8,
        padding: 15,
        font: {
          size: 10,
          family: 'var(--font-geist-sans), system-ui'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(10, 13, 24, 0.95)',
      titleColor: '#f7f1eb',
      bodyColor: '#f7f1eb',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 10,
      boxPadding: 5,
      callbacks: {
        label: function(context: any) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += 'KES ' + context.parsed.y.toLocaleString();
          }
          return label;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.03)',
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10
        }
      }
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.03)',
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10
        },
        callback: function(value: any) {
          return 'KES ' + (value / 1000).toLocaleString() + 'k';
        }
      }
    }
  }
};

const doughnutData = {
  labels: ['Logbook Loans', 'SME Capital', 'Agribusiness', 'Personal'],
  datasets: [
    {
      data: [45, 30, 15, 10],
      backgroundColor: [
        '#0FB4C3',
        '#B04F22',
        '#107b89',
        '#6a2817',
      ],
      borderColor: 'rgba(10, 13, 24, 0.85)',
      borderWidth: 2,
    }
  ]
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#f7f1eb',
        boxWidth: 8,
        padding: 10,
        font: {
          size: 9,
          family: 'var(--font-geist-sans), system-ui'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(10, 13, 24, 0.95)',
      titleColor: '#f7f1eb',
      bodyColor: '#f7f1eb',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      callbacks: {
        label: function(context: any) {
          return ` ${context.label}: ${context.raw}%`;
        }
      }
    }
  },
  cutout: '70%'
};


type LoanItem = {
  id: number;
  user_id: number;
  product_type: string;
  principal_amount: number;
  status: string;
};

type BorrowerItem = {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
};

type DashboardStats = {
  total_active?: number;
  total_disbursed?: number;
  total_expected_revenue?: number;
  total_repaid?: number;
  total_outstanding_value?: number;
  total_defaulted_value?: number;
  total_fees?: number;
};

export default function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [borrowers, setBorrowers] = useState<BorrowerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [statsData, loansData, borrowersData] = await Promise.allSettled([
          fetchApi('/loans/stats'),
          fetchApi('/loans/'),
          fetchApi('/users/?role=borrower'),
        ]);

        if (statsData.status === 'fulfilled') setStats(statsData.value);
        if (loansData.status === 'fulfilled') setLoans(loansData.value);
        if (borrowersData.status === 'fulfilled') setBorrowers(borrowersData.value);
      } catch {
        // Keep the shell visible even if one request fails.
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const activeLoans = loans.filter((loan) => ['pending', 'approved', 'disbursed', 'partially_disbursed'].includes((loan.status || '').toLowerCase()));
  const recentLoans = loans.slice(0, 5);
  const recentBorrowers = borrowers.slice(0, 5);

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-slate-400 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-grid">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active loans"
              value={activeLoans.length || stats.total_active || 0}
              tone="amber"
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              }
            />
            <StatCard
              label="Disbursed"
              value={`KES ${(stats.total_disbursed || 0).toLocaleString()}`}
              tone="violet"
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Expected revenue"
              value={`KES ${(stats.total_expected_revenue || 0).toLocaleString()}`}
              tone="emerald"
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
              }
            />
            <StatCard
              label="Borrowers"
              value={borrowers.length || 0}
              tone="blue"
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              }
            />
          </div>

          {/* Loan Performance Panel */}
          <div className="glass-panel rounded-[28px] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Portfolio</p>
                <h2 className="text-xl font-bold tracking-tight text-white">Loan performance</h2>
              </div>
              <Link href="/dashboard/loans" className="rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200">
                View all loans
              </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2">
                <MetricCard
                  title="Total repaid"
                  value={`KES ${(stats.total_repaid || 0).toLocaleString()}`}
                  helper="Collected across cleared and active accounts"
                  tone="emerald"
                />
                <MetricCard
                  title="Outstanding"
                  value={`KES ${(stats.total_outstanding_value || 0).toLocaleString()}`}
                  helper="Balance still due from borrowers"
                  tone="amber"
                />
                <MetricCard
                  title="Defaulted value"
                  value={`KES ${(stats.total_defaulted_value || 0).toLocaleString()}`}
                  helper="Needs follow-up from collections"
                  tone="rose"
                />
                <MetricCard
                  title="Platform fee revenue"
                  value={`KES ${(stats.total_fees || 0).toLocaleString()}`}
                  helper="Earned at KES 10 per transaction"
                  tone="emerald"
                />
              </div>
              <div className="w-full lg:w-[450px] flex-shrink-0 flex flex-col rounded-2xl border border-white/5 bg-white/[0.01] p-5 h-[310px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Disbursements vs Repayments Trend</p>
                <div className="flex-1 min-h-0 relative">
                  <Line data={lineChartData} options={lineChartOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Applications Table */}
          <div className="glass-panel rounded-[28px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Loans</p>
                <h2 className="text-lg font-bold tracking-tight text-white">Recent applications</h2>
              </div>
              <Link href="/dashboard/loans/new" className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                Create loan →
              </Link>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02]">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">Borrower</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentLoans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                          <span>No loans yet.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-white/[0.03] transition-colors duration-150">
                        <td className="px-4 py-3 text-slate-300">Borrower #{loan.user_id}</td>
                        <td className="px-4 py-3 text-slate-400">{loan.product_type}</td>
                        <td className="px-4 py-3 font-medium text-white">KES {Number(loan.principal_amount || 0).toLocaleString()}</td>
                        <td className="py-3 pr-4">
                          <StatusPill status={loan.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quick Actions & Recent Borrowers */}
        <div className="space-y-6">
          <div className="glass-panel rounded-[28px] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Quick actions</p>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-white">Operations</h2>
            <div className="mt-5 space-y-3">
              <ActionLink
                href="/dashboard/borrowers/new"
                label="Onboard borrower"
                helper="Create a new customer profile"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                }
              />
              <ActionLink
                href="/dashboard/loans/new"
                label="Start loan application"
                helper="Capture principal, term, and product type"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <ActionLink
                href="/dashboard/borrowers"
                label="View borrowers"
                helper="Check active and inactive accounts"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Portfolio Mix Doughnut Chart */}
          <div className="glass-panel rounded-[28px] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Allocation</p>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-white mb-4">Portfolio Mix</h2>
            <div className="relative h-44 w-full flex items-center justify-center">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500">Borrowers</p>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-white">Recent onboarded</h2>
            <div className="mt-4 space-y-3">
              {recentBorrowers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500 text-center">
                  No borrowers loaded.
                </div>
              ) : (
                recentBorrowers.map((borrower) => (
                  <div key={borrower.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-amber-400">
                        {borrower.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-white truncate">{borrower.full_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{borrower.email}</div>
                      </div>
                    </div>
                    <StatusPill status={borrower.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ label, value, tone, icon }: { label: string; value: string | number; tone: 'amber' | 'violet' | 'emerald' | 'blue'; icon: React.ReactNode }) {
  const tones = {
    amber:   { glow: 'hover:shadow-amber-500/5',   accent: 'text-amber-400',   bgAccent: 'text-amber-500/10' },
    violet:  { glow: 'hover:shadow-violet-500/5',   accent: 'text-violet-400',  bgAccent: 'text-violet-500/10' },
    emerald: { glow: 'hover:shadow-emerald-500/5',  accent: 'text-emerald-400', bgAccent: 'text-emerald-500/10' },
    blue:    { glow: 'hover:shadow-blue-500/5',     accent: 'text-blue-400',    bgAccent: 'text-blue-500/10' },
  };

  const t = tones[tone];

  return (
    <div className={`glass-panel group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 ${t.glow}`}>
      {/* Background icon */}
      <div className={`absolute -right-2 -top-2 opacity-[0.07] ${t.bgAccent}`}>
        <div className="h-16 w-16">{icon}</div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <div className={`mt-3 text-2xl font-bold tracking-tight text-white`}>{value}</div>
    </div>
  );
}

function MetricCard({ title, value, helper, tone }: { title: string; value: string; helper: string; tone: 'emerald' | 'amber' | 'rose' }) {
  const toneMap = {
    emerald: { bar: 'bg-emerald-500', dot: 'bg-emerald-400 shadow-[0_0_6px_#10b981]' },
    amber:   { bar: 'bg-amber-500',   dot: 'bg-amber-400 shadow-[0_0_6px_#f59e0b]' },
    rose:    { bar: 'bg-rose-500',     dot: 'bg-rose-400 shadow-[0_0_6px_#f43f5e]' },
  };

  const t = toneMap[tone];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full ${t.dot}`}></div>
        <p className="text-xs font-semibold text-slate-400">{title}</p>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
      {/* Mini progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${t.bar} transition-all duration-700`} style={{ width: '60%' }}></div>
      </div>
    </div>
  );
}

function ActionLink({ href, label, helper, icon }: { href: string; label: string; helper: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:border-amber-500/15">
      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-colors duration-200">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-sm text-white group-hover:text-amber-400 transition-colors duration-200">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">{helper}</div>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const value = String(status || '').toUpperCase();
  const classes =
    value === 'APPROVED' || value === 'DISBURSED' || value === 'ACTIVE' || value === 'CLEARED'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_6px_rgba(16,185,129,0.1)]'
      : value === 'PENDING' || value === 'PARTIALLY_DISBURSED'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_6px_rgba(245,158,11,0.1)]'
        : value === 'REJECTED' || value === 'INACTIVE' || value === 'DEFAULTED'
          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_6px_rgba(244,63,94,0.1)]'
          : 'bg-slate-500/10 text-slate-400 border-slate-500/20';

  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>{value}</span>;
}
