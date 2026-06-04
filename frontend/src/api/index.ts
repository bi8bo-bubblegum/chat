import type { ApiResponse, TokenData, User, Conversation, MessageListData, KnowledgeBase, Document } from "../types";

const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (json.code === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error(json.message);
  }

  return json;
}

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { username: string; password: string }) =>
    request<TokenData>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: () =>
    request<User>("/auth/me", { method: "POST" }),
};

export const conversationApi = {
  create: (data?: { title?: string }) =>
    request<Conversation>("/conversations", { method: "POST", body: JSON.stringify(data || {}) }),

  list: () =>
    request<Conversation[]>("/conversations"),

  get: (id: string) =>
    request<Conversation>(`/conversations/${id}`),

  delete: (id: string) =>
    request<null>(`/conversations/${id}`, { method: "DELETE" }),
};

export const messageApi = {
  list: (conversationId: string, limit = 50, offset = 0) =>
    request<MessageListData>(`/messages/${conversationId}?limit=${limit}&offset=${offset}`),
};

export async function* chatStream(conversationId: string, message: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/chat/${conversationId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    let errorMsg = `请求失败 (${res.status})`;
    try {
      const errBody = await res.json();
      errorMsg = errBody.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.type === "error") {
          throw new Error(data.message || "AI 回复出错");
        }
        yield data;
      }
    }
  }
}

// ─── 知识库 API ───

export const knowledgeBaseApi = {
  create: (data: { name: string; description?: string }) =>
    request<KnowledgeBase>("/knowledge-bases", { method: "POST", body: JSON.stringify(data) }),

  list: () =>
    request<KnowledgeBase[]>("/knowledge-bases"),

  get: (id: string) =>
    request<KnowledgeBase>(`/knowledge-bases/${id}`),

  delete: (id: string) =>
    request<null>(`/knowledge-bases/${id}`, { method: "DELETE" }),

  uploadDocument: (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}/knowledge-bases/${kbId}/documents`, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    }).then((res) => res.json());
  },

  listDocuments: (kbId: string) =>
    request<Document[]>(`/knowledge-bases/${kbId}/documents`),

  deleteDocument: (kbId: string, docId: string) =>
    request<null>(`/knowledge-bases/${kbId}/documents/${docId}`, { method: "DELETE" }),
};

// ─── 对话-知识库关联 API ───

export const conversationKbApi = {
  add: (conversationId: string, knowledgeBaseIds: string[]) =>
    request<null>(`/conversations/${conversationId}/knowledge-bases`, {
      method: "POST",
      body: JSON.stringify({ knowledge_base_ids: knowledgeBaseIds }),
    }),

  remove: (conversationId: string, kbId: string) =>
    request<null>(`/conversations/${conversationId}/knowledge-bases/${kbId}`, { method: "DELETE" }),

  list: (conversationId: string) =>
    request<KnowledgeBase[]>(`/conversations/${conversationId}/knowledge-bases`),
};
