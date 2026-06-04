from typing import TypeVar, Generic, Any

from pydantic import BaseModel

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    code: int
    data: T | None
    message: str

def success(data: Any = None, message: str = 'success', code: int = 200) -> dict:
    return {
        'code': code,
        'data': data,
        'message': message
    }

def error(code: int, message: str):
    return {
        'code': code,
        'data': None,
        'message': message
    }