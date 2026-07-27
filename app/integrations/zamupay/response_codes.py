"""
ZamuPay Transactions Response Codes for Payouts — CONFIRMED from
https://docs.zamupay.com/-zamupay-transactions-response-codes-for-payouts-2105699m0

This is what tells Karibu Credit's disbursement logic what to actually DO
when a payout comes back non-zero: retry the same ID, retry with a new ID,
query and wait, or escalate to a human before touching it again.

Getting this wrong risks double-disbursing a loan or writing off money that
actually went through — so this table is used verbatim from the docs, not
paraphrased into "probably fine" categories.
"""

from enum import Enum


class RecommendedAction(str, Enum):
    SUCCESS = "mark_success"
    FAILED = "mark_failed"
    RETRY_SAME_ID = "retry_same_id"
    RETRY_NEW_ID = "retry_new_id"
    QUERY = "query_status"
    ESCALATE = "escalate_to_support"
    WAIT_FOR_CALLBACK = "wait_for_callback"


# code -> (description, action)
PAYOUT_RESPONSE_CODES: dict[str, tuple[str, RecommendedAction]] = {
    "0": ("Success", RecommendedAction.SUCCESS),
    "1": ("Insufficient funds", RecommendedAction.FAILED),
    "2": ("Transfer limit exceeded", RecommendedAction.FAILED),
    "3": ("Internal server error", RecommendedAction.FAILED),
    "4": ("Third party internal server error", RecommendedAction.FAILED),
    "5": ("Invalid debit account (B2C)", RecommendedAction.FAILED),
    "6": ("Invalid credit account", RecommendedAction.FAILED),
    "7": ("Transfer amount below limit", RecommendedAction.FAILED),
    "8": ("Invalid transaction element", RecommendedAction.FAILED),
    "9": ("Duplicate transaction", RecommendedAction.QUERY),  # query by originatorConversationId
    "10": ("Server busy", RecommendedAction.FAILED),
    "11": ("Transaction not found", RecommendedAction.RETRY_SAME_ID),
    "12": ("General error", RecommendedAction.ESCALATE),
    "13": ("Third party general failure", RecommendedAction.ESCALATE),
    "14": ("Inconclusive status", RecommendedAction.ESCALATE),
    "15": ("Insufficient wallet balance", RecommendedAction.FAILED),
    "16": ("Third party system unavailable", RecommendedAction.QUERY),
    "17": ("AML Check failure", RecommendedAction.FAILED),
    "18": ("Declined", RecommendedAction.FAILED),
    "19": ("Validation failed", RecommendedAction.FAILED),
    "20": ("Third party integration error", RecommendedAction.ESCALATE),
    "21": ("Unmapped code", RecommendedAction.ESCALATE),
    "22": ("Partner timeout", RecommendedAction.ESCALATE),
    "202": ("Request accepted for processing", RecommendedAction.WAIT_FOR_CALLBACK),
    "200": ("Request processed successfully", RecommendedAction.WAIT_FOR_CALLBACK),
    "400": ("Bad request — validation error or duplicate originatorConversationId", RecommendedAction.FAILED),
    "401": ("Unauthorized — Bearer token expired or invalid credentials", RecommendedAction.FAILED),
    "404": ("Request URL not found", RecommendedAction.FAILED),
    "429": ("Too many requests", RecommendedAction.ESCALATE),
    "500": ("Internal server error", RecommendedAction.FAILED),
    "999": ("Transaction cannot be completed at this moment", RecommendedAction.FAILED),
}


def interpret_payout_result_code(code: str) -> tuple[str, RecommendedAction]:
    """
    Returns (description, RecommendedAction) for a ZamuPay resultCode.
    Unknown codes are treated conservatively as ESCALATE rather than
    silently assumed successful or failed.
    """
    return PAYOUT_RESPONSE_CODES.get(
        str(code), ("Unknown/unmapped response code", RecommendedAction.ESCALATE)
    )
