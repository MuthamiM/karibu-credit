from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class AuditLogBase(BaseModel):
    user: str
    action: str
    details: str
    ip: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

