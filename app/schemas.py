from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ScheduleCreate(BaseModel):
    equipment_id: int
    user_id: int
    start_time: datetime
    end_time: datetime

class ScheduleUpdate(BaseModel):
    start_time: datetime
    end_time: datetime

    class Config:
        from_attributes = True

class ScheduleResponse(ScheduleCreate):
    id: int
    status: str

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    class Config:
        from_attributes = True

class EquipmentBase(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class PermissionResponse(BaseModel):
    id: int
    status: str
    granted_at: datetime
    expiration_date: Optional[datetime] = None
    # Aqui está o segredo: incluímos os modelos acima
    user: UserBase 
    equipment: EquipmentBase

    class Config:
        from_attributes = True

class DateUpdate(BaseModel):
    expiration_date: datetime