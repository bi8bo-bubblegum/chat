from fastapi import FastAPI, Request
from starlette.responses import JSONResponse


class BusinessException(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message

class NotFoundException(BusinessException):
    def __init__(self, message: str = '资源不存在'):
        super().__init__(404, message)

class UnauthorizedException(BusinessException):
    def __init__(self, message: str = '未授权,请先登录'):
        super().__init__(401, message)

class ForbiddenException(BusinessException):
    def __init__(self, message: str = '无权限访问'):
        super().__init__(403, message)

import logging

logger = logging.getLogger(__name__)

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BusinessException)
    async def business_exception_handler(_request: Request, exc: BusinessException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.code,
            content={
                'code': exc.code,
                'data': None,
                'message': exc.message
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(f"Unexpected error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                'code': 500,
                'data': None,
                'message': '服务器内部错误'
            }
        )