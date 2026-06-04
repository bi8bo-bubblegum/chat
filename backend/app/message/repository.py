from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.message.models import Message


async def create_message(db: AsyncSession, message: Message) -> Message:
    db.add(message)
    await db.flush()
    return  message

async def list_message_by_conversation(db: AsyncSession, conversation_id: str, limit: int = 50, offset: int = 0) -> list[Message]:
    sql = (select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .offset(offset))
    result = await db.execute(sql)
    return list(result.scalars().all())

async def count_message_by_conversation(db: AsyncSession, conversation_id: str) -> int:
    sql = (select(func.count()).select_from(Message)
           .where(Message.conversation_id == conversation_id))
    result = await db.execute(sql)
    return result.scalar_one()