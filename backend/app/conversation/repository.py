from sqlalchemy.ext.asyncio import AsyncSession

from app.conversation.models import Conversation


async def create_conversation(db: AsyncSession, conversation: Conversation) -> Conversation:
    db.add(conversation)
    await db.flush()
    return conversation

async def list_active_conversation_by_user(db: AsyncSession, user_id: str) -> list[Conversation]:
    sql = (select(Conversation)
           .where(Conversation.user_id == user_id, Conversation.is_active == True)
           .order_by(Conversation.created_at.desc())
           )
    result = await db.execute(sql)
    return list(result.scalars().all())

async def get_conversation_by_id(db: AsyncSession, conversation_id: str) -> Conversation | None:
    sql = (select(Conversation)
           .where(Conversation.id == conversation_id)
           )
    result = await db.execute(sql)
    return result.scalar_one_or_none()

async def soft_delete_conversation(db: AsyncSession, conversation: Conversation) -> None:
    conversation.is_active = False
    await db.flush()

async def update_title(db: AsyncSession, conversation_id: str, title: str):
    sql = (select(Conversation)
           .where(Conversation.id == conversation_id)
           )
    result = await db.execute(sql)
    conversation = result.scalar_one_or_none()
    if conversation:
        conversation.title = title
        await db.flush()

from uuid import UUID
from sqlalchemy import select, delete
from app.conversation.models import ConversationKnowledgeBase
from app.knowledge_base.models import KnowledgeBase


async def add_knowledge_bases_to_conversation(db: AsyncSession, conversation_id: str, kb_ids: list[str]) -> None:
    for kb_id in kb_ids:
        assoc = ConversationKnowledgeBase(
            conversation_id=UUID(conversation_id),
            knowledge_base_id=UUID(kb_id),
        )
        db.add(assoc)
    await db.flush()


async def remove_knowledge_base_from_conversation(db: AsyncSession, conversation_id: str, kb_id: str) -> None:
    await db.execute(
        delete(ConversationKnowledgeBase)
        .where(
            ConversationKnowledgeBase.conversation_id == UUID(conversation_id),
            ConversationKnowledgeBase.knowledge_base_id == UUID(kb_id),
        )
    )
    await db.flush()


async def list_knowledge_bases_by_conversation(db: AsyncSession, conversation_id: str) -> list[KnowledgeBase]:
    result = await db.execute(
        select(KnowledgeBase)
        .join(ConversationKnowledgeBase, ConversationKnowledgeBase.knowledge_base_id == KnowledgeBase.id)
        .where(ConversationKnowledgeBase.conversation_id == UUID(conversation_id))
    )
    return list(result.scalars().all())


async def get_conversation_kb_ids(db: AsyncSession, conversation_id: str) -> list[str]:
    """获取对话关联的知识库ID列表"""
    result = await db.execute(
        select(ConversationKnowledgeBase.knowledge_base_id)
        .where(ConversationKnowledgeBase.conversation_id == UUID(conversation_id))
    )
    return [str(row[0]) for row in result.all()]