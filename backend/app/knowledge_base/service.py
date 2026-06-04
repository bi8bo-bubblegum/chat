import io
import logging
from uuid import UUID, uuid4

from PyPDF2 import PdfReader
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.config import settings
from app.common.cos_client import upload_file, delete_file, get_presigned_url
from app.common.exceptions import NotFoundException, ForbiddenException
from app.knowledge_base.models import KnowledgeBase, Document, DocumentChunk
from app.knowledge_base import repository as kb_repo
from app.knowledge_base.schemas import KnowledgeBaseCreate, KnowledgeBaseResponse

embeddings = OpenAIEmbeddings(
    model=settings.EMBEDDING_MODEL,
    api_key=settings.EMBEDDING_API_KEY,
    base_url=settings.EMBEDDING_BASE_URL,
)

async def create_knowledge_base(db: AsyncSession, user_id: str, data: KnowledgeBaseCreate) -> KnowledgeBaseResponse:
    kb = KnowledgeBase(name=data.name, description=data.description, user_id=UUID(user_id))
    kb = await kb_repo.create_knowledge_base(db, kb)
    return KnowledgeBaseResponse.model_validate(kb)

async def list_knowledge_bases(db: AsyncSession, user_id: str) -> list[KnowledgeBaseResponse]:
    kb_list = await kb_repo.list_knowledge_bases_by_user(db, user_id)
    result = []
    for kb in kb_list:
        resp = KnowledgeBaseResponse.model_validate(kb)
        resp.document_count = await kb_repo.count_documents_by_kb(db, str(kb.id))
        result.append(resp)
    return result

async def get_knowledge_base(db: AsyncSession, user_id: str, kb_id: str) -> KnowledgeBaseResponse:
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message=f"知识库 {kb_id} 不存在")
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message="无权访问该知识库")
    resp = KnowledgeBaseResponse.model_validate(kb)
    resp.document_count = await kb_repo.count_documents_by_kb(db, str(kb.id))
    return resp

async def delete_knowledge_base(db: AsyncSession, user_id: str, kb_id: str):
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message=f"知识库 {kb_id} 不存在")
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message="无权删除该知识库")
    docs = await kb_repo.list_documents_by_kb(db, kb_id)
    for doc in docs:
        delete_file(doc.file_path)
    await kb_repo.delete_knowledge_base(db, kb)

async def upload_document(db: AsyncSession, user_id: str, kb_id: str, filename: str, file_content: bytes) -> Document:
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message=f"知识库 {kb_id} 不存在")
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message="无权访问该知识库")
    doc_id = uuid4()
    object_key = f'{user_id}/{doc_id}.pdf'

    # 上传到腾讯云 COS
    upload_file(object_key, file_content)

    doc = Document(
        id = doc_id,
        filename=filename,
        file_path=object_key,
        file_size=len(file_content),
        status='pending',
        knowledge_base_id=UUID(kb_id)
    )
    doc = await kb_repo.create_document(db, doc)
    doc_id_str = str(doc.id)
    try:
        await kb_repo.update_document_status(db, doc_id_str, 'processing')

        # 解析PDF
        text = _extract_text_from_pdf_bytes(file_content)
        if not text.strip():
            await kb_repo.update_document_status(db, doc_id_str, 'failed')
            return doc

        # 分块
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", "。", "！", "？", ".", " ", ""]
        )
        chunks_text = splitter.split_text(text)

        #向量化
        chunk_embeddings = await embeddings.aembed_documents(chunks_text)

        #保存分块
        chunks = []
        for i, (content, embedding) in enumerate(zip(chunks_text, chunk_embeddings)):
            chunk = DocumentChunk(
                content=content,
                chunk_index=i,
                embedding=embedding,
                document_id=doc.id,
                knowledge_base_id=kb.id,
            )
            chunks.append(chunk)
        await kb_repo.insert_chunks(db, chunks)

        # 更新状态
        await kb_repo.update_document_status(db, doc_id_str, 'completed', len(chunks))
    except Exception as e:
        logging.error(f"Document processing error: {e}", exc_info=True)
        await kb_repo.update_document_status(db, doc_id_str, 'failed')
    return doc


def _extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    """从 bytes 中提取 PDF 文本"""
    reader = PdfReader(io.BytesIO(file_bytes))
    text_parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_parts.append(text)
    return '\n'.join(text_parts)

async def delete_document(db: AsyncSession, user_id: str, kb_id: str, doc_id: str) -> None:
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message='知识库不存在')
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message='无权限删除')
    doc = await kb_repo.get_document_by_id(db, doc_id)
    if not doc:
        raise NotFoundException(message='文档不存在')
    delete_file(doc.file_path)
    await kb_repo.delete_document(db, doc)


async def get_document_presigned_url(db: AsyncSession, user_id: str, kb_id: str, doc_id: str, expires: int = 3600) -> tuple[str, str]:
    """获取文档预签名 URL 和文件名，用于下载/预览"""
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message='知识库不存在')
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message='无权访问')
    doc = await kb_repo.get_document_by_id(db, doc_id)
    if not doc:
        raise NotFoundException(message='文档不存在')
    url = get_presigned_url(doc.file_path, expires)
    return url, doc.filename

async def list_documents(db: AsyncSession, user_id: str, kb_id: str):
    kb = await kb_repo.get_knowledge_base_by_id(db, kb_id)
    if not kb:
        raise NotFoundException(message='知识库不存在')
    if str(kb.user_id) != user_id:
        raise ForbiddenException(message='无权访问')
    docs = await kb_repo.list_documents_by_kb(db, kb_id)
    return docs


async def search_knowledge(
    db: AsyncSession,
    query: str,
    knowledge_base_ids: list[str],
    top_k: int = 5,
) -> list[str]:
    """搜索知识库，返回相关文本片段"""
    # 1. 对查询文本向量化
    query_embedding = await embeddings.aembed_query(query)

    # 2. 在 pgvector 中检索
    chunks = await kb_repo.search_similar_chunks(db, query_embedding, knowledge_base_ids, top_k)

    # 3. 返回文本内容
    return [chunk.content for chunk in chunks]