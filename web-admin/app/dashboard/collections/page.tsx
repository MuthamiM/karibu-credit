'use client';

import { useState } from 'react';
import { THEME } from '@/theme';

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

  const columns = [
    { key: '1-30', label: '1 – 30 Days Arrears', next: '31-60', prev: null },
    { key: '31-60', label: '31 – 60 Days Arrears', next: '60+', prev: '1-30' },
    { key: '60+', label: '60+ Days (Legal/Recovery)', next: null, prev: '31-60' },
  ];

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <p className={THEME.classes.subtitle}>Recovery Workflow</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>Collections & Overdue Arrears Board</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Visual pipeline classifying defaulted accounts by days overdue. Select commands to reassign to collections officers.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {columns.map((col) => (
          <div key={col.key} style={{ border: '1px solid #000', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #e4e4e7' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
              <span className={THEME.classes.badgeFilled}>{kanbanData[col.key].length}</span>
            </div>

            {kanbanData[col.key].map((card) => (
              <div key={card.id} style={{ border: '1px solid #e4e4e7', padding: '0.75rem', fontSize: '0.6875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700 }}>{card.borrower}</span>
                  <span style={{ fontSize: '0.625rem', color: '#71717a', fontFamily: 'monospace' }}>#{card.id}</span>
                </div>
                <div style={{ color: '#71717a' }}>Outstanding: KES {card.amount.toLocaleString()}</div>
                <div style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.daysOverdue} Days Past Due</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.375rem', borderTop: '1px solid #e4e4e7', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.625rem', color: '#71717a' }}>Agent: {card.officer}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {col.prev && (
                      <button
                        onClick={() => moveCard(card.id, col.key, col.prev!)}
                        style={{ fontSize: '0.625rem', fontWeight: 700, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ← De-escalate
                      </button>
                    )}
                    {col.next && (
                      <button
                        onClick={() => moveCard(card.id, col.key, col.next!)}
                        style={{ fontSize: '0.625rem', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Escalate →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
