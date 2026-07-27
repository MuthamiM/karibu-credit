"""
ZamuPay integration config for Karibu Credit.

CONFIRMED from docs.zamupay.com (fetched directly, not guessed):
    Live:    https://auth.zamupay.com
    Sandbox: https://sandboxapi.zamupay.com

Every endpoint in this package lives under one of those two hosts —
there is NOT a separate host per section (Payouts/Pay-Ins/Account
Validation all share the same base URL).
"""

from pydantic_settings import BaseSettings
from enum import Enum


class ZamuPayEnv(str, Enum):
    LIVE = "live"
    SANDBOX = "sandbox"


class ZamuPayConfig(BaseSettings):
    env: ZamuPayEnv = ZamuPayEnv.SANDBOX

    live_base_url: str = "https://auth.zamupay.com"
    sandbox_base_url: str = "https://sandboxapi.zamupay.com"

    # OAuth2 client_credentials — issued by ZamuPay when your merchant
    # account is set up (Settings > API Credentials in the dashboard)
    client_id: str = ""
    client_secret: str = ""
    scope: str = ""  # e.g. "PyPay_api" — confirm the exact value issued to you

    # Refresh the token slightly before its real expiry to avoid races
    token_refresh_skew_seconds: int = 30

    # Where ZamuPay should POST async callbacks for Payouts (B2C) — set this
    # to your Karibu Credit backend's public webhook route, and separately
    # enable it in the ZamuPay dashboard under Settings > Company Settings >
    # Webhook Settings (that part is a dashboard toggle, not an API call).
    payouts_callback_url: str = ""

    # Callback URL used for Express Deposit (C2B collection / repayments)
    # and Account Validation requests — these ARE set per-request in the
    # payload (CallBackUrl / callBackUrl fields), not just dashboard-wide.
    default_callback_url: str = ""

    # Route config — call GET /v1/transaction-routes/assigned-routes once,
    # then cache these. They're static until ZamuPay changes your routing.
    default_route_id: str = ""
    default_channel_type: int = 0

    @property
    def base_url(self) -> str:
        return self.live_base_url if self.env == ZamuPayEnv.LIVE else self.sandbox_base_url

    class Config:
        env_prefix = "ZAMUPAY_"
        env_file = ".env"
        extra = "ignore"


config = ZamuPayConfig()
