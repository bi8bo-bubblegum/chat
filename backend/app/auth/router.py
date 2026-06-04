from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.models import User
from app.auth.schemas import UserCreate, UserLogin
from app.common.deps import get_db, get_current_user
from app.common.response import success

router = APIRouter(prefix='/api/auth', tags=['认证'])

@router.post('/register', status_code=201)
async def register(user_create: UserCreate, db: AsyncSession = Depends(get_db)):
    user = await service.register(db, user_create)
    return success(data=user.model_dump(), message='注册成功')

@router.post('/login')
async def login(user_login: UserLogin, db: AsyncSession = Depends(get_db)):
    token = await service.login(db, user_login)
    return success(data=token.model_dump(), message='登录成功')

@router.post('/me')
async def get_me(current_user: User = Depends(get_current_user)):
    return success(
        data={
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email
        }
    )