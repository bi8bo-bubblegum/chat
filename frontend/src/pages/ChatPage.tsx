import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { conversationApi, messageApi, chatStream, knowledgeBaseApi, conversationKbApi } from "../api";
import type { Conversation, Message, KnowledgeBase } from "../types";
import {
  Plus,
  MessageCircle,
  LogOut,
  Send,
  Trash2,
  X,
  Loader2,
  Database,
  XCircle,
} from "lucide-react";

export default function ChatPage() {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolStatus, setToolStatus] = useState<{ name: string; loading: boolean } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 知识库关联相关
  const [allKnowledgeBases, setAllKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [linkedKbIds, setLinkedKbIds] = useState<string[]>([]);
  const [showKbSelector, setShowKbSelector] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAllKnowledgeBases();
    }
  }, [user]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      loadLinkedKbs(activeId);
    } else {
      setMessages([]);
      setLinkedKbIds([]);
    }
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const loadConversations = async () => {
    try {
      const res = await conversationApi.list();
      if (res.code === 200 && res.data) {
        setConversations(res.data);
      }
    } catch {}
  };

  const loadMessages = async (id: string) => {
    try {
      const res = await messageApi.list(id);
      if (res.code === 200 && res.data) {
        setMessages(res.data.messages);
      }
    } catch {}
  };

  const loadAllKnowledgeBases = async () => {
    try {
      const res = await knowledgeBaseApi.list();
      if (res.code === 200 && res.data) {
        setAllKnowledgeBases(res.data);
      }
    } catch {}
  };

  const loadLinkedKbs = async (convId: string) => {
    try {
      const res = await conversationKbApi.list(convId);
      if (res.code === 200 && res.data) {
        setLinkedKbIds(res.data.map((kb) => kb.id));
      }
    } catch {}
  };

  const handleToggleKb = async (kbId: string) => {
    if (!activeId) return;
    try {
      if (linkedKbIds.includes(kbId)) {
        await conversationKbApi.remove(activeId, kbId);
      } else {
        await conversationKbApi.add(activeId, [kbId]);
      }
      // 从服务端重新加载关联状态，确保与后端一致
      await loadLinkedKbs(activeId);
    } catch (e) {
      console.error("切换知识库关联失败", e);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await conversationApi.create();
      if (res.code === 201 && res.data) {
        setConversations((prev) => [res.data!, ...prev]);
        setActiveId(res.data.id);
        activeIdRef.current = res.data.id;
      }
    } catch {}
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await conversationApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        activeIdRef.current = null;
        setMessages([]);
      }
    } catch {}
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeId || streaming) return;

    setInput("");
    setStreaming(true);
    setStreamText("");
    setToolStatus(null);

    // 记录发起时的对话ID，用于检测切换
    const streamConvId = activeId;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: streamConvId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      let full = "";
      for await (const event of chatStream(streamConvId, text)) {
        // 如果用户已切换到其他对话，中断流式输出
        if (activeIdRef.current !== streamConvId) break;

        if (event.type === "token") {
          full += event.content;
          setStreamText(full);
          setToolStatus(null);
        } else if (event.type === "tool_start") {
          setToolStatus({ name: event.name, loading: true });
        } else if (event.type === "tool_end") {
          setToolStatus({ name: event.name, loading: false });
        } else if (event.type === "done") {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            conversation_id: streamConvId,
            role: "assistant",
            content: full,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamText("");
        } else if (event.type === "title_update") {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === event.conversation_id ? { ...c, title: event.title } : c
            )
          );
        }
      }
    } catch (err) {
      if (activeIdRef.current !== streamConvId) return;
      const errMsg = err instanceof Error ? err.message : "未知错误";
      if (streamText) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          conversation_id: streamConvId,
          role: "assistant",
          content: streamText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamText("");
      }
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: streamConvId,
        role: "assistant",
        content: `⚠️ ${errMsg}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setStreaming(false);
      setToolStatus(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const activeConversation = conversations.find((c) => c.id === activeId);
  const linkedKbs = allKnowledgeBases.filter((kb) => linkedKbIds.includes(kb.id));

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div
        style={{
          ...styles.sidebar,
          width: sidebarOpen ? "280px" : "0px",
          minWidth: sidebarOpen ? "280px" : "0px",
          padding: sidebarOpen ? "16px" : "0px",
          overflow: "hidden",
        }}
      >
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>对话</h2>
          <button onClick={handleNewConversation} style={styles.iconBtn} title="新建对话">
            <Plus size={18} />
          </button>
        </div>

        <div style={styles.conversationList}>
          {conversations.length === 0 && (
            <div style={styles.emptySidebar}>暂无对话</div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => { setActiveId(conv.id); activeIdRef.current = conv.id; }}
              style={{
                ...styles.conversationItem,
                background:
                  activeId === conv.id
                    ? "var(--accent-dim)"
                    : "transparent",
                borderLeft:
                  activeId === conv.id
                    ? "3px solid var(--accent)"
                    : "3px solid transparent",
              }}
            >
              <MessageCircle size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
              <span style={styles.conversationTitle}>
                {conv.title || "新对话"}
              </span>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                style={styles.deleteBtn}
                title="删除对话"
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.color = "var(--error, #ef4444)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.4";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* 知识库入口 */}
        <div
          style={styles.kbEntry}
          onClick={() => navigate("/knowledge")}
        >
          <Database size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
          <span style={styles.kbEntryText}>知识库</span>
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.avatar}>{user?.username?.[0]?.toUpperCase()}</div>
            <span style={styles.username}>{user?.username}</span>
          </div>
          <button onClick={handleLogout} style={styles.iconBtn} title="退出登录">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.main}>
        {/* Chat Header */}
        <div style={styles.chatHeader}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={styles.iconBtn}
          >
            {sidebarOpen ? <X size={18} /> : <MessageCircle size={18} />}
          </button>
          <span style={styles.chatTitle}>
            {activeConversation?.title || "ChatDemo"}
          </span>
          {activeId && (
            <button
              onClick={() => setShowKbSelector(!showKbSelector)}
              style={{
                ...styles.iconBtn,
                marginLeft: "auto",
                color: linkedKbIds.length > 0 ? "var(--accent)" : "var(--text-secondary)",
              }}
              title="关联知识库"
            >
              <Database size={18} />
              {linkedKbIds.length > 0 && (
                <span style={styles.kbBadge}>{linkedKbIds.length}</span>
              )}
            </button>
          )}
        </div>

        {/* 知识库选择器弹窗 */}
        {showKbSelector && activeId && (
          <div style={styles.kbSelectorOverlay} onClick={() => setShowKbSelector(false)}>
            <div style={styles.kbSelectorCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.kbSelectorHeader}>
                <span style={styles.kbSelectorTitle}>关联知识库</span>
                <button onClick={() => setShowKbSelector(false)} style={styles.iconBtn}>
                  <X size={16} />
                </button>
              </div>
              <div style={styles.kbSelectorList}>
                {allKnowledgeBases.length === 0 && (
                  <div style={styles.kbSelectorEmpty}>
                    暂无知识库，请先
                    <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => navigate("/knowledge")}>创建知识库</span>
                  </div>
                )}
                {allKnowledgeBases.map((kb) => (
                  <div
                    key={kb.id}
                    style={{
                      ...styles.kbSelectorItem,
                      background: linkedKbIds.includes(kb.id) ? "var(--accent-dim)" : "transparent",
                    }}
                    onClick={() => handleToggleKb(kb.id)}
                  >
                    <div style={{
                      ...styles.kbCheckbox,
                      background: linkedKbIds.includes(kb.id) ? "var(--accent)" : "transparent",
                      border: linkedKbIds.includes(kb.id) ? "2px solid var(--accent)" : "2px solid var(--border)",
                    }}>
                      {linkedKbIds.includes(kb.id) && (
                        <span style={{ color: "#fff", fontSize: "10px" }}>✓</span>
                      )}
                    </div>
                    <div style={styles.kbItemInfo}>
                      <span style={styles.kbItemName}>{kb.name}</span>
                      <span style={styles.kbItemDesc}>{kb.document_count} 个文档</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={styles.messagesArea}>
          {!activeId ? (
            <div style={styles.welcome}>
              <div style={styles.welcomeIcon}>
                <MessageCircle size={40} />
              </div>
              <h2 style={styles.welcomeTitle}>ChatDemo</h2>
              <p style={styles.welcomeSubtitle}>
                点击左侧「+」创建新对话，开始聊天
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent:
                      msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      background:
                        msg.role === "user"
                          ? "var(--user-bubble)"
                          : "var(--assistant-bubble)",
                      color:
                        msg.role === "user" ? "#fff" : "var(--text-primary)",
                      borderBottomRightRadius:
                        msg.role === "user" ? "4px" : "var(--radius-lg)",
                      borderBottomLeftRadius:
                        msg.role === "assistant" ? "4px" : "var(--radius-lg)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {streamText && (
                <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
                  <div
                    style={{
                      ...styles.bubble,
                      background: "var(--assistant-bubble)",
                      borderBottomLeftRadius: "4px",
                    }}
                  >
                    {streamText}
                    <span style={styles.cursor}>▌</span>
                  </div>
                </div>
              )}

              {streaming && !streamText && !toolStatus && (
                <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
                  <div style={{ ...styles.bubble, background: "var(--assistant-bubble)", borderBottomLeftRadius: "4px" }}>
                    <Loader2 size={16} style={{ animation: "pulse 1s infinite" }} />
                  </div>
                </div>
              )}

              {streaming && toolStatus && (
                <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
                  <div style={{ ...styles.bubble, background: "var(--assistant-bubble)", borderBottomLeftRadius: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {toolStatus.loading && <Loader2 size={14} style={{ animation: "pulse 1s infinite" }} />}
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      {toolStatus.loading ? `正在调用 ${toolStatus.name}...` : `${toolStatus.name} 调用完成`}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        {activeId && (
          <div style={styles.inputArea}>
            {/* 已关联知识库标签 */}
            {linkedKbs.length > 0 && (
              <div style={styles.kbTags}>
                {linkedKbs.map((kb) => (
                  <span key={kb.id} style={styles.kbTag}>
                    <Database size={10} />
                    {kb.name}
                    <XCircle
                      size={12}
                      style={{ cursor: "pointer", opacity: 0.6 }}
                      onClick={() => handleToggleKb(kb.id)}
                    />
                  </span>
                ))}
              </div>
            )}
            <div style={styles.inputWrapper}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                style={styles.textarea}
                rows={1}
                disabled={streaming}
              />
              <button
                onClick={handleSend}
                style={{
                  ...styles.sendBtn,
                  opacity: input.trim() && !streaming ? 1 : 0.4,
                  cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
                }}
                disabled={!input.trim() || streaming}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "100vh",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    transition: "all 0.2s ease",
    overflow: "hidden",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
  },
  sidebarTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "var(--radius-sm)",
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all var(--transition)",
    position: "relative" as const,
  },
  conversationList: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  emptySidebar: {
    padding: "24px 8px",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  conversationItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "background var(--transition)",
    position: "relative",
  },
  conversationTitle: {
    flex: 1,
    fontSize: "14px",
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  deleteBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    opacity: 0.4,
    transition: "all var(--transition)",
    flexShrink: 0,
  },
  kbEntry: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "background var(--transition)",
    borderTop: "1px solid var(--border)",
    marginTop: "8px",
  },
  kbEntryText: {
    fontSize: "14px",
    color: "var(--text-primary)",
  },
  sidebarFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
    marginTop: "8px",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 600,
  },
  username: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  chatTitle: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--text-primary)",
  },
  kbBadge: {
    position: "absolute" as const,
    top: "2px",
    right: "2px",
    background: "var(--accent)",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 600,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kbSelectorOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "80px",
    zIndex: 1000,
  },
  kbSelectorCard: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    width: "400px",
    maxHeight: "480px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "var(--shadow-lg)",
    animation: "fadeIn 0.15s ease",
  },
  kbSelectorHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
  },
  kbSelectorTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  kbSelectorList: {
    padding: "8px",
    overflowY: "auto",
    flex: 1,
  },
  kbSelectorEmpty: {
    padding: "24px",
    textAlign: "center",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  kbSelectorItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "background var(--transition)",
  },
  kbCheckbox: {
    width: "18px",
    height: "18px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  kbItemInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  kbItemName: {
    fontSize: "14px",
    color: "var(--text-primary)",
  },
  kbItemDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  welcome: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    animation: "fadeIn 0.5s ease",
  },
  welcomeIcon: {
    width: "72px",
    height: "72px",
    borderRadius: "20px",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  welcomeSubtitle: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  messageRow: {
    display: "flex",
    animation: "fadeIn 0.2s ease",
  },
  bubble: {
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "var(--radius-lg)",
    fontSize: "14px",
    lineHeight: 1.6,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  cursor: {
    animation: "pulse 0.8s infinite",
    color: "var(--accent)",
    marginLeft: "2px",
  },
  inputArea: {
    padding: "16px 20px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  kbTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "8px",
  },
  kbTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    borderRadius: "12px",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    fontSize: "12px",
    fontWeight: 500,
  },
  inputWrapper: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "8px 8px 8px 16px",
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontSize: "14px",
    lineHeight: 1.5,
    resize: "none",
    minHeight: "24px",
    maxHeight: "120px",
    fontFamily: "var(--font-sans)",
  },
  sendBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-md)",
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    transition: "all var(--transition)",
    flexShrink: 0,
  },
};
