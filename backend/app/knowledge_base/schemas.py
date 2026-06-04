from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str | None = None

class KnowledgeBaseResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    user_id: UUID
    document_count: int = 0
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {
        'from_attributes': True
    }

class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_size: int
    chunk_count: int
    status: str
    created_at: datetime | None

    model_config = {
        'from_attributes': True
    }

class ConversationKnowledgeBaseAdd(BaseModel):
    knowledge_base_ids: list[str]