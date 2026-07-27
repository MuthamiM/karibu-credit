# Karibu Credit System Flow Diagrams

## 1. Loan Application & Disbursement Flow (Lump Sum vs Stage-wise)
This illustrates the origination logic, showing how the system branches depending on whether the loan requires a single lump-sum payout or stage-wise tranches.

```mermaid
sequenceDiagram
    actor Customer
    actor Officer as Loan Officer
    actor Finance
    participant API as Karibu API
    participant DB as PostgreSQL Database
    participant ZamuPay as ZamuPay Gateway

    Customer->>API: POST /apply (Amount, Type, Disbursement Method)
    API->>DB: Save Loan (status=PENDING)
    API-->>Customer: Returns Loan Ticket

    Officer->>API: GET /loans?status_filter=PENDING
    Officer->>API: POST /{id}/approve
    API->>DB: Set schedule, total_payable, due_date

    alt Request is LUMP_SUM
        API->>ZamuPay: Trigger Full Payout
        ZamuPay-->>API: Success Response & Tran. Ref
        API->>DB: Status=DISBURSED, Record Transaction
        API-->>Officer: Approved & Disbursed!
    else Request is STAGE_WISE or PARTIAL
        API->>DB: Status=APPROVED (Hold Funds)
        API-->>Officer: Approved! Waiting for Tranche Release.
        Note over Finance, API: Later, as project phases complete...
        Finance->>API: POST /{id}/disburse_tranche (Tranche Amount)
        API->>ZamuPay: Trigger Partial Payout
        ZamuPay-->>API: Success Response & Tran. Ref
        API->>DB: Record Transaction, Increment amount_disbursed
        
        alt amount_disbursed == principal_amount
            API->>DB: Status=DISBURSED
        else amount_disbursed < principal_amount
            API->>DB: Status=PARTIALLY_DISBURSED
        end
        API-->>Finance: Tranche Payout Successful!
    end
```

## 2. M-Pesa Repayment & Auto-Clearing Flow
This shows how Safaricom's Daraja API interacts with our webhook endpoints when a customer makes a direct C2B Paybill payment.

```mermaid
sequenceDiagram
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
    API-->>MPesa: { "ResultCode": 0, "ResultDesc": "Success" }
```

## 3. Nightly Penalties & Defaults (Cron Job)
This maps the logic within `scripts/daily_penalties.py` which runs silently at midnight to catch overdue borrowers.

```mermaid
flowchart TD
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
    Next -.-> Loop
```

## 4. Loan Top-Up & Settlement Flow
This shows the lifecycle of a top-up request: eligibility check, balance merge, schedule recalculation, and re-disbursement.

```mermaid
sequenceDiagram
    actor Officer as Loan Officer
    participant API as Karibu API
    participant Engine as Loan Engine
    participant DB as PostgreSQL Database
    participant ZamuPay as ZamuPay Gateway

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
    end
```

## 5. Group Lending Joint Liability Flow
This documents the creation of a lending group, member onboarding, and group loan origination process.

```mermaid
sequenceDiagram
    actor Officer as Loan Officer
    participant API as Karibu API
    participant DB as PostgreSQL Database
    participant Engine as Loan Engine
    participant ZamuPay as ZamuPay Gateway

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
    API-->>Officer: Application GLA-XXX submitted

    Note over Officer, API: After approval, funds are distributed<br/>equally among active group members.<br/>All members are jointly liable.
```

---

## 📄 Technical Design Document

The full technical design document with high-resolution Matplotlib workflow diagrams and dashboard wireframes has been generated:

**File**: [`docs/Karibu_Credit_Technical_Design_v1.docx`](./Karibu_Credit_Technical_Design_v1.docx)

**Contents**:
- 5 Workflow Diagrams (Application, Repayment, Penalties, Top-Up, Group Lending)
- 7 Dashboard Wireframes (CEO, CFO, Branch Manager, Loan Officer, Collections, Compliance, Credit Scoring)

Generated using `scripts/generate_design_docx.py`.
