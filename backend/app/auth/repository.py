from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    sql = select(User).where(User.username == username)
    result = await db.execute(sql)
    return result.scalar_one_or_none()

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    sql = select(User).where(User.email == email)
    result = await db.execute(sql)
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user: User):
    db.add(user)
    await db.flush()
    return user