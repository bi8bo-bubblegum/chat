from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.common.deps import get_current_user, get_db
from app.auth.models import User
from app.chat.schemas import ChatRequest
from app.chat import service

router = APIRouter(prefix="/api/chat", tags=["聊天"])


@router.post("/{conversation_id}")
async def chat(
    conversation_id: str,
    chat_request: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checkpointer = request.app.state.checkpointer
    stream = service.chat_stream(
        conversation_id=conversation_id,
        message=chat_request.message,
        user_id=str(current_user.id),
        db=db,
        checkpointer=checkpointer,
    )
    return StreamingResponse(stream, media_type="text/event-stream")