from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.deps import get_current_user, get_db
from app.common.response import success
from app.auth.models import User
from app.conversation.schemas import ConversationCreate
from app.conversation import service
from app.knowledge_base.schemas import ConversationKnowledgeBaseAdd

router = APIRouter(prefix="/api/conversations", tags=["会话"])


@router.post("", status_code=201)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await service.create_new_conversation(db, str(current_user.id), data)
    return success(data=conversation.model_dump(), message="创建成功", code=201)


@router.get("")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = await service.list_conversations(db, str(current_user.id))
    return success(data=[c.model_dump() for c in conversations])


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await service.get_conversation(db, conversation_id, str(current_user.id))
    return success(data=conversation.model_dump())


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await service.delete_conversation(db, conversation_id, str(current_user.id))
    return success(message="删除成功")

@router.post("/{conversation_id}/knowledge-bases")
async def add_knowledge_bases(
    conversation_id: str,
    data: ConversationKnowledgeBaseAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await service.add_knowledge_bases_to_conversation(db, str(current_user.id), conversation_id, data.knowledge_base_ids)
    return success(message='关联成功')


@router.delete("/{conversation_id}/knowledge-bases/{kb_id}")
async def remove_knowledge_base(
    conversation_id: str,
    kb_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await service.remove_knowledge_base_from_conversation(db, str(current_user.id), conversation_id, kb_id)
    return success(message='取消关联成功')


@router.get("/{conversation_id}/knowledge-bases")
async def list_conversation_knowledge_bases(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    kb_list = await service.list_conversation_knowledge_bases(db, str(current_user.id), conversation_id)
    return success(data=[kb.model_dump() for kb in kb_list])