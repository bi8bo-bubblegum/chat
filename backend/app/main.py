from contextlib import asynccontextmanager

from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from starlette.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.conversation.router import router as conversation_router
from app.message.router import router as message_router
from app.chat.router import router as chat_router
from app.knowledge_base.router import router as knowledge_base_router
from app.common.config import settings
from app.common.exceptions import register_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    checkpointer_db_url = settings.DATABASE_URL.replace("+asyncpg", "")
    checkpointer_ctx = AsyncPostgresSaver.from_conn_string(checkpointer_db_url)
    checkpointer = await checkpointer_ctx.__aenter__()
    try:
        await checkpointer.setup()
        app.state.checkpointer = checkpointer
        yield
    finally:
        await checkpointer_ctx.__aexit__(None, None, None)


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router=auth_router)
app.include_router(router=conversation_router)
app.include_router(router=message_router)
app.include_router(router=chat_router)
app.include_router(router=knowledge_base_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
