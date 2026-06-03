'use client';

import { useState, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScheduleLine {
  month: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  remainingBalance: number;
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AmortizationPage() {
  const [calculator, setCalculator] = useState({
    principal: 250000,
    rate: 12.5,
    months: 12,
  });

  const schedule = useMemo(() => {
    const p = calculator.principal || 0;
    const annualRate = calculator.rate || 0;
    const m = calculator.months || 1;
    const monthlyRate = annualRate / 100 / 12;

    const lines: ScheduleLine[] = [];
    let totalInterest = 0;
    let totalPrincipalPaid = 0;

    if (monthlyRate === 0) {
      // Zero-interest: simple division
      const monthlyPrincipal = p / m;
      let remaining = p;
      for (let i = 1; i <= m; i++) {
        remaining -= monthlyPrincipal;
        if (i === m) remaining = 0;
        lines.push({
          month: i,
          principalDue: Math.round(monthlyPrincipal * 100) / 100,
          interestDue: 0,
          totalDue: Math.round(monthlyPrincipal * 100) / 100,
          remainingBalance: Math.round(remaining * 100) / 100,
        });
        totalPrincipalPaid += monthlyPrincipal;
      }
    } else {
      // EMI (reducing balance)
      const emi = p * (monthlyRate * Math.pow(1 + monthlyRate, m)) / (Math.pow(1 + monthlyRate, m) - 1);
      let remaining = p;

      for (let i = 1; i <= m; i++) {
        const interestPayment = remaining * monthlyRate;
        let principalPayment = emi - interestPayment;

        remaining -= principalPayment;
        if (i === m) {
          principalPayment += remaining;
          remaining = 0;
        }

        totalInterest += interestPayment;
        totalPrincipalPaid += principalPayment;

        lines.push({
          month: i,
          principalDue: Math.round(principalPayment * 100) / 100,
          interestDue: Math.round(interestPayment * 100) / 100,
          totalDue: Math.round(emi * 100) / 100,
          remainingBalance: Math.max(0, Math.round(remaining * 100) / 100),
        });
      }
    }

    const totalPayable = p + totalInterest;
    const monthlyInstallment = totalPayable / m;

    return {
      lines,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      monthlyInstallment: Math.round(monthlyInstallment * 100) / 100,
    };
  }, [calculator]);

  // ---- CSV Export ----
  const handleExportCSV = useCallback(() => {
    const headers = ['Month', 'Principal (KES)', 'Interest (KES)', 'EMI Payment (KES)', 'Remaining Balance (KES)'];
    const rows = schedule.lines.map((l) => [
      l.month,
      l.principalDue.toFixed(2),
      l.interestDue.toFixed(2),
      l.totalDue.toFixed(2),
      l.remainingBalance.toFixed(2),
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['', 'Total Principal', 'Total Interest', 'Total Payable', '']);
    rows.push([
      '',
      calculator.principal.toFixed(2),
      schedule.totalInterest.toFixed(2),
      schedule.totalPayable.toFixed(2),
      '',
    ]);

    const csvContent = [
      `Karibu Credit — Amortization Schedule`,
      `Principal: KES ${calculator.principal.toLocaleString()} | Rate: ${calculator.rate}% p.a. | Duration: ${calculator.months} months`,
      `Generated: ${new Date().toLocaleDateString('en-KE')}`,
      '',
      headers.join(','),
      ...rows.map((r) => (r as (string | number)[]).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `karibu_amortization_${calculator.principal}_${calculator.months}mo.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [schedule, calculator]);

  // ---- PDF Export ----
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Header bar ──
    doc.setFillColor(15, 15, 25);
    doc.rect(0, 0, pageWidth, 38, 'F');

    doc.setFillColor(217, 119, 6); // amber accent line
    doc.rect(0, 38, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('KARIBU CREDIT', 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 190);
    doc.text('Amortization Schedule Report', 14, 24);

    doc.setFontSize(8);
    doc.setTextColor(140, 140, 155);
    doc.text(`Generated: ${new Date().toLocaleString('en-KE')}`, 14, 32);

    // ── Loan Parameters Box ──
    const boxY = 46;
    doc.setFillColor(245, 245, 248);
    doc.roundedRect(14, boxY, pageWidth - 28, 24, 3, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 115);

    const col1 = 20;
    const col2 = 70;
    const col3 = 125;

    doc.text('PRINCIPAL AMOUNT', col1, boxY + 8);
    doc.text('ANNUAL INTEREST RATE', col2, boxY + 8);
    doc.text('LOAN DURATION', col3, boxY + 8);

    doc.setFontSize(12);
    doc.setTextColor(15, 15, 25);
    doc.text(formatKES(calculator.principal), col1, boxY + 17);
    doc.text(`${calculator.rate}% p.a.`, col2, boxY + 17);
    doc.text(`${calculator.months} months`, col3, boxY + 17);

    // ── Summary Metrics ──
    const summY = boxY + 32;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 115);

    doc.text('MONTHLY INSTALLMENT (EMI)', col1, summY);
    doc.text('TOTAL INTEREST', col2, summY);
    doc.text('TOTAL PAYABLE', col3, summY);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6);
    doc.text(formatKES(schedule.monthlyInstallment), col1, summY + 8);
    doc.setTextColor(220, 50, 70);
    doc.text(formatKES(schedule.totalInterest), col2, summY + 8);
    doc.setTextColor(15, 15, 25);
    doc.text(formatKES(schedule.totalPayable), col3, summY + 8);

    // ── Schedule Table ──
    const tableBody = schedule.lines.map((l) => [
      String(l.month),
      formatKES(l.principalDue),
      formatKES(l.interestDue),
      formatKES(l.totalDue),
      formatKES(l.remainingBalance),
    ]);

    autoTable(doc, {
      startY: summY + 16,
      head: [['Month', 'Principal', 'Interest', 'EMI Payment', 'Remaining Balance']],
      body: tableBody,
      foot: [[
        'TOTAL',
        formatKES(calculator.principal),
        formatKES(schedule.totalInterest),
        formatKES(schedule.totalPayable),
        formatKES(0),
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [15, 15, 25],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 30, 45],
        halign: 'right',
      },
      footStyles: {
        fillColor: [245, 245, 248],
        textColor: [15, 15, 25],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      margin: { left: 14, right: 14 },
      styles: {
        cellPadding: 3,
        lineColor: [220, 220, 228],
        lineWidth: 0.2,
      },
    });

    // ── Footer ──
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(15, 15, 25);
      doc.rect(0, pageH - 12, pageWidth, 12, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 140, 155);
      doc.text('Karibu Credit Ltd. — Confidential', 14, pageH - 4);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageH - 4, { align: 'right' });
    }

    doc.save(`Karibu_Amortization_${calculator.principal}_${calculator.months}mo.pdf`);
  }, [schedule, calculator]);

  return (
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Loan Analytics</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Interactive Amortization &amp; Schedule Exporter</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Perform dry run calculations for repayment cycles, view immediate yields, and download structured schedules.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-5 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white">Yield Parameters</h3>
          
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Principal (KES)</label>
            <input
              type="number"
              value={calculator.principal}
              onChange={(e) => setCalculator({ ...calculator, principal: parseFloat(e.target.value) || 0 })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Annual Interest Rate (%)</label>
            <input
              type="number"
              value={calculator.rate}
              onChange={(e) => setCalculator({ ...calculator, rate: parseFloat(e.target.value) || 0 })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              step="0.1"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Loan Duration (Months)</label>
            <input
              type="number"
              value={calculator.months}
              onChange={(e) => setCalculator({ ...calculator, months: parseInt(e.target.value) || 1 })}
              className="premium-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              required
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Calculated Financial Summary</h3>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Installment / Mo</span>
                <p className="mt-1 text-xl font-bold text-amber-400">KES {Math.round(schedule.monthlyInstallment).toLocaleString()}</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cumulative Interest</span>
                <p className="mt-1 text-xl font-bold text-red-600">KES {Math.round(schedule.totalInterest).toLocaleString()}</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Payable</span>
                <p className="mt-1 text-xl font-bold text-white">KES {Math.round(schedule.totalPayable).toLocaleString()}</p>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="mt-6 max-h-[280px] overflow-y-auto rounded-xl border border-white/5">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-black/60 backdrop-blur-sm">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 text-center font-bold">#</th>
                    <th className="py-2.5 px-3 text-right font-bold">Principal</th>
                    <th className="py-2.5 px-3 text-right font-bold">Interest</th>
                    <th className="py-2.5 px-3 text-right font-bold">EMI</th>
                    <th className="py-2.5 px-3 text-right font-bold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {schedule.lines.map((line) => (
                    <tr key={line.month} className="text-slate-300 hover:bg-white/[0.03] transition-colors">
                      <td className="py-2 px-3 text-center text-slate-500 font-medium">{line.month}</td>
                      <td className="py-2 px-3 text-right">{line.principalDue.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right text-red-600/80">{line.interestDue.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right font-medium text-amber-400/80">{line.totalDue.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right">{line.remainingBalance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-300 transition-all duration-200"
            >
              Export CSV Schedule
            </button>
            <button
              onClick={handleExportPDF}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all duration-200"
            >
              Download Amortization PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
