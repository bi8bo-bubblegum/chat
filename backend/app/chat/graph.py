from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.prebuilt import tools_condition

from app.chat.nodes import chat_node, tool_node
from app.chat.state import ChatState


def build_graph(checkpointer: AsyncPostgresSaver):
    graph = StateGraph(ChatState)

    # 添加节点
    graph.add_node('chat_node', chat_node)
    graph.add_node('tool_node', tool_node)

    # 添加边
    graph.add_edge(START, 'chat_node')

    # 条件边：如果 LLM 返回 tool_calls，则进入 tool_node；否则结束
    graph.add_conditional_edges('chat_node', tools_condition, {
        'tools': 'tool_node',
        '__end__': END,
    })

    # tool_node 执行完后回到 chat_node 继续生成回答
    graph.add_edge('tool_node', 'chat_node')

    return graph.compile(checkpointer=checkpointer)