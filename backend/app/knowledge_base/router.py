from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import RedirectResponse

from app.auth.models import User
from app.auth.repository import get_user_by_username
from app.common.deps import get_db, get_current_user
from app.common.exceptions import UnauthorizedException
from app.common.response import success
from app.common.security import decode_access_token
from app.knowledge_base.schemas import KnowledgeBaseCreate, DocumentResponse
from app.knowledge_base import service as kb_service

router = APIRouter(prefix='/api/knowledge-bases', tags=['知识库'])

@router.post("", status_code=201)
async def create_knowledge_base(
        data: KnowledgeBaseCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    kb = await kb_service.create_knowledge_base(db, str(current_user.id), data)
    return success(data=kb.model_dump(), message="创建成功", code=201)

@router.get("")
async def list_knowledge_bases(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    kb_list = await kb_service.list_knowledge_bases(db, str(current_user.id))
    return success(data=[kb.model_dump() for kb in kb_list])

@router.get("/{kb_id}")
async def get_knowledge_base(
        kb_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    kb = await kb_service.get_knowledge_base(db, str(current_user.id), kb_id)
    return success(data=kb.model_dump())

@router.delete("/{kb_id}")
async def delete_knowledge_base(
        kb_id: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    await kb_service.delete_knowledge_base(db, str(current_user.id), kb_id)
    return success(message="删除成功")

@router.post("/{kb_id}/documents", status_code=201)
async def upload_document(
        kb_id: str,
        file: UploadFile = File(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    content = await file.read()
    doc = await kb_service.upload_document(db, str(current_user.id), kb_id, file.filename, content)
    return success(data={
        "id": str(doc.id),
        "filename": doc.filename,
        'status': doc.status
    }, message="上传成功", code=201)

@router.get("/{kb_id}/documents")
async def list_documents(
    kb_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = await kb_service.list_documents(db,str(current_user.id), kb_id)
    result = []
    for doc in docs:
        resp = DocumentResponse.model_validate(doc)
        result.append(resp.model_dump())
    return success(data=result)

@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_document(
    kb_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await kb_service.delete_document(db, str(current_user.id), kb_id, doc_id)
    return success(message='删除成功')


@router.get("/{kb_id}/documents/{doc_id}/download")
async def download_document(
    kb_id: str,
    doc_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = decode_access_token(token)
    except ValueError:
        raise UnauthorizedException(message="无效的认证信息")
    username = payload.get("sub")
    user = await get_user_by_username(db, username)
    if not user:
        raise UnauthorizedException(message="用户不存在")
    url, filename = await kb_service.get_document_presigned_url(db, str(user.id), kb_id, doc_id)
    return RedirectResponse(url=url)