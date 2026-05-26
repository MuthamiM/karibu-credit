'use client';

import { useState } from 'react';

type KanbanCard = {
  id: string;
  borrower: string;
  amount: number;
  daysOverdue: number;
  officer: string;
};

export default function CollectionsPage() {
  const [kanbanData, setKanbanData] = useState<Record<string, KanbanCard[]>>({
    '1-30': [
      { id: 'KB-1', borrower: 'Grace Mwangi', amount: 15000, daysOverdue: 14, officer: 'James N.' },
      { id: 'KB-2', borrower: 'John Kamau', amount: 4500, daysOverdue: 8, officer: 'Sarah O.' },
    ],
    '31-60': [
      { id: 'KB-3', borrower: 'Hassan Ibrahim', amount: 35000, daysOverdue: 42, officer: 'James N.' },
    ],
    '60+': [
      { id: 'KB-4', borrower: 'Mercy Achieng', amount: 110000, daysOverdue: 75, officer: 'Recovery Unit' },
    ],
  });

  const moveCard = (cardId: string, fromCol: string, toCol: string) => {
    const card = kanbanData[fromCol].find((c) => c.id === cardId);
    if (!card) return;

    setKanbanData((prev) => {
      const nextSource = prev[fromCol].filter((c) => c.id !== cardId);
      const nextDest = [...prev[toCol], card];
      return {
        ...prev,
        [fromCol]: nextSource,
        [toCol]: nextDest,
      };
    });
  };

  return (
    <div className="glass-panel rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Recovery Workflow</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Collections & Overdue Arrears Board</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Visual pipeline classifying defaulted accounts by days overdue. Drag-and-drop or select commands to reassign to collections officers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Column 1: 1-30 Days */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
            <span className="text-xs font-bold text-slate-300">1 - 30 Days Arrears</span>
            <span className="rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5 text-[10px] font-bold">
              {kanbanData['1-30'].length}
            </span>
          </div>
          {kanbanData['1-30'].map((card) => (
            <div key={card.id} className="rounded-xl border border-white/5 bg-[#0b0e1b] p-3 text-xs space-y-2 hover:border-amber-500/20 transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-white">{card.borrower}</span>
                <span className="text-[10px] text-slate-500 font-mono">#{card.id}</span>
              </div>
              <div className="text-slate-400 font-medium">Outstanding: KES {card.amount.toLocaleString()}</div>
              <div className="text-[10px] text-rose-400 font-bold">{card.daysOverdue} Days Past Due</div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                <span className="text-[10px] text-slate-500">Agent: {card.officer}</span>
                <button
                  onClick={() => moveCard(card.id, '1-30', '31-60')}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Escalate →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Column 2: 31-60 Days */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
            <span className="text-xs font-bold text-slate-300">31 - 60 Days Arrears</span>
            <span className="rounded-full bg-desert-500/10 text-desert-500 px-2 py-0.5 text-[10px] font-bold">
              {kanbanData['31-60'].length}
            </span>
          </div>
          {kanbanData['31-60'].map((card) => (
            <div key={card.id} className="rounded-xl border border-white/5 bg-[#0b0e1b] p-3 text-xs space-y-2 hover:border-desert-500/20 transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-white">{card.borrower}</span>
                <span className="text-[10px] text-slate-500 font-mono">#{card.id}</span>
              </div>
              <div className="text-slate-400 font-medium">Outstanding: KES {card.amount.toLocaleString()}</div>
              <div className="text-[10px] text-rose-400 font-bold">{card.daysOverdue} Days Past Due</div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                <span className="text-[10px] text-slate-500">Agent: {card.officer}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveCard(card.id, '31-60', '1-30')}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => moveCard(card.id, '31-60', '60+')}
                    className="text-[10px] font-bold text-desert-500 hover:text-desert-400 transition-colors"
                  >
                    Escalate →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: 60+ Days */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
            <span className="text-xs font-bold text-slate-300">60+ Days (Legal/Recovery)</span>
            <span className="rounded-full bg-rose-500/10 text-rose-500 px-2 py-0.5 text-[10px] font-bold">
              {kanbanData['60+'].length}
            </span>
          </div>
          {kanbanData['60+'].map((card) => (
            <div key={card.id} className="rounded-xl border border-white/5 bg-[#0b0e1b] p-3 text-xs space-y-2 hover:border-rose-500/20 transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-white">{card.borrower}</span>
                <span className="text-[10px] text-slate-500 font-mono">#{card.id}</span>
              </div>
              <div className="text-slate-400 font-medium">Outstanding: KES {card.amount.toLocaleString()}</div>
              <div className="text-[10px] text-rose-400 font-bold">{card.daysOverdue} Days Past Due</div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase text-rose-500">Legal/CRB</span>
                <button
                  onClick={() => moveCard(card.id, '60+', '31-60')}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-400 transition-colors"
                >
                  ← De-escalate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
