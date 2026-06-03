"""
Karibu Credit — Massive Seed Script (1000 Borrowers)
=====================================================
Creates realistic demo data:
  - 1000 borrower users + customer profiles
  - ~1200 loans across all product types & statuses
  - Repayment schedules, transactions, payments
  - Collateral items for secured loans
  - Group lending groups with members
  - Audit trail entries

Run:  python -m scripts.seed_1000
  OR: venv/Scripts/python.exe scripts/seed_1000.py
"""

import asyncio
import sys
import os
import random
import uuid
from datetime import date, datetime, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base_class import Base
from app.models.user import User, UserRole
from app.models.branch import Branch
from app.models.customer import Customer, Gender, KycStatus
from app.models.loan_product import LoanProduct, ProductType, InterestMethod
from app.models.loan import (
    Loan, LoanStatus, Transaction, TransactionType,
    Collateral, Payment, PaymentSource, PaymentStatus,
    RepaymentSchedule, ScheduleStatus, DisbursementMethod,
)
from app.models.audit_log import AuditLog
from app.models.penalty_setting import PenaltySetting
from app.models.group import LendingGroup, GroupMember, GroupLoan, GroupStatus, GroupMemberRole, GroupLoanStatus

# ─── Kenyan Name Data ────────────────────────────────────────────────────────

FIRST_NAMES_M = [
    "Musa", "James", "Peter", "John", "David", "Samuel", "Joseph", "Daniel",
    "Michael", "Brian", "Kevin", "Dennis", "Patrick", "George", "Martin",
    "Charles", "Paul", "Mark", "Francis", "Stephen", "Andrew", "Emmanuel",
    "Isaac", "Moses", "Collins", "Victor", "Alex", "Felix", "Simon", "Tony",
    "Edwin", "Vincent", "Henry", "Albert", "Robert", "Kenneth", "Lawrence",
    "Amos", "Benson", "Caleb", "Cyrus", "Derrick", "Elijah", "Fredrick",
    "Gilbert", "Humphrey", "Ian", "Japheth", "Kelvin", "Leonard",
]

FIRST_NAMES_F = [
    "Mary", "Grace", "Jane", "Sarah", "Faith", "Joy", "Hope", "Ruth",
    "Esther", "Agnes", "Anne", "Catherine", "Diana", "Elizabeth", "Florence",
    "Gloria", "Hannah", "Irene", "Janet", "Karen", "Lilian", "Margaret",
    "Nancy", "Olive", "Pamela", "Rachel", "Susan", "Teresa", "Violet",
    "Winnie", "Zipporah", "Alice", "Betty", "Charity", "Dorothy", "Eva",
    "Fatuma", "Gladys", "Helen", "Immaculate", "Juliet", "Leah", "Mercy",
    "Nelly", "Purity", "Rose", "Sharon", "Tabitha", "Wanjiku", "Akinyi",
]

LAST_NAMES = [
    "Muthami", "Kiprop", "Ochieng", "Mwangi", "Kamau", "Njoroge", "Wanjiku",
    "Otieno", "Kimani", "Ndung'u", "Muturi", "Kariuki", "Githinji", "Wambui",
    "Kiptoo", "Korir", "Chepkemoi", "Sang", "Rotich", "Langat", "Cheruiyot",
    "Mutua", "Kilonzo", "Musyoka", "Kyalo", "Mwende", "Ngigi", "Wairimu",
    "Nyambura", "Gathoni", "Mbithi", "Nzomo", "Kioko", "Maingi", "Ndirangu",
    "Macharia", "Karanja", "Mugo", "Waweru", "Thuku", "Irungu", "Gichuki",
    "Omondi", "Okoth", "Anyango", "Atieno", "Adhiambo", "Owino", "Were",
    "Wekesa", "Simiyu", "Barasa", "Nyongesa", "Nafula", "Masinde", "Mudavadi",
    "Hassan", "Omar", "Ahmed", "Abdi", "Mohamed", "Ali", "Ibrahim", "Yusuf",
]

