'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const sections = [
    {
      title: 'Core Operations',
      items: [
        { 
          label: 'Overview', 
          path: '/dashboard',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
            </svg>
          )
        },
        { 
          label: 'Borrowers', 
          path: '/dashboard/borrowers',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          )
        },
        { 
          label: 'Loans & Apps', 
          path: '/dashboard/loans',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        },
      ]
    },
    {
      title: 'Payments',
      items: [
        {
          label: 'C2B Paybill',
          path: '/dashboard/c2b-monitor',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
          )
        },
        {
          label: 'B2C Payout',
          path: '/dashboard/b2c-payout',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
            </svg>
          )
        },
        {
          label: 'Tranches',
          path: '/dashboard/tranches',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )
        },
      ]
    },
    {
      title: 'Risk & Compliance',
      items: [
        {
          label: 'CRB Check',
          path: '/dashboard/crb-check',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
        {
          label: 'Collateral Ledger',
          path: '/dashboard/collateral',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )
        },
        {
          label: 'Collections Board',
          path: '/dashboard/collections',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )
        },
        {
          label: 'PAR & NPL Report',
          path: '/dashboard/portfolio-health',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9-1v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          )
        },
      ]
    },
    {
      title: 'System & Policy',
      items: [
        {
          label: 'SMS Center',
          path: '/dashboard/sms-center',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )
        },
        {
          label: 'Audit Trail',
          path: '/dashboard/audit-trail',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        },
        {
          label: 'Penalty Settings',
          path: '/dashboard/penalty-settings',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          )
        },
        {
          label: 'Amortization',
          path: '/dashboard/amortization',
          icon: (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )
        },
      ]
    }
  ];

  return (
    <div className="min-h-screen lg:h-screen p-3 md:p-6 bg-[#05070e] relative overflow-hidden flex flex-col">
      {/* Background glowing elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/5 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-desert-500/5 blur-[120px] pointer-events-none"></div>

      <div className="mx-auto flex flex-col lg:flex-row h-auto lg:h-full w-full max-w-[1600px] overflow-hidden rounded-[28px] border border-white/5 bg-[#0a0d18]/65 shadow-[0_32px_120px_rgba(0,0,0,0.6)]">
        
        {/* Sidebar */}
        <aside className="w-full lg:w-[250px] flex-shrink-0 flex flex-col bg-[#0b0e1b] border-b lg:border-b-0 lg:border-r border-white/5 h-auto lg:h-full">
          <div className="flex h-20 items-center gap-3 border-b border-white/5 px-6 flex-shrink-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-desert-500 shadow-[0_0_15px_rgba(15,180,195,0.25)] text-white font-black">
              K
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-desert-500">Karibu</p>
              <p className="text-base font-semibold text-white">Credit Admin</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-5 px-3 py-6 scrollbar-thin">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1.5">
                <p className="px-4 text-[9px] font-black uppercase tracking-[0.3em] text-amber-500/70">{section.title}</p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
                    return (
                      <Link
                         key={item.path}
                         href={item.path}
                         className={`flex items-center gap-3 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                           active 
                             ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 border-l-2 border-amber-500' 
                             : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <span className={`${active ? 'text-amber-400' : 'text-slate-400 group-hover:text-white'}`}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                        {active && (
                          <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(15,180,195,0.6)]"></div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Profile Card & Logout */}
          <div className="border-t border-white/5 p-4 space-y-4 flex-shrink-0">
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="h-9 w-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-amber-400">
                A
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">Staff Console</p>
                <div className="mt-0.5 inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 border border-amber-500/20">
                  Officer
                </div>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 px-4 py-3 text-xs font-semibold text-rose-300 transition-all duration-200"
            >
              <span>Term Session</span>
              <span className="text-sm">→</span>
            </button>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <section className="flex-1 min-w-0 flex flex-col bg-[#05070e] text-slate-100 h-auto lg:h-full overflow-hidden">
          
          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-white/5 bg-[#090c18]/40 px-6 backdrop-blur-xl lg:px-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-desert-500">Operation Panel</p>
              <h1 className="text-xl font-bold tracking-tight text-white capitalize">
                {pathname.split('/').pop() === 'dashboard' || pathname === '/dashboard' ? 'Overview' : pathname.split('/').pop()?.replace('-', ' ')}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/borrowers/new"
                className="hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition-all duration-200 md:inline-flex"
              >
                Add Borrower
              </Link>
              <Link
                href="/dashboard/loans/new"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:shadow-amber-500/10 transition-all duration-200"
              >
                Create Application
              </Link>
            </div>
          </header>

          {/* Main Content Body */}
          <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">
            {children}
          </main>
        </section>
      </div>
    </div>
  );
}
