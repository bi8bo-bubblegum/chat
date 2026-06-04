export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  user_id: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string;
}

export interface TokenData {
  access_token: string;
  token_type: string;
}

export interface MessageListData {
  conversation_id: string;
  messages: Message[];
  total: number;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  document_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Document {
  id: string;
  filename: string;
  file_size: number;
  chunk_count: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string | null;
}
