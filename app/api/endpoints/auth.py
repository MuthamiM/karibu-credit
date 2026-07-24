from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.integrations.otp_gateway import (
    OTPGatewayError,
    RateLimitError,
    send_otp,
    verify_otp,
)
from app.core.audit import log_audit_event
from app.models.user import User, UserRole
from app.schemas.token import Token

router = APIRouter()


class OTPRequiredResponse(BaseModel):
    otp_required: bool = True
    pending_token: str
    phone_hint: str


class VerifyOTPRequest(BaseModel):
    pending_token: str
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def code_must_be_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP code must contain only digits")
        return v


class AdminResetPasswordRequest(BaseModel):
    target_user_id: int
    new_password: str = Field(..., min_length=6)


class CompletePasswordChangeRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=6)


class ForgotPasswordRequest(BaseModel):
    email: str


from sqlalchemy import or_

@router.post("/login")
async def login_access_token(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    Step 1: verify phone number or email + password, then send an OTP to the user's phone.
    Returns a short-lived pending_token that must be passed to /verify-otp.
    """
    identifier = form_data.username.strip()
    raw_phone = identifier.replace("+", "").replace(" ", "").replace("-", "")
    kenya_254 = f"254{raw_phone[1:]}" if (raw_phone.startswith("07") or raw_phone.startswith("01")) and len(raw_phone) == 10 else raw_phone

    result = await db.execute(
        select(User).where(
            or_(
                User.email == identifier,
                User.phone_number == identifier,
                User.phone_number == raw_phone,
                User.phone_number == f"+{raw_phone}",
                User.phone_number == kenya_254,
            )
        )
    )
    user = result.scalars().first()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
        )
    elif not user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number on file for OTP verification",
        )

    try:
        await send_otp(user.phone_number)
    except RateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate limit exceeded", "retry_after_seconds": e.retry_after_seconds},
        )
    except OTPGatewayError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send OTP, please try again shortly",
        )

    pending_expires = timedelta(minutes=settings.OTP_PENDING_TOKEN_EXPIRE_MINUTES)
    pending_token = security.create_access_token(
        user.id, expires_delta=pending_expires, extra_claims={"purpose": "login"}
    )

    visible_tail = user.phone_number[-4:]
    masked = ("*" * max(len(user.phone_number) - 4, 0)) + visible_tail

    return OTPRequiredResponse(pending_token=pending_token, phone_hint=masked)


@router.post("/request-password-change-otp")
async def request_password_change_otp(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Sends an OTP to the currently authenticated user's phone number to initiate
    an OTP-gated self-service password change.
    Returns a pending_token embedded with extra_claims={"purpose": "password_reset"}.
    """
    if not current_user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number on file for OTP verification",
        )

    try:
        await send_otp(current_user.phone_number, purpose="reset")
    except RateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate limit exceeded", "retry_after_seconds": e.retry_after_seconds},
        )
    except OTPGatewayError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send OTP, please try again shortly",
        )

    pending_expires = timedelta(minutes=settings.OTP_PENDING_TOKEN_EXPIRE_MINUTES)
    pending_token = security.create_access_token(
        current_user.id,
        expires_delta=pending_expires,
        extra_claims={"purpose": "password_reset"},
    )

    visible_tail = current_user.phone_number[-4:]
    masked = ("*" * max(len(current_user.phone_number) - 4, 0)) + visible_tail

    return {
        "otp_required": True,
        "pending_token": pending_token,
        "phone_hint": masked,
    }


@router.post("/forgot-password-otp")
async def forgot_password_otp(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sends an OTP to the user's phone number to initiate a password reset
    without requiring them to be logged in first.
    """
    email_or_phone = body.email.strip()
    result = await db.execute(
        select(User).where(
            or_(
                User.email == email_or_phone,
                User.phone_number == email_or_phone
            )
        )
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if not user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number on file for OTP verification"
        )
    try:
        await send_otp(user.phone_number, purpose="reset")
    except RateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "rate limit exceeded", "retry_after_seconds": e.retry_after_seconds},
        )
    except OTPGatewayError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send OTP, please try again shortly",
        )

    pending_expires = timedelta(minutes=settings.OTP_PENDING_TOKEN_EXPIRE_MINUTES)
    pending_token = security.create_access_token(
        user.id,
        expires_delta=pending_expires,
        extra_claims={"purpose": "password_reset"},
    )

    visible_tail = user.phone_number[-4:]
    masked = ("*" * max(len(user.phone_number) - 4, 0)) + visible_tail

    return {
        "otp_required": True,
        "pending_token": pending_token,
        "phone_hint": masked,
    }


@router.post("/verify-otp")
async def verify_otp_and_login(
    body: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2: verify the OTP code against the pending_token issued at /login or /request-password-change-otp.
    - If purpose == "login": issues the real access token.
    - If purpose == "password_reset": returns a short-lived reset_token (purpose == "password_reset_confirmed").
    """
    try:
        payload = security.decode_token_payload(body.pending_token)
        user_id = int(payload["sub"])
        purpose = payload.get("purpose", "login")
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired pending session, please log in again",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user or not user.is_active or not user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session"
        )

    try:
        is_valid = await verify_otp(user.phone_number, body.code)
    except OTPGatewayError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify OTP, please try again shortly",
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect or expired code"
        )

    if purpose == "password_reset":
        reset_expires = timedelta(minutes=5)
        reset_token = security.create_access_token(
            user.id,
            expires_delta=reset_expires,
            extra_claims={"purpose": "password_reset_confirmed"},
        )
        return {
            "otp_confirmed": True,
            "reset_token": reset_token,
        }

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/complete-password-change", response_model=dict)
async def complete_password_change(
    body: CompletePasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 3 (Password Reset): Accepts the reset_token (issued after OTP verification) and new_password.
    Updates the target user's hashed_password in the database.
    """
    try:
        payload = security.decode_token_payload(body.reset_token)
        if payload.get("purpose") != "password_reset_confirmed":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired reset session",
            )
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset session",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset session or user inactive",
        )

    user.hashed_password = security.get_password_hash(body.new_password)
    db.add(user)
    await db.commit()

    await log_audit_event(
        db,
        user=user.email,
        action="OTP_PASSWORD_RESET",
        details=f"User {user.email} completed 2FA OTP password reset.",
    )

    return {"status": "success", "detail": "Password updated successfully"}


@router.post("/admin/reset-password", response_model=dict)
async def admin_reset_user_password(
    body: AdminResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    ADMIN-ONLY password override.
    Allows a Super Admin or Admin to reset another user's password without
    requiring the current password. Used when a staff member or borrower forgets their password.
    Bypasses the normal current-password verification used in PUT /api/v1/users/me/password.
    """
    allowed_roles = {UserRole.SUPER_ADMIN, UserRole.ADMIN, "SUPER_ADMIN", "ADMIN"}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted: insufficient privileges",
        )

    result = await db.execute(select(User).where(User.id == body.target_user_id))
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found",
        )

    target_user.hashed_password = security.get_password_hash(body.new_password)
    db.add(target_user)
    await db.commit()

    await log_audit_event(
        db,
        user=current_user.email,
        action="ADMIN_RESET_PASSWORD",
        details=f"Admin {current_user.email} reset password for user ID {body.target_user_id}",
    )

    return {"status": "password reset", "user_id": body.target_user_id}


