class ZamuPayError(Exception):
    """Base exception for all ZamuPay integration errors."""


class ZamuPayAuthError(ZamuPayError):
    """Raised when token acquisition/refresh fails."""


class ZamuPayAPIError(ZamuPayError):
    """Raised when ZamuPay returns a non-success status/response code."""

    def __init__(self, message: str, status_code: int | None = None, payload: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}
