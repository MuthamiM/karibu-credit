import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Date, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base


class GroupStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DISSOLVED = "dissolved"


class GroupMemberRole(str, enum.Enum):
    CHAIRMAN = "chairman"
    SECRETARY = "secretary"
    TREASURER = "treasurer"
    MEMBER = "member"


class GroupLoanStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DISBURSED = "disbursed"
    ACTIVE = "active"
    CLEARED = "cleared"
    DEFAULTED = "defaulted"
    REJECTED = "rejected"


class LendingGroup(Base):
    """
    Joint Liability Lending Group.
    Borrowers form groups (typically 5–15 members) and are jointly liable for each other's loans.
    """
    __tablename__ = "lending_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String, unique=True, index=True, nullable=False)  # GRP-XXXXXXXXX
    group_name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    chairman_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    status = Column(Enum(GroupStatus), default=GroupStatus.ACTIVE)
    max_members = Column(Integer, default=15)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    chairman = relationship("User", foreign_keys=[chairman_user_id])
    branch = relationship("Branch")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    group_loans = relationship("GroupLoan", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    """
    Tracks membership in a lending group.
    """
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("lending_groups.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    role = Column(Enum(GroupMemberRole), default=GroupMemberRole.MEMBER)
    is_active = Column(Boolean, default=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("LendingGroup", back_populates="members")
    customer = relationship("Customer")


class GroupLoan(Base):
    """
    A loan issued to a lending group under joint liability.
    Individual members share the principal equally, and any default is collectively guaranteed.
    """
    __tablename__ = "group_loans"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("lending_groups.id"), nullable=False)
    application_no = Column(String, unique=True, index=True, nullable=True)  # GLA-XXXXXXXXX
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)  # Monthly rate %
    tenure_months = Column(Integer, nullable=False)
    total_payable = Column(Float, nullable=True)
    total_paid = Column(Float, default=0.0)
    outstanding_balance = Column(Float, default=0.0)
    status = Column(Enum(GroupLoanStatus), default=GroupLoanStatus.PENDING)
    purpose = Column(Text, nullable=True)

    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    group = relationship("LendingGroup", back_populates="group_loans")
    approver = relationship("User", foreign_keys=[approved_by])
