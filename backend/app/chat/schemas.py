from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str

class TokenEvent(BaseModel):
    type: str = 'token'
    content: str

class DoneEvent(BaseModel):
    type: str = 'done'
    conversation_id: str

class ErrorEvent(BaseModel):
    type: str = 'error'
    message: str

class TitleUpdateEvent(BaseModel):
    type: str = 'title_update'
    conversation_id: str
    title: str

class ToolStartEvent(BaseModel):
    type: str = 'tool_start'
    name: str
    args: dict

class ToolEndEvent(BaseModel):
    type: str = 'tool_end'
    name: str
    output: str