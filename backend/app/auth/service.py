from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.repository import get_user_by_username, get_user_by_email, create_user
from app.auth.schemas import UserCreate, UserResponse, UserLogin, TokenResponse
from app.common.exceptions import BusinessException
from app.common.security import hash_password, verify_password, create_access_token


async def register(db: AsyncSession, user_create: UserCreate) -> UserResponse:
    if await get_user_by_username(db, user_create.username):
        raise BusinessException(code=400, message='用户已存在')

    if await get_user_by_email(db, user_create.email):
        raise BusinessException(code=400, message='邮箱已存在')

    user = User(
        username = user_create.username,
        email = user_create.email,
        hashed_password = hash_password(user_create.password)
    )

    user = await create_user(db, user)
    return UserResponse.model_validate(user)

async def login(db: AsyncSession, user_login: UserLogin) -> TokenResponse:
    user = await get_user_by_username(db, user_login.username)
    if not user or not verify_password(user_login.password, user.hashed_password):
        raise BusinessException(code=401, message='用户名或密码错误')

    access_token = create_access_token(data={'sub': user.username})
    return TokenResponse(access_token=access_token)
