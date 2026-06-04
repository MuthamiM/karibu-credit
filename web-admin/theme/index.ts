// Central Theme System for Stark Monochrome (Black & White)
export const THEME = {
  // Color tokens
  colors: {
    bg: '#fafafa',
    surface: '#ffffff',
    border: '#e4e4e7',
    borderStrong: '#000000',
    textPrimary: '#000000',
    textSecondary: '#27272a',
    textMuted: '#71717a',
    black: '#000000',
    white: '#ffffff',
    grayLight: '#f4f4f5',
    grayDark: '#18181b',
  },
  
  // Tailwind class strings to keep CSS unified
  classes: {
    // Buttons
    btnPrimary: 'inline-flex items-center justify-center gap-2 border border-black bg-black !text-white hover:bg-zinc-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-150',
    btnSecondary: 'inline-flex items-center justify-center gap-2 border border-black bg-white !text-black hover:bg-zinc-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-150',
    
    // Cards / Containers
    card: 'border border-black bg-white p-5 shadow-none rounded-none',
    panel: 'border border-black bg-white p-6 shadow-none rounded-none',
    
    // Inputs
    input: 'w-full border border-black bg-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-black outline-none focus:ring-1 focus:ring-black placeholder-zinc-400',
    
    // Typography
    title: 'text-2xl font-bold uppercase tracking-tight text-black',
    subtitle: 'text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500',
    sectionTitle: 'text-sm font-bold uppercase tracking-wider text-black',
    textMuted: 'text-[10px] font-mono text-zinc-400 uppercase tracking-widest',
    
    // Badges
    badgeFilled: 'border border-black bg-black !text-white text-[9px] font-mono uppercase px-2.5 py-0.5 font-bold tracking-widest',
    badgeOutline: 'border border-black bg-white !text-black text-[9px] font-mono uppercase px-2.5 py-0.5 font-bold tracking-widest',
    badgeMuted: 'border border-zinc-300 bg-zinc-100 !text-zinc-600 text-[9px] font-mono uppercase px-2.5 py-0.5 font-semibold tracking-wider',
  },
  
  // Grayscale Chart options
  chart: {
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#000000',
            font: { family: 'Inter', size: 10, weight: 'bold' as any },
          },
        },
        tooltip: {
          backgroundColor: '#000000',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          cornerRadius: 0,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#000000', font: { family: 'Inter', size: 9 } },
        },
        y: {
          grid: { color: '#e4e4e7' },
          ticks: { color: '#000000', font: { family: 'Inter', size: 9 } },
        },
      },
    }
  }
};
