'use client';

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
import { Line, Bar, Doughnut } from 'react-chartjs-2';

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

const riskDoughnutData = {
  labels: ['Low Risk', 'PAR-30', 'NPL'],
  datasets: [
    {
      data: [85, 11, 4],
      backgroundColor: ['#0FB4C3', '#B04F22', '#f43f5e'],
      borderColor: 'rgba(255, 255, 255, 0.85)',
      borderWidth: 2,
    }
  ]
};

const riskDoughnutOptions = {
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
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#f7f1eb',
      bodyColor: '#f7f1eb',
      borderColor: 'rgba(0, 0, 0, 0.1)',
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

const parBarData = {
  labels: ['Logbook', 'SME Capital', 'Agribusiness', 'Personal'],
  datasets: [
    {
      label: 'PAR-30 Ratio (%)',
      data: [3.2, 5.8, 2.1, 8.4],
      backgroundColor: 'rgba(15, 180, 195, 0.75)',
      hoverBackgroundColor: '#0FB4C3',
      borderColor: '#0FB4C3',
      borderWidth: 1,
      borderRadius: 6,
    }
  ]
};

const parBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#f7f1eb',
      bodyColor: '#f7f1eb',
      borderColor: 'rgba(0, 0, 0, 0.1)',
      borderWidth: 1,
      callbacks: {
        label: function(context: any) {
          return ` PAR-30: ${context.raw}%`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(0, 0, 0, 0.02)'
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
        color: 'rgba(0, 0, 0, 0.02)'
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10
        },
        callback: function(value: any) {
          return value + '%';
        }
      }
    }
  }
};

const nplLineData = {
  labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [
    {
      label: 'NPL Ratio',
      data: [2.4, 2.2, 2.1, 1.9, 2.0, 1.95],
      borderColor: '#B04F22',
      backgroundColor: 'rgba(176, 79, 34, 0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointBackgroundColor: '#B04F22',
      pointBorderColor: '#05070e',
      pointBorderWidth: 1.5,
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  ]
};

const nplLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      titleColor: '#f7f1eb',
      bodyColor: '#f7f1eb',
      borderColor: 'rgba(0, 0, 0, 0.1)',
      borderWidth: 1,
      callbacks: {
        label: function(context: any) {
          return ` NPL Ratio: ${context.raw}%`;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(0, 0, 0, 0.02)'
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
        color: 'rgba(0, 0, 0, 0.02)'
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10
        },
        callback: function(value: any) {
          return value + '%';
        }
      }
    }
  }
};

export default function PortfolioHealthPage() {
  return (
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Financial Reporting</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Portfolio Yields & PAR (Portfolio at Risk)</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          High-level operational stats summarizing portfolio performance, risk indices, and yields for treasury audit review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Portfolio at Risk (PAR 30)</span>
          <p className="text-2xl font-black text-red-600 mt-2">4.82%</p>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-rose-500" style={{ width: '4.82%' }}></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Non-Performing Loans (NPL)</span>
          <p className="text-2xl font-black text-rose-500 mt-2">1.95%</p>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-rose-600" style={{ width: '1.95%' }}></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Repayment Rate</span>
          <p className="text-2xl font-black text-emerald-600 mt-2">97.8%</p>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-emerald-500" style={{ width: '97.8%' }}></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cumulative Yield (APY)</span>
          <p className="text-2xl font-black text-amber-400 mt-2">18.4%</p>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-amber-500" style={{ width: '18.4%' }}></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Risk Doughnut */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">Risk Level Distribution</h3>
          <div className="flex-1 min-h-0 relative">
            <Doughnut data={riskDoughnutData} options={riskDoughnutOptions} />
          </div>
        </div>

        {/* Card 2: PAR-30 Bar */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">PAR-30 by Product Share</h3>
          <div className="flex-1 min-h-0 relative">
            <Bar data={parBarData} options={parBarOptions} />
          </div>
        </div>

        {/* Card 3: NPL Line */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">Monthly NPL Ratio Trend</h3>
          <div className="flex-1 min-h-0 relative">
            <Line data={nplLineData} options={nplLineOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
