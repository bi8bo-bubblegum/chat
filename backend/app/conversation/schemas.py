from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    title: str | None = None

class ConversationResponse(BaseModel):
    id: UUID
    title: str | None
    user_id: UUID
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {
        'from_attributes': True
    }