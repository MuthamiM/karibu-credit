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
import { THEME } from '@/theme';

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
      backgroundColor: [THEME.colors.black, THEME.colors.textMuted, THEME.colors.border],
      borderColor: THEME.colors.white,
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
        color: THEME.colors.black,
        boxWidth: 8,
        padding: 10,
        font: {
          size: 9,
          family: 'Inter, system-ui',
          weight: 'bold' as any
        }
      }
    },
    tooltip: {
      backgroundColor: THEME.colors.black,
      titleColor: THEME.colors.white,
      bodyColor: THEME.colors.white,
      borderColor: THEME.colors.border,
      borderWidth: 1,
      cornerRadius: 0,
      callbacks: {
        label: function(context: any) {
          return ` ${context.label}: ${context.raw}%`;
        }
      }
    }
  },
  cutout: '75%'
};

const parBarData = {
  labels: ['Logbook', 'SME Capital', 'Agribusiness', 'Personal'],
  datasets: [
    {
      label: 'PAR-30 Ratio (%)',
      data: [3.2, 5.8, 2.1, 8.4],
      backgroundColor: THEME.colors.textMuted,
      hoverBackgroundColor: THEME.colors.black,
      borderColor: THEME.colors.black,
      borderWidth: 1,
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
      backgroundColor: THEME.colors.black,
      titleColor: THEME.colors.white,
      bodyColor: THEME.colors.white,
      borderColor: THEME.colors.border,
      borderWidth: 1,
      cornerRadius: 0,
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
        display: false
      },
      ticks: {
        color: THEME.colors.black,
        font: {
          size: 10,
          family: 'Inter'
        }
      }
    },
    y: {
      grid: {
        color: THEME.colors.border
      },
      ticks: {
        color: THEME.colors.black,
        font: {
          size: 10,
          family: 'Inter'
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
      borderColor: THEME.colors.black,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointBackgroundColor: THEME.colors.black,
      pointBorderColor: THEME.colors.white,
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
      backgroundColor: THEME.colors.black,
      titleColor: THEME.colors.white,
      bodyColor: THEME.colors.white,
      borderColor: THEME.colors.border,
      borderWidth: 1,
      cornerRadius: 0,
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
        display: false
      },
      ticks: {
        color: THEME.colors.black,
        font: {
          size: 10,
          family: 'Inter'
        }
      }
    },
    y: {
      grid: {
        color: THEME.colors.border
      },
      ticks: {
        color: THEME.colors.black,
        font: {
          size: 10,
          family: 'Inter'
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
    <div className={THEME.classes.panel}>
      <div className="border-b border-black pb-4 mb-6">
        <p className={THEME.classes.subtitle}>Financial Reporting</p>
        <h2 className={THEME.classes.title + " mt-1"}>Portfolio Yields & PAR (Portfolio at Risk)</h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          High-level operational stats summarizing portfolio performance, risk indices, and yields for treasury audit review.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="border border-black bg-white p-5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Portfolio at Risk (PAR 30)</span>
          <p className="text-2xl font-black text-black mt-2">4.82%</p>
          <div className="h-1.5 w-full bg-zinc-100 border border-black rounded-none overflow-hidden mt-3">
            <div className="h-full bg-black" style={{ width: '4.82%' }}></div>
          </div>
        </div>

        <div className="border border-black bg-white p-5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Non-Performing Loans (NPL)</span>
          <p className="text-2xl font-black text-black mt-2">1.95%</p>
          <div className="h-1.5 w-full bg-zinc-100 border border-black rounded-none overflow-hidden mt-3">
            <div className="h-full bg-black" style={{ width: '1.95%' }}></div>
          </div>
        </div>

        <div className="border border-black bg-white p-5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Repayment Rate</span>
          <p className="text-2xl font-black text-black mt-2">97.8%</p>
          <div className="h-1.5 w-full bg-zinc-100 border border-black rounded-none overflow-hidden mt-3">
            <div className="h-full bg-black" style={{ width: '97.8%' }}></div>
          </div>
        </div>

        <div className="border border-black bg-white p-5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Cumulative Yield (APY)</span>
          <p className="text-2xl font-black text-black mt-2">18.4%</p>
          <div className="h-1.5 w-full bg-zinc-100 border border-black rounded-none overflow-hidden mt-3">
            <div className="h-full bg-black" style={{ width: '18.4%' }}></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Risk Doughnut */}
        <div className="border border-black bg-white p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">Risk Level Distribution</h3>
          <div className="flex-1 min-h-0 relative">
            <Doughnut data={riskDoughnutData} options={riskDoughnutOptions} />
          </div>
        </div>

        {/* Card 2: PAR-30 Bar */}
        <div className="border border-black bg-white p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">PAR-30 by Product Share</h3>
          <div className="flex-1 min-h-0 relative">
            <Bar data={parBarData} options={parBarOptions} />
          </div>
        </div>

        {/* Card 3: NPL Line */}
        <div className="border border-black bg-white p-5 h-64 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">Monthly NPL Ratio Trend</h3>
          <div className="flex-1 min-h-0 relative">
            <Line data={nplLineData} options={nplLineOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
