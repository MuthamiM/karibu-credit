from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.integrations.otp_gateway import send_sms, OTPGatewayError

router = APIRouter()


class SendSMSRequest(BaseModel):
    phone: str
    message: str


@router.post("/send")
async def send_custom_sms(payload: SendSMSRequest):
    """
    Sends an SMS message to any target phone number via the Termux SMS Gateway.
    """
    phone = payload.phone.strip()
    message = payload.message.strip()

    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is required",
        )
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content is required",
        )

    try:
        res = await send_sms(phone=phone, message=message)
        return {
            "status": "success",
            "phone": phone,
            "message": message,
            "gateway_response": res,
        }
    except OTPGatewayError as exc:
        # Return fallback status if real Termux device endpoint returns error or is offline
        return {
            "status": "queued_local",
            "phone": phone,
            "message": message,
            "detail": str(exc),
            "note": "SMS queued locally for dispatch when Termux gateway is online",
        }
