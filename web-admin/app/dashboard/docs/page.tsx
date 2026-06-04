'use client';

import { useState } from 'react';
import { THEME } from '@/theme';

type Step = {
  title: string;
  actor: string;
  description: string;
};

type FlowData = {
  title: string;
  badge: string;
  badgeType: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  overview: string;
  steps: Step[];
  mermaid: string;
};

const FLOWS: Record<string, FlowData> = {
  origination: {
    title: 'Loan Application & Disbursement',
    badge: 'Dual Flow',
    badgeType: 'brand',
    overview: 'Handles customer or admin applications. The system branches depending on whether the loan requires a single lump-sum payout or stage-wise tranches (disbursed incrementally based on project progress).',
    steps: [
      { title: 'Apply', actor: 'Borrower / Admin', description: 'Initiates loan request via POST /api/v1/loans/apply (Amount, Type, Disbursement Method).' },
      { title: 'Pending Review', actor: 'System', description: 'The loan is saved in the database with status = PENDING. An application reference (LAF-XXX) is returned.' },
      { title: 'Evaluation & Appraisal', actor: 'Loan Officer', description: 'The officer reviews the borrower profile, credit scores, and appraisal checklists, then calls POST /loans/{id}/approve.' },
      { title: 'Amortization Recalculation', actor: 'Loan Engine', description: 'Calculates the schedule (Flat or Reducing Balance), creating RepaymentSchedule entries and setting due dates.' },
      { title: 'Disbursement Branching', actor: 'KCB B2C Gateway', description: 'For LUMP_SUM loans, it automatically dispatches full principal via KCB API. For STAGE_WISE, it sets status = APPROVED, waiting for Finance to trigger manual tranches.' }
    ],
    mermaid: `sequenceDiagram
    actor Customer
    actor Officer as Loan Officer
    actor Finance
    participant API as Karibu API
    participant DB as PostgreSQL Database
    participant KCB as KCB B2C/B2B Gateway

    Customer->>API: POST /apply (Amount, Type, Disbursement Method)
    API->>DB: Save Loan (status=PENDING)
    API-->>Customer: Returns Loan Ticket

    Officer->>API: GET /loans?status_filter=PENDING
    Officer->>API: POST /{id}/approve
    API->>DB: Set schedule, total_payable, due_date

    alt Request is LUMP_SUM
        API->>KCB: Trigger Full Payout
        KCB-->>API: Success Response & Tran. Ref
        API->>DB: Status=DISBURSED, Record Transaction
        API-->>Officer: Approved & Disbursed!
    else Request is STAGE_WISE or PARTIAL
        API->>DB: Status=APPROVED (Hold Funds)
        API-->>Officer: Approved! Waiting for Tranche Release.
        Note over Finance, API: Later, as project phases complete...
        Finance->>API: POST /{id}/disburse_tranche (Tranche Amount)
        API->>KCB: Trigger Partial Payout
        KCB-->>API: Success Response & Tran. Ref
        API->>DB: Record Transaction, Increment amount_disbursed
        
        alt amount_disbursed == principal_amount
            API->>DB: Status=DISBURSED
        else amount_disbursed < principal_amount
            API->>DB: Status=PARTIALLY_DISBURSED
        end
        API-->>Finance: Tranche Payout Successful!
    end`
  },
  repayment: {
    title: 'M-Pesa Webhook & Auto-Clearing',
    badge: 'Automated',
    badgeType: 'success',
    overview: 'Integrates Safaricom Daraja API C2B webhooks. Once cash is deposited, the system validates the reference and automatically allocates funds across fees, penalties, interest, and principal.',
    steps: [
      { title: 'MPESA Paybill', actor: 'Borrower', description: 'Makes a payment via M-Pesa using the Paybill number and inputs the Loan ID as the Account Number.' },
      { title: 'C2B Validation Hook', actor: 'Safaricom Webhook', description: 'Safaricom posts validation requests to /api/v1/webhooks/mpesa/validation. The system verifies the Loan ID is active.' },
      { title: 'C2B Confirmation Hook', actor: 'Safaricom Webhook', description: 'Safaricom confirms the transfer via /webhooks/mpesa/confirmation. The API begins processing repayment allocation.' },
      { title: 'Repayment Allocation', actor: 'Repayment Engine', description: 'Applies payment to unpaid schedules: first paying off fee/penalty balances, then interest, and finally principal.' },
      { title: 'Auto-Clearing Check', actor: 'System', description: 'If the total paid equals or exceeds the total payable, the loan status is updated to CLEARED. Commit is finalized.' }
    ],
    mermaid: `sequenceDiagram
    actor Customer
    participant MPesa as Safaricom M-Pesa
    participant API as Karibu API
    participant DB as PostgreSQL Database

    Customer->>MPesa: Pays via C2B Paybill (Account = Loan ID)
    
    MPesa->>API: POST /mpesa/c2b/validation
    API-->>MPesa: { "ResultCode": 0, "ResultDesc": "Accepted" }
    
    Note over MPesa, API: Safaricom processes the cash transfer internally...
    
    MPesa->>API: POST /mpesa/c2b/confirmation (JSON Payload)
    API->>DB: Find Loan linking to (Account Ref / Loan ID)
    API->>DB: Record Repayment Transaction
    API->>DB: loan.total_paid += M-Pesa Amount
    
    alt total_paid >= (total_payable + penalty_balance)
        API->>DB: Status = CLEARED
    end
    
    API->>DB: Commit DB Session
    API-->>MPesa: { "ResultCode": 0, "ResultDesc": "Success" }`
  },
  penalties: {
    title: 'Nightly Penalties & Defaults Cron',
    badge: 'Cron Job',
    badgeType: 'danger',
    overview: 'Runs silently at midnight. Scans the loan ledger to identify active loans past their due dates, charges a one-time 10% penalty fee, and transitions the accounts to DEFAULTED.',
    steps: [
      { title: 'Midnight Trigger', actor: 'Cron Daemon', description: 'A daily cron job executes python scripts/daily_penalties.py at 00:00 EAT.' },
      { title: 'Ledger Query', actor: 'System', description: 'Queries the database for loans in status = ACTIVE or DISBURSED where due_date < current_date.' },
      { title: 'Grace Period Check', actor: 'Policy Engine', description: 'Verifies if the loan exceeds the configured grace period (default 3 days).' },
      { title: 'Charge Penalty', actor: 'Loan Ledger', description: 'Applies a one-time 10% penalty fee on the outstanding balance, updating the penalty_balance.' },
      { title: 'Status Transition', actor: 'Database', description: 'Marks the loan as DEFAULTED, records the penalty in the transaction log, and fires SMS alert.' }
    ],
    mermaid: `flowchart TD
    Start((Midnight<br/>Cron Trigger)) --> Fetch[Query DB: <br/>Active Loans past due_date]
    Fetch --> Check{Are there<br/>overdue loans?}
    
    Check -- Yes --> Loop[Loop through each Loan]
    Check -- No --> End((Sleep until tomorrow))
    
    Loop --> Calc[Calc: Outstanding Balance<br/>(payable - paid + penalties)]
    Calc --> IsOwed{Outstanding > 0?}
    
    IsOwed -- Yes --> ApplyPen[Apply 10% Penalty Fee]
    ApplyPen --> SetDef[Change Status to DEFAULTED]
    SetDef --> SaveRecord[(Save Transaction to DB)]
    SaveRecord --> Next[Next Loan]
    
    IsOwed -- No --> Next
    Next -.-> Loop`
  },
  topup: {
    title: 'Loan Top-Up & Recalculation',
    badge: 'Eligibility Restricted',
    badgeType: 'warning',
    overview: 'Enables active borrowers with strong repayment histories (at least 50% paid) to request additional principal. It closes old schedules, merges outstanding balances, and designs a brand new schedule.',
    steps: [
      { title: 'Top-Up Request', actor: 'Borrower / Officer', description: 'Officer files top-up terms (amount, extra tenure) via POST /loans/{id}/top-up.' },
      { title: 'Eligibility Check', actor: 'Verification Engine', description: 'Enforces that the loan is active and the client has repaid at least 50% of the total payable.' },
      { title: 'Balance Merger', actor: 'Loan Engine', description: 'Merges the old outstanding balance with the new top-up amount to define the new principal.' },
      { title: 'Schedule Supersession', actor: 'Amortization Engine', description: 'Closes any remaining old installments (marked PAID) and generates a brand new set of installments.' },
      { title: 'Net Disbursement', actor: 'KCB B2C Gateway', description: 'Triggers a KCB API payout for the top-up difference, logging it under transaction logs.' }
    ],
    mermaid: `sequenceDiagram
    actor Officer as Loan Officer
    participant API as Karibu API
    participant Engine as Loan Engine
    participant DB as PostgreSQL Database
    participant KCB as KCB B2C Gateway

    Officer->>API: POST /loans/{id}/top-up (top_up_amount, extra_months)
    API->>DB: Load Loan + Schedule + Product
    API->>API: Check status ∈ {DISBURSED, ACTIVE}
    API->>API: Check total_paid >= 50% of total_payable

    alt Not Eligible
        API-->>Officer: 400 — Insufficient repayment history
    else Eligible
        API->>Engine: Calc new schedule (outstanding + top_up_amount)
        Engine-->>API: New total_payable, EMI, schedule_lines
        API->>DB: Close old schedule lines (mark PAID)
        API->>DB: Insert new schedule lines
        API->>DB: Update loan principal, total_payable, tenure
        API->>DB: Record TOPUP transaction
        API->>DB: Commit
        API-->>Officer: 200 — Top-up applied successfully
    end`
  },
  group: {
    title: 'Group Lending & Joint Liability',
    badge: 'Multi-Borrower',
    badgeType: 'info',
    overview: 'Allows groups of 3-15 members to apply for joint-liability loans. If any member defaults, the remaining members are jointly responsible for covering the outstanding balance.',
    steps: [
      { title: 'Create Group', actor: 'Loan Officer', description: 'Registers the self-help group/sacco (name, description, branch) via POST /groups/create.' },
      { title: 'Onboard Members', actor: 'System', description: 'Joins 3-15 KYC-verified borrowers as Group Members, assigning Chairman/Secretary/Treasurer roles.' },
      { title: 'Group Loan Request', actor: 'Group Chairman', description: 'Submits loan application via POST /groups/apply. The system checks group membership count (min 3).' },
      { title: 'Disbursement Split', actor: 'KCB B2C Gateway', description: 'Once approved, the system splits the principal and disburses equal shares directly to each member\'s account.' },
      { title: 'Joint Collections', actor: 'Collections Board', description: 'Repayments are monitored collectively. If a member defaults, the group dashboard reflects joint liability.' }
    ],
    mermaid: `sequenceDiagram
    actor Officer as Loan Officer
    participant API as Karibu API
    participant DB as PostgreSQL Database
    participant Engine as Loan Engine
    participant KCB as KCB B2C Gateway

    Officer->>API: POST /groups/create (name, description)
    API->>DB: Create LendingGroup (code: GRP-XXX)
    API-->>Officer: Group Created ✓

    loop Add Members (3–15 required)
        Officer->>API: POST /groups/join (group_id, customer_id, role)
        API->>DB: Validate customer exists, check capacity
        API->>DB: Insert GroupMember record
        API-->>Officer: Member Added ✓
    end

    Officer->>API: POST /groups/apply (group_id, principal, rate, tenure)
    API->>DB: Check group has >= 3 active members
    API->>DB: Check no existing active/pending group loans
    API->>Engine: Calculate flat-rate schedule
    Engine-->>API: total_payable, schedule_lines
    API->>DB: Create GroupLoan (status=PENDING)
    API-->>Officer: Application GLA-XXX submitted`
  }
};

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<string>('origination');
  const [copied, setCopied] = useState<boolean>(false);

  const currentFlow = FLOWS[activeTab];

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(currentFlow.mermaid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const badgeStyles: Record<string, string> = {
    brand: THEME.classes.badgeOutline,
    success: THEME.classes.badgeFilled,
    warning: THEME.classes.badgeOutline,
    danger: THEME.classes.badgeFilled,
    info: THEME.classes.badgeOutline,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-black pb-4">
        <p className={THEME.classes.subtitle}>System Blueprint</p>
        <h2 className={THEME.classes.title + " mt-1"}>Flows & Documentation</h2>
        <p className="text-zinc-500 text-xs mt-1">
          Review core backend workflows, database entities, API endpoints, and download the full technical design document.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left/Middle Column (Flow Viewer) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tab buttons */}
          <div className={`${THEME.classes.card} flex flex-wrap gap-2`}>
            {Object.entries(FLOWS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setCopied(false); }}
                className={`flex-1 min-w-[130px] py-2 px-3 text-xs font-mono uppercase font-bold tracking-wider border ${
                  activeTab === key
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-zinc-50'
                }`}
              >
                {value.title.split(' & ')[0]}
              </button>
            ))}
          </div>

          {/* Stepper Card */}
          <div className={THEME.classes.card + " space-y-6"}>
            <div className="flex items-center justify-between border-b border-black pb-3">
              <div>
                <span className={badgeStyles[currentFlow.badgeType]}>
                  {currentFlow.badge}
                </span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-black mt-2">{currentFlow.title}</h3>
              </div>
            </div>

            <p className="text-zinc-500 text-xs leading-relaxed">{currentFlow.overview}</p>

            {/* Stepper list */}
            <div className="space-y-4 pt-2">
              {currentFlow.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-8 h-8 border border-black bg-black text-white flex items-center justify-center text-xs font-bold font-mono">
                      {idx + 1}
                    </div>
                    {idx < currentFlow.steps.length - 1 && (
                      <div className="w-0.5 flex-1 bg-black my-1.5" />
                    )}
                  </div>
                  <div className="border border-black bg-white p-4 flex-1">
                    <div className="flex justify-between items-start gap-3 border-b border-zinc-100 pb-2 mb-2 font-mono uppercase text-[10px]">
                      <h4 className="font-bold text-black">{step.title}</h4>
                      <span className="font-bold text-zinc-400">{step.actor}</span>
                    </div>
                    <p className="text-zinc-500 text-[11px] leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mermaid / Syntax block */}
          <div className={THEME.classes.card + " space-y-4"}>
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-black">Mermaid Diagram Source Code</h4>
              <button
                onClick={handleCopyMermaid}
                className="border border-black bg-white hover:bg-zinc-50 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest text-black"
              >
                {copied ? 'Copied!' : 'Copy Source'}
              </button>
            </div>
            <div className="bg-zinc-50 border border-black p-4 font-mono text-[9px] text-black overflow-x-auto max-h-[300px] leading-relaxed">
              <pre>{currentFlow.mermaid}</pre>
            </div>
          </div>
        </div>

        {/* Right Column (Design Doc Download & References) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Document Download Card */}
          <div className={THEME.classes.card + " space-y-4"}>
            <div className="flex gap-4 border-b border-black pb-3">
              <div className="w-10 h-10 border border-black bg-black text-white flex items-center justify-center font-bold text-xs">
                DOC
              </div>
              <div className="space-y-1 font-mono uppercase">
                <h3 className="text-xs font-bold text-black">Technical Design Document</h3>
                <p className="text-zinc-400 text-[9px]">Microsoft Word (.docx)</p>
              </div>
            </div>

            <p className="text-zinc-500 text-xs leading-relaxed">
              Contains the complete architectural specification, sequence flowcharts, and high-fidelity wireframe mockups.
            </p>

            <div className="border-t border-black/10 pt-3 flex items-center justify-between text-[9px] font-mono uppercase text-zinc-500">
              <span>Size: ~1,001 KB</span>
              <span>Figures: 12 Renders</span>
            </div>

            <a
              href="http://localhost:8000/download-design-docx"
              download
              className={THEME.classes.btnPrimary + " w-full text-center block"}
            >
              Download Design DOCX
            </a>
          </div>

          {/* Database Entities Card */}
          <div className={THEME.classes.card + " space-y-4"}>
            <h3 className={THEME.classes.sectionTitle + " border-b border-black pb-2"}>Core Database Schema</h3>
            
            <div className="space-y-3.5">
              {[
                { name: 'Customer', desc: 'Borrower profiles, KYC verification levels, credit scoring thresholds, and credit limit ceilings.' },
                { name: 'LoanProduct', desc: 'Repayment method rules (reducing vs flat), processing charges, tenure, and collateral requirements.' },
                { name: 'Loan', desc: 'Financial agreement ledger (approved amount, interest rates, balances, and due dates).' },
                { name: 'RepaymentSchedule', desc: 'Detailed amortization logs. Sets principal, interest, and payment status for each installment.' },
                { name: 'Transaction', desc: 'Financial transaction ledger logging disbursements, payments, platform fees, and penalties.' },
                { name: 'LendingGroup', desc: 'Self-help/Sacco entities enforcing joint liability. Restricts loans to groups with >= 3 active members.' }
              ].map((entity, i) => (
                <div key={i} className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 font-mono">
                  <span className="text-xs font-bold text-black uppercase">{entity.name}</span>
                  <p className="text-zinc-500 text-[10px] mt-1 leading-relaxed">{entity.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* API endpoints checklist */}
          <div className={THEME.classes.card + " space-y-4"}>
            <h3 className={THEME.classes.sectionTitle + " border-b border-black pb-2"}>Extended API Reference</h3>
            
            <div className="space-y-3">
              {[
                { method: 'POST', path: '/loans/apply', desc: 'Submit customer loan application.' },
                { method: 'POST', path: '/loans/{id}/approve', desc: 'Approve & disburse loan via KCB.' },
                { method: 'POST', path: '/loans/{id}/top-up', desc: 'Evaluate & recalculate loan top-up.' },
                { method: 'POST', path: '/groups/create', desc: 'Register a new joint liability group.' },
                { method: 'POST', path: '/groups/apply', desc: 'Submit lending group loan application.' },
                { method: 'POST', path: '/webhooks/mpesa/confirmation', desc: 'M-Pesa validation & auto-allocation.' }
              ].map((endpoint, i) => (
                <div key={i} className="flex gap-3 text-[10px] items-start border-b border-zinc-100 pb-2.5 last:border-b-0 last:pb-0 font-mono uppercase">
                  <span className="border border-black bg-black text-white px-1.5 py-0.5 text-[8px] font-bold">
                    {endpoint.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-black text-[9px] block truncate">{endpoint.path}</span>
                    <span className="text-zinc-400 text-[8px] block mt-0.5">{endpoint.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
