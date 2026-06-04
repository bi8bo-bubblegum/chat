from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode

from app.chat.state import ChatState
from app.chat.tool import knowledge_search, get_cur_date
from app.common.config import settings

llm = ChatOpenAI(
    model=settings.DEEPSEEK_MODEL,
    api_key=settings.DEEPSEEK_API_KEY,
    base_url=settings.DEEPSEEK_BASE_URL,
    streaming=True,
    extra_body={"enable_thinking": False},
).bind_tools([knowledge_search, get_cur_date])


async def chat_node(state: ChatState):
    """主聊天节点：统一使用带 tools 的 LLM，AI 自主决定是否调用工具"""
    kb_ids = state.get('knowledge_base_ids', [])

    if kb_ids:
        system_msg = SystemMessage(
            content=(
                "你是一个智能助手。当用户的问题可能与知识库文档相关时，"
                "请使用 knowledge_search 工具搜索知识库获取相关信息，"
                "然后基于检索到的内容回答用户问题。"
                "只能基于检索到的内容回答，不要额外增添其他内容，"
                "注意：一定不要自己编造问题的答案"
                f"\n\n当前对话关联的知识库ID: {kb_ids}"
            )
        )
        messages = [system_msg] + state['messages']
    else:
        messages = state['messages']

    response = await llm.ainvoke(messages)
    return {'messages': [response]}

async def tool_node(state: ChatState):
    """工具执行节点：处理 LLM 返回的 tool_calls"""
    tools = [knowledge_search, get_cur_date]
    tool_node_instance = ToolNode(tools)
    return await tool_node_instance.ainvoke(state)