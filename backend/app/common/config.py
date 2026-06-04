from pathlib import Path

from pydantic_settings import (BaseSettings)

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    DATABASE_URL: str
    DEEPSEEK_API_KEY: str
    DEEPSEEK_BASE_URL: str
    DEEPSEEK_MODEL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    APP_NAME: str = 'ChatDemo'
    EMBEDDING_MODEL: str
    EMBEDDING_API_KEY: str
    EMBEDDING_BASE_URL: str
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    RETRIEVAL_TOP_K: int = 5
    COS_SECRET_ID: str
    COS_SECRET_KEY: str
    COS_REGION: str
    COS_BUCKET: str
    COS_SCHEMA: str

    model_config = {
        'env_file': BASE_DIR / '.env',
        'env_file_encoding': 'utf-8'
    }

settings = Settings()