LOCATIONS = [
    "Westlands, Nairobi", "Kilimani, Nairobi", "Karen, Nairobi", "Lang'ata, Nairobi",
    "Eastleigh, Nairobi", "Kasarani, Nairobi", "Thika Road, Nairobi", "Embakasi, Nairobi",
    "Nyali, Mombasa", "Likoni, Mombasa", "Bamburi, Mombasa", "Tudor, Mombasa",
    "Milimani, Kisumu", "Kondele, Kisumu", "Obunga, Kisumu", "Mamboleo, Kisumu",
    "Nakuru Town", "Eldoret Central", "Thika Town", "Machakos Town",
    "Nyeri Town", "Meru Town", "Kitale CBD", "Kakamega Town",
]

COLLATERAL_TYPES = [
    ("Car Logbook", 150000, 3500000),
    ("Land Title Deed", 500000, 15000000),
    ("Motorcycle Logbook", 30000, 250000),
    ("House Title Deed", 1000000, 25000000),
    ("Commercial Vehicle Logbook", 500000, 8000000),
    ("Tractor Logbook", 400000, 5000000),
    ("Warehouse Goods", 100000, 2000000),
    ("Equipment & Machinery", 200000, 4000000),
]

LOAN_PURPOSES = [
    "Working capital for retail shop", "Stock purchase for wholesale business",
    "School fees for children", "Home improvement / renovation",
    "Medical emergency expenses", "Vehicle purchase", "Farm inputs and seeds",
    "Wedding expenses", "Debt consolidation", "Business expansion",
    "Market stall construction", "Boda-boda purchase", "Salon equipment",
    "Restaurant startup capital", "Import/export trading", "Poultry farming startup",
    "Dairy farming expansion", "Construction materials purchase",
    "Property development", "Transport business fleet",
]

GROUP_NAMES = [
    "Umoja Self Help Group", "Jikaze Women Group", "Bidii Youth Sacco",
    "Pamoja Traders Group", "Maendeleo Women Sacco", "Hazina Savings Group",
    "Fanaka Business Group", "Tumaini Farmers Coop", "Mshikamano Women Group",
    "Vijana Forward Group", "Wananchi Savings Club", "Amani Traders Sacco",
    "Baraka Women Enterprise", "Furaha Youth Initiative", "Imani Market Women",
    "Kazi Mtaani Sacco", "Neema Self Help", "Shujaa Business Group",
    "Twende Pamoja Sacco", "Upendo Women Group", "Wakulima Coop Society",
]


def random_phone():
    """Generate a random Kenyan phone number."""
    prefixes = ["2547", "2541", "2540"]
    return random.choice(prefixes) + str(random.randint(10000000, 99999999))

def random_national_id():
    return str(random.randint(10000000, 99999999))

def random_kra_pin():
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return random.choice(letters) + str(random.randint(100000000, 999999999)) + random.choice(letters)

def random_date_of_birth():
    start = date(1965, 1, 1)
    end = date(2000, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))

def random_past_date(min_days=7, max_days=365):
    return date.today() - timedelta(days=random.randint(min_days, max_days))

def random_past_datetime(min_days=7, max_days=365):
    d = random_past_date(min_days, max_days)
    return datetime(d.year, d.month, d.day, random.randint(8, 17), random.randint(0, 59))


