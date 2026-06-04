import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { knowledgeBaseApi } from "../api";
import type { KnowledgeBase } from "../types";
import { Database, Plus, Trash2, ArrowLeft, FileText, X } from "lucide-react";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function KnowledgePage() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadKnowledgeBases();
    }
  }, [user]);

  const loadKnowledgeBases = async () => {
    try {
      const res = await knowledgeBaseApi.list();
      if (res.code === 200 && res.data) {
        setKnowledgeBases(res.data);
      }
    } catch (err) {
      console.error("加载知识库列表失败", err);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await knowledgeBaseApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (res.code === 201 && res.data) {
        setKnowledgeBases((prev) => [res.data!, ...prev]);
        setShowCreate(false);
        setName("");
        setDescription("");
      }
    } catch (err) {
      console.error("创建知识库失败", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除该知识库吗？此操作不可恢复。")) return;
    try {
      await knowledgeBaseApi.delete(id);
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
    } catch (err) {
      console.error("删除知识库失败", err);
    }
  };

  const closeCreateDialog = () => {
    setShowCreate(false);
    setName("");
    setDescription("");
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => navigate("/chat")}
            style={styles.iconBtn}
            title="返回对话"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={styles.pageTitle}>知识库</h1>
        </div>
        <button onClick={() => setShowCreate(true)} style={styles.createBtn}>
          <Plus size={18} />
          <span>新建</span>
        </button>
      </div>

      {/* Card Grid */}
      <div style={styles.content}>
        {knowledgeBases.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <Database size={40} />
            </div>
            <p style={styles.emptyText}>暂无知识库，点击右上角创建</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                style={styles.card}
                onClick={() => navigate(`/knowledge/${kb.id}`)}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.cardIcon}>
                    <Database size={20} />
                  </div>
                  <button
                    onClick={(e) => handleDelete(kb.id, e)}
                    style={styles.deleteBtn}
                    title="删除知识库"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.4";
                      e.currentTarget.style.color = "var(--text-muted)";
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 style={styles.cardTitle}>{kb.name}</h3>
                <p style={styles.cardDesc}>
                  {kb.description || "暂无描述"}
                </p>
                <div style={styles.cardFooter}>
                  <div style={styles.cardMeta}>
                    <FileText size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span>{kb.document_count} 篇文档</span>
                  </div>
                  <span style={styles.cardDate}>{formatDate(kb.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div style={styles.overlay} onClick={closeCreateDialog}>
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.dialogHeader}>
              <h2 style={styles.dialogTitle}>新建知识库</h2>
              <button onClick={closeCreateDialog} style={styles.iconBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={styles.dialogBody}>
              <div style={styles.field}>
                <label style={styles.label}>
                  名称 <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  placeholder="请输入知识库名称"
                  autoFocus
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.textarea}
                  placeholder="请输入知识库描述（可选）"
                  rows={3}
                />
              </div>
            </div>
            <div style={styles.dialogFooter}>
              <button onClick={closeCreateDialog} style={styles.cancelBtn}>
                取消
              </button>
              <button
                onClick={handleCreate}
                style={{
                  ...styles.confirmBtn,
                  opacity: name.trim() && !creating ? 1 : 0.5,
                  cursor: name.trim() && !creating ? "pointer" : "not-allowed",
                }}
                disabled={!name.trim() || creating}
              >
                {creating ? "创建中..." : "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  pageTitle: {
    fontSize: "18px",
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
  },
  createBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#fff",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "background var(--transition)",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    animation: "fadeIn 0.5s ease",
  },
  emptyIcon: {
    width: "72px",
    height: "72px",
    borderRadius: "20px",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "20px",
    cursor: "pointer",
    transition: "all var(--transition)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-sm)",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    opacity: 0.4,
    transition: "all var(--transition)",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardDesc: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: "12px",
    borderTop: "1px solid var(--border-light)",
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  cardDate: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    animation: "fadeIn 0.2s ease",
  },
  dialog: {
    width: "100%",
    maxWidth: "440px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    animation: "fadeIn 0.2s ease",
  },
  dialogHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  dialogTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  dialogBody: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  dialogFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
    transition: "border-color var(--transition)",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    outline: "none",
    resize: "vertical",
    fontFamily: "var(--font-sans)",
    lineHeight: 1.5,
    transition: "border-color var(--transition)",
  },
  cancelBtn: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "all var(--transition)",
  },
  confirmBtn: {
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#fff",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    transition: "all var(--transition)",
  },
};
