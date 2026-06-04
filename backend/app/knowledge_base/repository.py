from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.knowledge_base.models import KnowledgeBase, Document, DocumentChunk


async def create_knowledge_base(db: AsyncSession, knowledge_base: KnowledgeBase) -> KnowledgeBase:
    db.add(knowledge_base)
    await db.flush()
    return knowledge_base

async def list_knowledge_bases_by_user(db: AsyncSession, user_id: str) -> list[KnowledgeBase]:
    sql = (select(KnowledgeBase)
           .where(KnowledgeBase.user_id == UUID(user_id))
           .order_by(KnowledgeBase.created_at.desc()))
    result = await db.execute(sql)
    return list(result.scalars().all())

async def get_knowledge_base_by_id(db: AsyncSession, knowledge_base_id: str) -> KnowledgeBase | None:
    sql = (select(KnowledgeBase)
           .where(KnowledgeBase.id == UUID(knowledge_base_id)))
    result =await db.execute(sql)
    return result.scalar_one_or_none()

async def delete_knowledge_base(db: AsyncSession, kb: KnowledgeBase) -> None:
    await db.delete(kb)
    await db.flush()

async def count_documents_by_kb(db: AsyncSession, kb_id: str) -> int:
    sql = (select(func.count(Document.id))
           .where(Document.knowledge_base_id == UUID(kb_id)))
    result = await db.execute(sql)
    return result.scalar() or 0

async def create_document(db: AsyncSession, doc: Document) -> Document:
    db.add(doc)
    await db.flush()
    return doc

async def get_document_by_id(db: AsyncSession, doc_id: str) -> Document | None:
    sql = (select(Document)
           .where(Document.id == UUID(doc_id)))
    result =await db.execute(sql)
    return result.scalar_one_or_none()

async def list_documents_by_kb(db: AsyncSession, kb_id: str) -> list[Document]:
    sql = (select(Document)
           .where(Document.knowledge_base_id == UUID(kb_id))
           .order_by(Document.created_at.desc()))
    result = await db.execute(sql)
    return list(result.scalars().all())

async def delete_document(db: AsyncSession, doc: Document) -> None:
    await db.delete(doc)
    await db.flush()

async def update_document_status(db: AsyncSession, doc_id: str, status: str, chunk_count: int = 0) -> None:
    doc = await get_document_by_id(db, doc_id)
    if doc:
        doc.status = status
        doc.chunk_count = chunk_count
        await db.flush()

async def insert_chunks(db: AsyncSession, chunks: list[DocumentChunk]) -> None:
    db.add_all(chunks)
    await db.flush()

async def search_similar_chunks(
    db: AsyncSession,
    query_embedding: list[float],
    knowledge_base_ids: list[str],
    top_k: int = 5
) -> list[DocumentChunk]:
    """余弦相似度检索"""
    kb_uuids = [UUID(kb_id) for kb_id in knowledge_base_ids]
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.knowledge_base_id.in_(kb_uuids))
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    return list(result.scalars().all())