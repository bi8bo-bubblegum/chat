from datetime import datetime

from langchain_core.tools import tool

from app.common.database import async_session_factory
from app.knowledge_base import service as kb_service


@tool
async def knowledge_search(query: str, knowledge_base_ids: list[str]) -> str:
    """当用户的问题与知识库中的文档内容相关时，使用此工具搜索知识库获取相关信息。

    使用场景：
    - 用户询问与已上传文档相关的具体问题
    - 用户提到知识库中可能包含的信息
    - 需要引用文档中的具体内容来回答问题

    Args:
        query: 用于搜索的查询文本，应提取用户问题中的关键信息
        knowledge_base_ids： 要搜索的知识库id列表
    """
    async with async_session_factory() as db:
        try:
            results = await kb_service.search_knowledge(db, query, knowledge_base_ids, top_k=5)
            if not results:
                return "未在知识库中找到相关内容。"
            return "\n\n---\n\n".join(results)
        except Exception as e:
            return f"知识库检索出错: {str(e)}"


@tool
def get_cur_date() -> str:
    """当用户询问日期时调用该工具，比如：今天多少号，今天的日期是多少等。"""
    return datetime.now().strftime("%Y-%m-%d")
