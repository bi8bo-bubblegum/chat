from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.deps import get_current_user, get_db
from app.common.response import success
from app.auth.models import User
from app.message import service

router = APIRouter(prefix="/api/messages", tags=["消息"])


@router.get("/{conversation_id}")
async def get_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await service.get_conversation_messages(
        db, conversation_id, str(current_user.id), limit, offset
    )
    return success(data=result.model_dump())