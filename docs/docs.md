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
