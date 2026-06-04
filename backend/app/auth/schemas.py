from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    created_at: datetime | None = None
    model_config = {
        'from_attributes': True
    }

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'