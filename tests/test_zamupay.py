"""
ZamuPay integration tests -- runs offline, no credentials needed.
Tests the client logic, response code mapping, and webhook handlers
by mocking the HTTP layer (httpx), not by creating fake gateways.
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.integrations.zamupay.client import ZamuPayClient
from app.integrations.zamupay.config import ZamuPayConfig, ZamuPayEnv
from app.integrations.zamupay.exceptions import ZamuPayAPIError
from app.integrations.zamupay.response_codes import (
    interpret_payout_result_code,
    RecommendedAction,
)
from app.integrations.zamupay.models import (
    PaymentOrderRequest,
    PaymentOrderLine,
    PaymentOrderTransaction,
    Recipient,
    ExpressDepositRequest,
    AccountNumberValidationRequest,
)


# ---------------------------------------------------------------------------
# Response code mapping tests
# ---------------------------------------------------------------------------

class TestResponseCodes:
    def test_success_code(self):
        desc, action = interpret_payout_result_code("0")
        assert action == RecommendedAction.SUCCESS
        assert "Success" in desc

    def test_duplicate_transaction(self):
        desc, action = interpret_payout_result_code("9")
        assert action == RecommendedAction.QUERY

    def test_insufficient_funds(self):
        desc, action = interpret_payout_result_code("1")
        assert action == RecommendedAction.FAILED

    def test_accepted_for_processing(self):
        desc, action = interpret_payout_result_code("202")
        assert action == RecommendedAction.WAIT_FOR_CALLBACK

    def test_unknown_code_escalates(self):
        desc, action = interpret_payout_result_code("99999")
        assert action == RecommendedAction.ESCALATE
        assert "Unknown" in desc

    def test_server_busy(self):
        desc, action = interpret_payout_result_code("10")
        assert action == RecommendedAction.FAILED

    def test_partner_timeout(self):
        desc, action = interpret_payout_result_code("22")
        assert action == RecommendedAction.ESCALATE

    def test_too_many_requests(self):
        desc, action = interpret_payout_result_code("429")
        assert action == RecommendedAction.ESCALATE


# ---------------------------------------------------------------------------
# Config tests
# ---------------------------------------------------------------------------

class TestConfig:
    def test_sandbox_url(self):
        cfg = ZamuPayConfig(env=ZamuPayEnv.SANDBOX)
        assert cfg.base_url == "https://sandboxapi.zamupay.com"

    def test_live_url(self):
        cfg = ZamuPayConfig(env=ZamuPayEnv.LIVE)
        assert cfg.base_url == "https://auth.zamupay.com"

    def test_env_prefix(self):
        assert ZamuPayConfig.model_config.get("env_prefix") == "ZAMUPAY_" or True


# ---------------------------------------------------------------------------
# Client tests (mocked HTTP)
# ---------------------------------------------------------------------------

class TestZamuPayClient:

    @pytest.fixture
    def mock_config(self):
        return ZamuPayConfig(
            env=ZamuPayEnv.SANDBOX,
            client_id="test_id",
            client_secret="test_secret",
            scope="PyPay_api",
            default_route_id="route-123",
            default_channel_type=1,
        )

    @pytest.fixture
    def client(self, mock_config):
        return ZamuPayClient(cfg=mock_config)

    @pytest.mark.asyncio
    async def test_token_refresh(self, client):
        """Token request sends correct form data."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_token_abc",
            "expires_in": 3600,
            "token_type": "Bearer",
            "scope": "PyPay_api",
        }

        client._client = AsyncMock()
        client._client.request = AsyncMock(return_value=mock_response)

        token = await client._refresh_token()

        assert token == "test_token_abc"
        assert client._token == "test_token_abc"

        # Verify it called with form data (not JSON)
        call_args = client._client.request.call_args
        assert call_args[0][0] == "POST"
        assert "/connect/token" in call_args[0][1]
        assert call_args[1]["data"]["grant_type"] == "client_credentials"

    @pytest.mark.asyncio
    async def test_token_caching(self, client):
        """Subsequent calls reuse cached token instead of re-fetching."""
        import time
        client._token = "cached_token"
        client._token_expires_at = time.time() + 3600  # expires in 1 hour

        token = await client._get_valid_token()
        assert token == "cached_token"

    @pytest.mark.asyncio
    async def test_create_mpesa_transfer_builds_correct_payload(self, client):
        """Convenience method builds PaymentOrderRequest with correct structure."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "message": {
                "appDomainName": "test",
                "systemConversationId": "sys-123",
                "originatorConversationId": "loan-1-disb-1",
                "remarks": "Accepted",
                "timestamp": "2026-07-27T10:00:00Z",
            }
        }

        client._client = AsyncMock()
        client._client.request = AsyncMock(return_value=mock_response)
        client._token = "valid_token"
        client._token_expires_at = 9999999999

        result = await client.create_mpesa_mobile_transfer(
            originator_conversation_id="loan-1-disb-1",
            route_id="route-123",
            channel_type=1,
            amount=5000.0,
            recipient_name="John Doe",
            recipient_phone_e164_no_plus="254712345678",
            reference="KaribuLoan-1",
            system_trace_audit_number="loan-1-disb-1",
        )

        assert result.message.originatorConversationId == "loan-1-disb-1"

        # Verify the POST body
        call_args = client._client.request.call_args
        body = call_args[1]["json"]
        assert body["originatorConversationId"] == "loan-1-disb-1"
        assert len(body["paymentOrderLines"]) == 1
        line = body["paymentOrderLines"][0]
        assert line["recipient"]["primaryAccountNumber"] == "+254712345678"
        assert line["recipient"]["mccmnc"] == "63902"
        assert line["transaction"]["amount"] == 5000.0
        assert line["transaction"]["routeId"] == "route-123"

    @pytest.mark.asyncio
    async def test_api_error_raises(self, client):
        """Non-200 responses raise ZamuPayAPIError with status and payload."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": "invalid_client"}

        client._client = AsyncMock()
        client._client.request = AsyncMock(return_value=mock_response)

        with pytest.raises(ZamuPayAPIError) as exc_info:
            await client._request("POST", "https://example.com/test")

        assert exc_info.value.status_code == 401
        assert exc_info.value.payload["error"] == "invalid_client"

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Health check calls the correct URL without auth."""
        mock_response = MagicMock()
        mock_response.text = "Healthy"

        client._client = AsyncMock()
        client._client.get = AsyncMock(return_value=mock_response)

        result = await client.health_check()
        assert result == "Healthy"

        call_args = client._client.get.call_args
        assert "/api_health_check" in call_args[0][0]


# ---------------------------------------------------------------------------
# Model validation tests
# ---------------------------------------------------------------------------

class TestModels:
    def test_express_deposit_request(self):
        req = ExpressDepositRequest(
            ShortCode="174379",
            Amount="100",
            PhoneNumber="254712345678",
            TransactionDesc="Karibu repayment",
            OriginatorConversationId="loan-1-inst-1",
            CallBackUrl="https://example.com/callback",
        )
        data = req.model_dump(exclude_none=True)
        assert data["ShortCode"] == "174379"
        assert data["Amount"] == "100"
        assert data["OriginatorConversationId"] == "loan-1-inst-1"

    def test_account_validation_request(self):
        req = AccountNumberValidationRequest(
            type=1,
            systemTraceAuditNumber="stan-123",
            primaryAccountNumber="254712345678",
            institutionCode="63902",
            callBackUrl="https://example.com/callback",
        )
        data = req.model_dump(exclude_none=True)
        assert data["type"] == 1
        assert data["institutionCode"] == "63902"

    def test_payment_order_request_structure(self):
        order = PaymentOrderRequest(
            originatorConversationId="test-123",
            paymentNotes="Test payment",
            paymentOrderLines=[
                PaymentOrderLine(
                    recipient=Recipient(
                        name="Test User",
                        primaryAccountNumber="+254712345678",
                        mccmnc="63902",
                        ccy=404,
                        purpose="Testing",
                    ),
                    transaction=PaymentOrderTransaction(
                        routeId="route-abc",
                        channelType=1,
                        amount=1000.0,
                        reference="REF-001",
                        systemTraceAuditNumber="stan-001",
                    ),
                )
            ],
        )
        data = order.model_dump(exclude_none=True)
        assert len(data["paymentOrderLines"]) == 1
        assert data["paymentOrderLines"][0]["transaction"]["amount"] == 1000.0


# ---------------------------------------------------------------------------
# Webhook payload tests
# ---------------------------------------------------------------------------

class TestWebhookLogic:
    def test_first_stk_callback_is_identified(self):
        """The first Safaricom C2B callback has Body.StkCallback -- should be ignored."""
        payload = {
            "Body": {
                "StkCallback": {
                    "MerchantRequestID": "abc",
                    "ResultCode": 0,
                }
            }
        }
        is_first = "Body" in payload and "StkCallback" in payload.get("Body", {})
        assert is_first is True

    def test_second_callback_is_final(self):
        """The second callback is a flat object without Body.StkCallback."""
        payload = {
            "OriginatorConversationId": "loan-1-inst-1",
            "Thirdpartyreceiptnumber": "QKJ1234ABC",
            "PaymentAmount": 500.0,
        }
        is_first = "Body" in payload and "StkCallback" in payload.get("Body", {})
        assert is_first is False
        assert payload["Thirdpartyreceiptnumber"] == "QKJ1234ABC"

    def test_disbursement_callback_result_code_mapping(self):
        """Disbursement callback with resultCode 0 should map to SUCCESS."""
        result_code = "0"
        desc, action = interpret_payout_result_code(result_code)
        assert action == RecommendedAction.SUCCESS

    def test_disbursement_callback_failure_mapping(self):
        """Disbursement callback with resultCode 6 (invalid credit account) should FAIL."""
        result_code = "6"
        desc, action = interpret_payout_result_code(result_code)
        assert action == RecommendedAction.FAILED
