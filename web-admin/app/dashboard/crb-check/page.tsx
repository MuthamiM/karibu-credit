'use client';

import { useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type CRBResult = {
  national_id: string;
  score: number;
  grading: string;
  listings: number;
  amount_listed: string;
  report_id: string;
  timestamp: string;
};

export default function CRBCheckPage() {
  const [crbId, setCrbId] = useState('');
  const [crbResult, setCrbResult] = useState<CRBResult | null>(null);
  const [crbLoading, setCrbLoading] = useState(false);
  const [error, setError] = useState('');

  // Underwriter Inputs
  const [principal, setPrincipal] = useState(150000);
  const [income, setIncome] = useState(45000);
  const [debts, setDebts] = useState(10000);
  const [collateral, setCollateral] = useState(250000);
  const [interestRate, setInterestRate] = useState(12.5);
  const [tenureMonths, setTenureMonths] = useState(12);

  const queryCrb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crbId) return;
    setCrbLoading(true);
    setError('');
    setCrbResult(null);

    try {
      const data = await fetchApi('/loans/crb-check', {
        method: 'POST',
        body: JSON.stringify({ national_id: crbId })
      });
      setCrbResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to perform CRB query');
    } finally {
      setCrbLoading(false);
    }
  };

  // ── Financial Underwriting Risk Logic ──────────────────────────────────────
  const monthlyRate = (interestRate || 0) / 100 / 12;
  const emi = monthlyRate === 0 
    ? (principal / tenureMonths) 
    : (principal * (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1));

  const disposableIncome = Math.max(0, income - debts);
  const dscr = emi > 0 ? (disposableIncome / emi) : 0;
  const ltv = collateral > 0 ? (principal / collateral) * 100 : 100;

  // Composite Credit Index (CCI) Score calculation (0 to 100)
  let cci = 0;
  let crbContrib = 0;
  let dscrContrib = 0;
  let ltvContrib = 0;

  if (crbResult) {
    // Normalise CRB Score (450 to 800)
    crbContrib = Math.max(0, Math.min(100, ((crbResult.score - 400) / 400) * 100));
    // Normalise DSCR (0 to 2.5)
    dscrContrib = Math.max(0, Math.min(100, (dscr / 2.0) * 100));
    // Normalise LTV (0% to 150%) - lower is better
    ltvContrib = Math.max(0, Math.min(100, (Math.max(0, 150 - ltv) / 150) * 100));

    // Weighted Contribution: 40% CRB, 35% DSCR, 25% LTV
    cci = Math.round((crbContrib * 0.40) + (dscrContrib * 0.35) + (ltvContrib * 0.25));
  }

  // Underwriting Decision Output
  let decision = 'DECLINED';
  let decisionText = '';
  let decisionClass = THEME.classes.badgeOutline;
  let decisionBg = '#fee2e2';

  if (crbResult) {
    if (crbResult.listings > 0) {
      decision = 'DECLINED';
      decisionText = `Underwriting Rejected: Applicant has ${crbResult.listings} active listings in Credit Reference Bureau totaling ${crbResult.amount_listed}. Cleared credit registry certificate required.`;
      decisionBg = '#fee2e2';
    } else if (cci >= 70 && dscr >= 1.25 && ltv <= 80) {
      decision = 'APPROVED';
      decisionText = 'Underwriting Approved: Client meets all risk-mitigation profiles. Primary repayment coverage (DSCR) is secure and LTV has strong asset coverage.';
      decisionClass = THEME.classes.badgeFilled;
      decisionBg = '#dcfce7';
    } else if (cci >= 50 && dscr >= 1.0) {
      decision = 'CONDITIONALLY APPROVED';
      decisionText = `Underwriting Conditionally Approved: (1) Reduce principal to KES ${Math.round(principal * 0.8).toLocaleString()} to lower LTV, OR (2) Increase tenure to ${Math.round(tenureMonths * 1.5)} months to improve DSCR to ${Math.round(dscr * 1.2 * 100) / 100}, OR (3) File a corporate cash guarantor bond.`;
      decisionBg = '#fef9c3';
    } else {
      decision = 'DECLINED';
      decisionText = `Underwriting Declined: Risk Index of ${cci}/100 is too low. Debt Service Coverage of ${dscr.toFixed(2)}x is below the acceptable threshold.`;
      decisionBg = '#fee2e2';
    }
  }

  // ── Executive Appraisal PDF Exporter ───────────────────────────────────────
  const downloadAppraisalPDF = () => {
    if (!crbResult) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Boarder
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 42, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('KARIBU CREDIT LTD.', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('AI Underwriter Credit Appraisal & Risk Report', 14, 26);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Report Reference: APP_REP_${crbResult.report_id} | Issued: ${new Date().toLocaleString()}`, 14, 34);

    // Section Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('1. APPLICANT & CRB CREDIT RECORD', 14, 52);

    // CRB Table
    autoTable(doc, {
      startY: 56,
      head: [['Metric', 'Report Value', 'Risk Grading']],
      body: [
        ['National Identification Code', crbResult.national_id, 'Verified ID'],
        ['CRB Credit Score', `${crbResult.score} / 900`, crbResult.grading],
        ['Negative Registry Listings', `${crbResult.listings} Active Listings`, crbResult.listings > 0 ? 'FAIL' : 'PASS'],
        ['Outstanding Listed Debts', crbResult.amount_listed, crbResult.listings > 0 ? 'HIGH RISK' : 'SECURE'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    // Section 2: Financial Assessment
    const startY2 = (doc as any).lastAutoTable.finalY + 10;
    doc.text('2. UNDERWRITING CAPITAL EVALUATION', 14, startY2);

    autoTable(doc, {
      startY: startY2 + 4,
      head: [['Key Indicator', 'Appraisal Parameter', 'Calculated Value', 'Compliance Target']],
      body: [
        ['Principal Capital Requested', `KES ${principal.toLocaleString()}`, `EMI: KES ${Math.round(emi).toLocaleString()}`, 'Tenure: ' + tenureMonths + ' Months'],
        ['Debt Service Coverage (DSCR)', `Income: KES ${income.toLocaleString()} | Debt: KES ${debts.toLocaleString()}`, `${dscr.toFixed(2)}x Ratio`, 'Target: >= 1.25x'],
        ['Loan-To-Value Ratio (LTV)', `Collateral Valuation: KES ${collateral.toLocaleString()}`, `${ltv.toFixed(1)}% Ratio`, 'Target: <= 80.0%'],
        ['Composite Credit Index (CCI)', 'Weighted Score', `${cci} / 100`, 'Target: >= 50 / 100'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    // Section 3: Recommendation Block
    const startY3 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFillColor(245, 245, 245);
    doc.rect(14, startY3, pageWidth - 28, 32, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('3. APPRAISER AUDIT DECISION', 18, startY3 + 8);
    
    doc.setFontSize(12);
    doc.setTextColor(decision === 'APPROVED' ? 0 : decision === 'DECLINED' ? 150 : 80, 0, 0);
    doc.text(decision, 18, startY3 + 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const splitText = doc.splitTextToSize(decisionText, pageWidth - 36);
    doc.text(splitText, 18, startY3 + 21);

    // Signatures
    const startY4 = startY3 + 42;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, startY4 + 10, 80, startY4 + 10);
    doc.line(pageWidth - 80, startY4 + 10, pageWidth - 14, startY4 + 10);

    doc.setFontSize(7);
    doc.text('Prepared by: AI Underwriter Copilot', 14, startY4 + 14);
    doc.text('Reviewed by: Risk & Treasury Committee', pageWidth - 80, startY4 + 14);

    doc.save(`Karibu_Appraisal_Report_${crbResult.national_id}.pdf`);
  };

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ borderBottom: '1px solid #000', paddingBottom: '1rem' }}>
        <p className={THEME.classes.subtitle}>Underwriting Workbench</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>Credit Appraisal &amp; Risk Assessment Board</h2>
        <p className={THEME.classes.textMuted} style={{ textTransform: 'none', fontSize: '11px', lineHeight: 1.6, marginTop: 4 }}>
          Evaluate applicant creditworthiness using live Credit Reference Bureau queries combined with loan servicing ratios, asset collateral coverage, and weighted debt indexing.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Form: Inputs & Query */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Query section */}
          <form onSubmit={queryCrb} className={THEME.classes.card} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className={THEME.classes.sectionTitle}>1. CRB Registry Query</h3>
            <div>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 }}>Applicant National ID / Passport</label>
              <input
                type="text"
                value={crbId}
                onChange={(e) => setCrbId(e.target.value)}
                className={THEME.classes.input}
                placeholder="e.g. 32904589"
                required
              />
            </div>
            {error && <div style={{ fontSize: '10px', color: '#b91c1c', fontFamily: 'monospace' }}> {error}</div>}
            <button
              type="submit"
              disabled={crbLoading}
              className={THEME.classes.btnPrimary}
              style={{ width: '100%' }}
            >
              {crbLoading ? 'Pinging Credit Registry...' : 'Retrieve CRB Record'}
            </button>
          </form>

          {/* Underwriting Parameters */}
          <div className={THEME.classes.card} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className={THEME.classes.sectionTitle}>2. Loan Underwriting Metrics</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Requested Loan (KES)</label>
                <input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
                  className={THEME.classes.input}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Collateral Valuation (KES)</label>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(parseFloat(e.target.value) || 0)}
                  className={THEME.classes.input}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Monthly Income (KES)</label>
                <input
                  type="number"
                  value={income}
                  onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
                  className={THEME.classes.input}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Monthly External Debts (KES)</label>
                <input
                  type="number"
                  value={debts}
                  onChange={(e) => setDebts(parseFloat(e.target.value) || 0)}
                  className={THEME.classes.input}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
                  className={THEME.classes.input}
                  step="0.1"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}>Tenure (Months)</label>
                <input
                  type="number"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(parseInt(e.target.value) || 1)}
                  className={THEME.classes.input}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Form: Recommendation & Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className={THEME.classes.card} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <h3 className={THEME.classes.sectionTitle} style={{ borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Appraisal Analytics</h3>
              
              {!crbResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', color: '#71717a', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2rem' }}></span>
                  <p className={THEME.classes.textMuted} style={{ textTransform: 'none' }}>Perform a CRB Query first to run underwriting calculations.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontFamily: 'monospace', fontSize: '11px' }}>
                  
                  {/* CRB Score Row */}
                  <div style={{ borderBottom: '1px solid #f4f4f5', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#71717a' }}>CRB CREDIT SCORE</span>
                      <span style={{ fontWeight: 'bold' }}>{crbResult.score} / 900 ({crbResult.grading})</span>
                    </div>
                    <div style={{ height: 6, background: '#e4e4e7', width: '100%' }}>
                      <div style={{ height: '100%', background: '#000', width: `${((crbResult.score - 300) / 600) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* DSCR Row */}
                  <div style={{ borderBottom: '1px solid #f4f4f5', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#71717a' }}>DEBT SERVICE COVERAGE (DSCR)</span>
                      <span style={{ fontWeight: 'bold', color: dscr >= 1.25 ? '#16a34a' : dscr >= 1.0 ? '#d97706' : '#dc2626' }}>
                        {dscr.toFixed(2)}x
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#e4e4e7', width: '100%' }}>
                      <div style={{ height: '100%', background: '#000', width: `${Math.min(100, (dscr / 2.0) * 100)}%` }}></div>
                    </div>
                  </div>

                  {/* LTV Row */}
                  <div style={{ borderBottom: '1px solid #f4f4f5', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#71717a' }}>LOAN-TO-VALUE (LTV) RATIO</span>
                      <span style={{ fontWeight: 'bold', color: ltv <= 80 ? '#16a34a' : ltv <= 100 ? '#d97706' : '#dc2626' }}>
                        {ltv.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#e4e4e7', width: '100%' }}>
                      <div style={{ height: '100%', background: '#000', width: `${Math.min(100, ltv)}%` }}></div>
                    </div>
                  </div>

                  {/* Composite Index Row */}
                  <div style={{ borderBottom: '1px solid #f4f4f5', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#71717a' }}>COMPOSITE CREDIT RISK INDEX</span>
                      <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{cci} / 100</span>
                    </div>
                    <div style={{ height: 6, background: '#e4e4e7', width: '100%' }}>
                      <div style={{ height: '100%', background: '#000', width: `${cci}%` }}></div>
                    </div>
                  </div>

                  {/* Underwriter recommendation box */}
                  <div style={{ border: '1px solid #000', padding: '12px', background: decisionBg, marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#000' }}>RECOMMENDATION DECISION</span>
                      <span className={decisionClass}>{decision}</span>
                    </div>
                    <p style={{ textTransform: 'none', fontSize: '11px', lineHeight: 1.5, color: '#000', margin: 0 }}>
                      {decisionText}
                    </p>
                  </div>

                </div>
              )}
            </div>

            {crbResult && (
              <button
                type="button"
                onClick={downloadAppraisalPDF}
                className={THEME.classes.btnPrimary}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                📥 Download appraisal report pdf
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
