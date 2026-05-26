from pydantic import BaseModel
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

    class Config:
        orm_mode = True
        from_attributes = True