async def seed():
    print("=" * 70)
    print("   KARIBU CREDIT — MASSIVE SEED (1000 Borrowers)")
    print("=" * 70)
    print(f"\nConnecting to: {settings.SQLALCHEMY_DATABASE_URI}")

    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)

    # Rebuild all tables from scratch
    print("\n[1/8] Rebuilding database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("      ✓ All tables rebuilt successfully.")

    SessionLocal = sessionmaker(
        bind=engine, class_=AsyncSession, autocommit=False, autoflush=False, expire_on_commit=False
    )

    async with SessionLocal() as db:
        # ── 1. BRANCHES ──────────────────────────────────────────────────────
        print("\n[2/8] Seeding branches...")
        branches = [
            Branch(name="Nairobi Head Office", code="NRB-01", location="Upper Hill, Nairobi"),
            Branch(name="Mombasa Branch", code="MSA-01", location="Moi Avenue, Mombasa"),
            Branch(name="Kisumu Branch", code="KSM-01", location="Oginga Odinga Rd, Kisumu"),
            Branch(name="Nakuru Branch", code="NKR-01", location="Kenyatta Ave, Nakuru"),
            Branch(name="Eldoret Branch", code="ELD-01", location="Uganda Rd, Eldoret"),
        ]
        db.add_all(branches)
        await db.commit()
        for b in branches:
            await db.refresh(b)
        branch_ids = [b.id for b in branches]
        print(f"      ✓ {len(branches)} branches created.")

        # ── 2. LOAN PRODUCTS ─────────────────────────────────────────────────
        print("\n[3/8] Seeding loan products...")
        products = [
            LoanProduct(name="Logbook Loan", type=ProductType.LOGBOOK,
                        min_amount=50000, max_amount=5000000, interest_rate_monthly=3.5,
                        interest_method=InterestMethod.REDUCING_BALANCE,
                        min_tenure_months=1, max_tenure_months=24,
                        processing_fee_pct=3.0, requires_collateral=True, insurance_required=True, is_active=True),
            LoanProduct(name="Business / SME Loan", type=ProductType.SME,
                        min_amount=10000, max_amount=5000000, interest_rate_monthly=4.0,
                        interest_method=InterestMethod.REDUCING_BALANCE,
                        min_tenure_months=1, max_tenure_months=36,
                        processing_fee_pct=2.5, requires_collateral=True, insurance_required=True, is_active=True),
            LoanProduct(name="Salary Loan", type=ProductType.SALARY,
                        min_amount=5000, max_amount=1000000, interest_rate_monthly=3.0,
                        interest_method=InterestMethod.FLAT,
                        min_tenure_months=1, max_tenure_months=12,
                        processing_fee_pct=2.0, requires_collateral=False, insurance_required=True, is_active=True),
            LoanProduct(name="Mobile Instant Loan (KaribuKash)", type=ProductType.MOBILE,
                        min_amount=500, max_amount=100000, interest_rate_monthly=5.0,
                        interest_method=InterestMethod.FLAT,
                        min_tenure_months=1, max_tenure_months=3,
                        processing_fee_pct=1.0, requires_collateral=False, insurance_required=False, is_active=True),
            LoanProduct(name="Trade Finance", type=ProductType.TRADE,
                        min_amount=50000, max_amount=10000000, interest_rate_monthly=2.5,
                        interest_method=InterestMethod.FLAT,
                        min_tenure_months=1, max_tenure_months=6,
                        processing_fee_pct=1.5, requires_collateral=True, insurance_required=False, is_active=True),
            LoanProduct(name="Agribusiness Seasonal Loan", type=ProductType.AGRI,
                        min_amount=5000, max_amount=2000000, interest_rate_monthly=3.0,
                        interest_method=InterestMethod.FLAT,
                        min_tenure_months=1, max_tenure_months=12,
                        processing_fee_pct=2.0, requires_collateral=True, insurance_required=True, is_active=True),
            LoanProduct(name="Housing Construction Loan", type=ProductType.HOUSING,
                        min_amount=100000, max_amount=10000000, interest_rate_monthly=3.0,
                        interest_method=InterestMethod.REDUCING_BALANCE,
                        min_tenure_months=6, max_tenure_months=36,
                        processing_fee_pct=3.0, requires_collateral=True, insurance_required=True, is_active=True),
            LoanProduct(name="Education Fees Loan", type=ProductType.EDUCATION,
                        min_amount=2000, max_amount=500000, interest_rate_monthly=2.0,
                        interest_method=InterestMethod.FLAT,
                        min_tenure_months=1, max_tenure_months=12,
                        processing_fee_pct=2.0, requires_collateral=False, insurance_required=False, is_active=True),
        ]
        db.add_all(products)
        await db.commit()
        for p in products:
            await db.refresh(p)
        print(f"      ✓ {len(products)} loan products created.")

        # Build product type map
        product_map = {p.type: p for p in products}
        product_type_keys = list(product_map.keys())

        # ── 3. STAFF USERS ───────────────────────────────────────────────────
        print("\n[4/8] Seeding staff accounts...")
        hashed_pw = get_password_hash("SuperSecret123!")
        staff = [
            User(email="admin@karibucredit.co.ke", full_name="Chief Administrator",
                 hashed_password=hashed_pw, role=UserRole.SUPER_ADMIN, is_active=True),
            User(email="officer@karibucredit.co.ke", full_name="Officer Jane Mwangi",
                 hashed_password=hashed_pw, role=UserRole.LOAN_OFFICER, is_active=True),
            User(email="finance@karibucredit.co.ke", full_name="CFO Peter Ndung'u",
                 hashed_password=hashed_pw, role=UserRole.FINANCE, is_active=True),
            User(email="branch@karibucredit.co.ke", full_name="Branch Mgr Samuel Kiprop",
                 hashed_password=hashed_pw, role=UserRole.BRANCH_MANAGER, is_active=True),
            User(email="collections@karibucredit.co.ke", full_name="Collins Odhiambo",
                 hashed_password=hashed_pw, role=UserRole.COLLECTIONS, is_active=True),
            User(email="compliance@karibucredit.co.ke", full_name="Compliance Ofc. Grace Mutheu",
                 hashed_password=hashed_pw, role=UserRole.COMPLIANCE, is_active=True),
        ]
        db.add_all(staff)
        await db.commit()
        for s in staff:
            await db.refresh(s)
        officer_ids = [s.id for s in staff if s.role in (UserRole.LOAN_OFFICER, UserRole.BRANCH_MANAGER)]
        print(f"      ✓ {len(staff)} staff accounts created.")

        # ── 4. BORROWERS & CUSTOMERS ─────────────────────────────────────────
        print("\n[5/8] Seeding 1000 borrowers with customer profiles...")
        borrower_pw = get_password_hash("Borrower123!")
        all_users = []
        all_customers = []
        used_phones = set()
        used_nids = set()

        for i in range(1, 1001):
            is_female = random.random() < 0.45
            first = random.choice(FIRST_NAMES_F if is_female else FIRST_NAMES_M)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"

            # Ensure unique phone
            phone = random_phone()
            while phone in used_phones:
                phone = random_phone()
            used_phones.add(phone)

            # Ensure unique national ID
            nid = random_national_id()
            while nid in used_nids:
                nid = random_national_id()
            used_nids.add(nid)

            email = f"borrower{i:04d}@karibucredit.co.ke"

            user = User(
                email=email,
                full_name=full_name,
                phone_number=phone,
                hashed_password=borrower_pw,
                role=UserRole.BORROWER,
                is_active=True,
            )
            all_users.append(user)

        # Bulk insert users
        db.add_all(all_users)
        await db.commit()
        for u in all_users:
            await db.refresh(u)

        # Create customer profiles
        for idx, user in enumerate(all_users):
            i = idx + 1
            is_female = random.random() < 0.45
            credit_score = random.randint(350, 900)
            kyc = random.choices(
                [KycStatus.VERIFIED, KycStatus.PENDING, KycStatus.REJECTED],
                weights=[80, 15, 5], k=1
            )[0]

            customer = Customer(
                customer_code=f"KC-{i:08d}",
                user_id=user.id,
                national_id=list(used_nids)[idx],
                full_name=user.full_name,
                phone=user.phone_number,
                kra_pin=random_kra_pin(),
                date_of_birth=random_date_of_birth(),
                gender=Gender.FEMALE if is_female else Gender.MALE,
                kyc_status=kyc,
                credit_score=credit_score,
                max_loan_limit=round(random.uniform(50000, 5000000), -3),
                branch_id=random.choice(branch_ids),
                is_repeat_borrower=random.random() < 0.3,
            )
            all_customers.append(customer)

        db.add_all(all_customers)
        await db.commit()
        for c in all_customers:
            await db.refresh(c)
        print(f"      ✓ {len(all_users)} borrower users created.")
        print(f"      ✓ {len(all_customers)} customer profiles created.")

        # ── 5. LOANS, SCHEDULES, TRANSACTIONS, PAYMENTS ──────────────────────
        print("\n[6/8] Generating loans with schedules, transactions & payments...")

        # Status distribution weights (realistic portfolio)
        STATUS_WEIGHTS = {
            LoanStatus.PENDING: 15,       # Awaiting review — user can disburse these!
            LoanStatus.SCREENING: 5,
            LoanStatus.REVIEWING: 5,
            LoanStatus.APPROVED: 8,        # Approved but not yet disbursed
            LoanStatus.DISBURSED: 20,      # Recently disbursed
            LoanStatus.ACTIVE: 25,         # Actively repaying
            LoanStatus.DEFAULTED: 7,
            LoanStatus.CLEARED: 10,
            LoanStatus.REJECTED: 3,
            LoanStatus.WRITTEN_OFF: 2,
        }
        status_pool = []
        for st, weight in STATUS_WEIGHTS.items():
            status_pool.extend([st] * weight)

        loan_count = 0
        schedule_count = 0
        tx_count = 0
        payment_count = 0
        collateral_count = 0
        tx_refs_used = set()

        for cust_idx, customer in enumerate(all_customers):
            # Each customer gets 1-3 loans
            num_loans = random.choices([1, 2, 3], weights=[60, 30, 10], k=1)[0]

            for _ in range(num_loans):
                product_type = random.choice(product_type_keys)
                product = product_map[product_type]
                principal = round(random.uniform(product.min_amount, min(product.max_amount, 2000000)), -2)
                rate = product.interest_rate_monthly
                tenure = random.randint(product.min_tenure_months, min(product.max_tenure_months, 12))
                total_interest = round(principal * (rate / 100) * tenure, 2)
                total_payable = round(principal + total_interest, 2)
                monthly_installment = round(total_payable / tenure, 2)

                status = random.choice(status_pool)
                app_no = f"LAF-{random.randint(100000000, 999999999)}"

                # Determine dates based on status
                created_dt = random_past_datetime(30, 400)
                disbursed_at = None
                first_due = None
                final_due = None
                total_paid = 0.0
                outstanding = total_payable
                par_days = 0
                penalty_bal = 0.0

                if status in (LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.DEFAULTED,
                              LoanStatus.CLEARED, LoanStatus.WRITTEN_OFF):
                    disbursed_at = created_dt + timedelta(days=random.randint(1, 7))
                    first_due = (disbursed_at + timedelta(days=30)).date()
                    final_due = (disbursed_at + timedelta(days=30 * tenure)).date()

                if status == LoanStatus.ACTIVE:
                    # Partially repaid
                    months_paid = random.randint(1, max(1, tenure - 1))
                    total_paid = round(monthly_installment * months_paid, 2)
                    outstanding = round(total_payable - total_paid, 2)
                elif status == LoanStatus.CLEARED:
                    total_paid = total_payable
                    outstanding = 0.0
                elif status == LoanStatus.DEFAULTED:
                    months_paid = random.randint(0, max(0, tenure // 2))
                    total_paid = round(monthly_installment * months_paid, 2)
                    outstanding = round(total_payable - total_paid, 2)
                    par_days = random.randint(31, 180)
                    penalty_bal = round(outstanding * 0.10, 2)
                elif status == LoanStatus.WRITTEN_OFF:
                    months_paid = random.randint(0, 2)
                    total_paid = round(monthly_installment * months_paid, 2)
                    outstanding = round(total_payable - total_paid, 2)
                    par_days = random.randint(181, 365)

                loan = Loan(
                    application_no=app_no,
                    user_id=customer.user_id,
                    customer_id=customer.id,
                    product_id=product.id,
                    principal_amount=principal,
                    amount_requested=principal,
                    amount_approved=principal if status not in (LoanStatus.PENDING, LoanStatus.SCREENING, LoanStatus.REJECTED) else None,
                    amount_disbursed=principal if disbursed_at else 0.0,
                    outstanding_balance=outstanding,
                    interest_rate=rate,
                    tenure_months=tenure,
                    status=status,
                    product_type=product_type.value.lower() if hasattr(product_type, 'value') else str(product_type).lower(),
                    disbursement_method=DisbursementMethod.LUMP_SUM,
                    disbursed_at=disbursed_at,
                    first_due_date=first_due,
                    final_due_date=final_due,
                    due_date=datetime(final_due.year, final_due.month, final_due.day) if final_due else None,
                    par_days=par_days,
                    officer_id=random.choice(officer_ids),
                    branch_id=customer.branch_id,
                    total_payable=total_payable,
                    total_paid=total_paid,
                    penalty_balance=penalty_bal,
                    created_at=created_dt,
                )
                db.add(loan)
                await db.flush()  # Get the loan.id
                loan_count += 1

                # ── Repayment Schedule ──
                if disbursed_at and first_due:
                    for inst in range(1, tenure + 1):
                        due = first_due + timedelta(days=30 * (inst - 1))
                        p_due = round(principal / tenure, 2)
                        i_due = round(total_interest / tenure, 2)
                        t_due = round(p_due + i_due, 2)

                        if status == LoanStatus.CLEARED:
                            sched_status = ScheduleStatus.PAID
                            amt_paid = t_due
                        elif status in (LoanStatus.ACTIVE, LoanStatus.DEFAULTED, LoanStatus.WRITTEN_OFF):
                            months_elapsed = (date.today() - first_due).days // 30
                            if inst <= months_elapsed:
                                if random.random() < 0.85 or status == LoanStatus.ACTIVE:
                                    sched_status = ScheduleStatus.PAID
                                    amt_paid = t_due
                                else:
                                    sched_status = ScheduleStatus.OVERDUE
                                    amt_paid = 0.0
                            else:
                                sched_status = ScheduleStatus.PENDING
                                amt_paid = 0.0
                        else:
                            sched_status = ScheduleStatus.PENDING
                            amt_paid = 0.0

                        sched = RepaymentSchedule(
                            loan_id=loan.id,
                            instalment_no=inst,
                            due_date=due,
                            principal_due=p_due,
                            interest_due=i_due,
                            total_due=t_due,
                            amount_paid=amt_paid,
                            status=sched_status,
                        )
                        db.add(sched)
                        schedule_count += 1

                # ── Transactions ──
                if disbursed_at:
                    ref = f"B2C-{uuid.uuid4().hex[:10].upper()}"
                    db.add(Transaction(
                        loan_id=loan.id, type=TransactionType.DISBURSEMENT,
                        amount=principal, reference_code=ref, created_at=disbursed_at,
                    ))
                    tx_count += 1

                    # Platform fee
                    fee_ref = f"FEE-{uuid.uuid4().hex[:10].upper()}"
                    db.add(Transaction(
                        loan_id=loan.id, type=TransactionType.PLATFORM_FEE,
                        amount=round(principal * product.processing_fee_pct / 100, 2),
                        reference_code=fee_ref, created_at=disbursed_at,
                    ))
                    tx_count += 1

                if total_paid > 0 and disbursed_at and first_due:
                    # Create repayment transactions + payments
                    months_paid_count = int(total_paid / monthly_installment) if monthly_installment > 0 else 0
                    for mp in range(1, min(months_paid_count + 1, tenure + 1)):
                        pay_date = datetime(
                            first_due.year, first_due.month, first_due.day
                        ) + timedelta(days=30 * (mp - 1) + random.randint(-3, 3))

                        ref_code = f"MPESA-{uuid.uuid4().hex[:10].upper()}"
                        db.add(Transaction(
                            loan_id=loan.id, type=TransactionType.REPAYMENT,
                            amount=monthly_installment, reference_code=ref_code,
                            created_at=pay_date,
                        ))
                        tx_count += 1

                        db.add(Payment(
                            loan_id=loan.id, customer_id=customer.id,
                            amount=monthly_installment,
                            principal_portion=round(principal / tenure, 2),
                            interest_portion=round(total_interest / tenure, 2),
                            fees_portion=0.0,
                            mpesa_ref=ref_code,
                            source=random.choice([PaymentSource.MPESA_C2B, PaymentSource.MPESA_STK]),
                            status=PaymentStatus.CONFIRMED,
                            paid_at=pay_date,
                        ))
                        payment_count += 1

                # ── Collateral (for secured products) ──
                if product.requires_collateral and status not in (LoanStatus.REJECTED, LoanStatus.PENDING):
                    ctype, cmin, cmax = random.choice(COLLATERAL_TYPES)
                    cval = round(random.uniform(max(cmin, principal * 0.8), min(cmax, principal * 2.5)), -3)
                    db.add(Collateral(
                        loan_id=loan.id, type=ctype, value=cval,
                        status="VERIFIED" if status != LoanStatus.SCREENING else "PENDING",
                        details=f"{ctype} valued at KES {cval:,.0f} — {random.choice(LOCATIONS)}",
                    ))
                    collateral_count += 1

            # Commit in batches every 50 customers
            if (cust_idx + 1) % 50 == 0:
                await db.commit()
                pct = round((cust_idx + 1) / len(all_customers) * 100)
                print(f"      ... {cust_idx + 1}/{len(all_customers)} customers processed ({pct}%)")

        await db.commit()
        print(f"      ✓ {loan_count} loans created.")
        print(f"      ✓ {schedule_count} repayment schedule lines.")
        print(f"      ✓ {tx_count} transactions.")
        print(f"      ✓ {payment_count} payments.")
        print(f"      ✓ {collateral_count} collateral items.")

        # ── 6. GROUP LENDING ─────────────────────────────────────────────────
        print("\n[7/8] Seeding lending groups...")
        group_count = 0
        member_count = 0
        group_loan_count = 0

        for gname in GROUP_NAMES[:15]:
            group = LendingGroup(
                group_code=f"GRP-{random.randint(100000000, 999999999)}",
                group_name=gname,
                description=f"{gname} — {random.choice(LOCATIONS)}",
                branch_id=random.choice(branch_ids),
                max_members=random.choice([10, 15, 20]),
                status=GroupStatus.ACTIVE,
            )
            db.add(group)
            await db.flush()
            group_count += 1

            # Add 5-12 random members
            sample_customers = random.sample(all_customers, k=random.randint(5, 12))
            roles = [GroupMemberRole.CHAIRMAN, GroupMemberRole.SECRETARY, GroupMemberRole.TREASURER]
            for mi, cust in enumerate(sample_customers):
                role = roles[mi] if mi < len(roles) else GroupMemberRole.MEMBER
                db.add(GroupMember(
                    group_id=group.id, customer_id=cust.id, role=role, is_active=True,
                ))
                member_count += 1

                if mi == 0 and cust.user_id:
                    group.chairman_user_id = cust.user_id

            # 60% chance group has a loan
            if random.random() < 0.6:
                g_principal = round(random.uniform(100000, 1000000), -3)
                g_rate = random.choice([3.0, 4.0, 5.0])
                g_tenure = random.choice([3, 6, 9, 12])
                g_total = round(g_principal * (1 + g_rate / 100 * g_tenure), 2)
                g_status = random.choice([GroupLoanStatus.PENDING, GroupLoanStatus.DISBURSED, GroupLoanStatus.ACTIVE])

                db.add(GroupLoan(
                    group_id=group.id,
                    application_no=f"GLA-{random.randint(100000000, 999999999)}",
                    principal_amount=g_principal,
                    interest_rate=g_rate,
                    tenure_months=g_tenure,
                    total_payable=g_total,
                    total_paid=round(g_total * random.uniform(0, 0.6), 2) if g_status == GroupLoanStatus.ACTIVE else 0.0,
                    outstanding_balance=g_total,
                    status=g_status,
                    purpose=random.choice(LOAN_PURPOSES),
                ))
                group_loan_count += 1

        await db.commit()
        print(f"      ✓ {group_count} lending groups.")
        print(f"      ✓ {member_count} group members.")
        print(f"      ✓ {group_loan_count} group loans.")

        # ── 7. PENALTY SETTINGS & AUDIT LOG ──────────────────────────────────
        print("\n[8/8] Seeding penalty settings & audit trail...")
        db.add(PenaltySetting(grace_period=3, penalty_percentage=10.0, frequency="ONCE"))
        db.add(AuditLog(user="system", action="SYSTEM_INIT",
                        details=f"Database seeded with {loan_count} loans across {len(all_customers)} borrowers."))
        db.add(AuditLog(user="admin@karibucredit.co.ke", action="BULK_IMPORT",
                        details=f"Imported {len(all_customers)} customer records from CSV migration."))
        await db.commit()
        print("      ✓ Penalty settings and audit trail seeded.")

    await engine.dispose()

    print("\n" + "=" * 70)
    print("   SEED COMPLETE!")
    print("=" * 70)
    print(f"""
   Summary:
   ────────────────────────────────────────
   Branches:           {len(branches)}
   Loan Products:      {len(products)}
   Staff Users:        {len(staff)}
   Borrowers:          {len(all_users)}
   Customer Profiles:  {len(all_customers)}
   Loans:              {loan_count}
   Repayment Lines:    {schedule_count}
   Transactions:       {tx_count}
   Payments:           {payment_count}
   Collateral Items:   {collateral_count}
   Lending Groups:     {group_count}
   Group Members:      {member_count}
   Group Loans:        {group_loan_count}
   ────────────────────────────────────────

   Login:  admin@karibucredit.co.ke / SuperSecret123!
   URL:    http://localhost:3000
""")


if __name__ == "__main__":
    asyncio.run(seed())
