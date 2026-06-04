from sqlalchemy.ext.asyncio import AsyncSession

from app.message.models import Message
from app.message.repository import create_message, list_message_by_conversation, count_message_by_conversation
from app.message.schemas import MessageResponse, MessageListResponse
from app.conversation import service as conversation_service


async def save_message(
        db:AsyncSession,
        conversation_id: str,
        role: str,
        content: str
):
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content
    )
    message = await create_message(db, message)
    return MessageResponse.model_validate(message)

async def get_conversation_messages(
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
        limit: int = 50,
        offset: int = 0
) -> MessageListResponse:
    await conversation_service.get_conversation(db, user_id, conversation_id)
    messages = await list_message_by_conversation(db, conversation_id, limit, offset)
    total = await count_message_by_conversation(db, conversation_id)

    return MessageListResponse(
        conversation_id=conversation_id,
        total=total,
        messages=[MessageResponse.model_validate(message) for message in messages]
    )

