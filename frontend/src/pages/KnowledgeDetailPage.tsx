import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { knowledgeBaseApi } from "../api";
import type { KnowledgeBase, Document } from "../types";
import {
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadKb = async () => {
    if (!id) return;
    try {
      const res = await knowledgeBaseApi.get(id);
      if (res.code === 200 && res.data) {
        setKb(res.data);
      }
    } catch {}
  };

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    try {
      const res = await knowledgeBaseApi.listDocuments(id);
      if (res.code === 200 && res.data) {
        setDocuments(res.data);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    loadKb();
    loadDocuments();
  }, [id, loadDocuments]);

  // Polling when any document is pending or processing
  useEffect(() => {
    const hasActive = documents.some(
      (d) => d.status === "pending" || d.status === "processing"
    );
    if (hasActive) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          loadDocuments();
        }, 3000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, loadDocuments]);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return new Date(dateStr).toISOString().slice(0, 10);
  };

  const handleFileSelect = async (file: File) => {
    if (!id) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("仅支持 PDF 文件");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("文件大小不能超过 20MB");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const res = await knowledgeBaseApi.uploadDocument(id, file);
      if (res.code === 200 || res.code === 201) {
        await loadDocuments();
      } else {
        setUploadError(res.message || "上传失败");
      }
    } catch {
      setUploadError("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleViewPdf = (docId: string) => {
    if (!id) return;
    const token = localStorage.getItem("token");
    const url = `/api/knowledge-bases/${id}/documents/${docId}/download?token=${token}`;
    window.open(url, "_blank");
  };

  const handleDelete = async (docId: string) => {
    if (!id) return;
    if (!window.confirm("确定要删除该文档吗？")) return;

    setDeleting(docId);
    try {
      await knowledgeBaseApi.deleteDocument(id, docId);
      await loadDocuments();
    } catch {} finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "pending":
        return (
          <span style={{ ...styles.badge, ...styles.badgePending }}>
            <Clock size={12} /> 待处理
          </span>
        );
      case "processing":
        return (
          <span style={{ ...styles.badge, ...styles.badgeProcessing }}>
            <Loader2 size={12} style={{ animation: "pulse 1s infinite" }} /> 处理中
          </span>
        );
      case "completed":
        return (
          <span style={{ ...styles.badge, ...styles.badgeCompleted }}>
            <CheckCircle size={12} /> 已完成
          </span>
        );
      case "failed":
        return (
          <span style={{ ...styles.badge, ...styles.badgeFailed }}>
            <XCircle size={12} /> 失败
          </span>
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate("/knowledge")} style={styles.iconBtn} title="返回">
          <ArrowLeft size={18} />
        </button>
        <h1 style={styles.headerTitle}>{kb?.name || "知识库详情"}</h1>
      </div>

      {/* Upload Area */}
      <div style={styles.uploadSection}>
        <div
          style={{
            ...styles.dropZone,
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "var(--accent-dim)" : "transparent",
            opacity: uploading ? 0.6 : 1,
            cursor: uploading ? "not-allowed" : "pointer",
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
          {uploading ? (
            <Loader2 size={28} style={{ animation: "pulse 1s infinite", color: "var(--accent)" }} />
          ) : (
            <Upload size={28} style={{ color: "var(--text-muted)" }} />
          )}
          <span style={styles.dropText}>
            {uploading ? "上传中..." : "点击或拖拽上传 PDF 文件"}
          </span>
          {uploadError && <span style={styles.uploadError}>{uploadError}</span>}
        </div>
      </div>

      {/* Document List */}
      <div style={styles.docList}>
        {documents.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={40} style={{ color: "var(--text-muted)" }} />
            <p style={styles.emptyText}>暂无文档，上传 PDF 文件开始</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} style={styles.docItem}>
              <div style={styles.docIcon}>
                <FileText size={20} />
              </div>
              <div style={styles.docInfo}>
                <div
                  style={styles.docName}
                  onClick={() => handleViewPdf(doc.id)}
                  title="点击查看原文件"
                >
                  {doc.filename}
                </div>
                <div style={styles.docMeta}>
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span style={styles.metaSep}>·</span>
                  <span>{doc.chunk_count} 个分块</span>
                  <span style={styles.metaSep}>·</span>
                  <span>{formatDate(doc.created_at)}</span>
                </div>
              </div>
              <div style={styles.docActions}>
                {getStatusBadge(doc.status)}
                <button
                  onClick={() => handleDelete(doc.id)}
                  style={styles.deleteBtn}
                  title="删除文档"
                  disabled={deleting === doc.id}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.color = "var(--error, #ef4444)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.4";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {deleting === doc.id ? (
                    <Loader2 size={14} style={{ animation: "pulse 1s infinite" }} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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
    gap: "12px",
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
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
  headerTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  uploadSection: {
    padding: "20px 20px 0",
  },
  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "28px",
    border: "2px dashed var(--border)",
    borderRadius: "var(--radius-lg)",
    transition: "all var(--transition)",
  },
  dropText: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  uploadError: {
    fontSize: "13px",
    color: "var(--danger, #ef4444)",
  },
  docList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  emptyText: {
    fontSize: "14px",
    color: "var(--text-muted)",
  },
  docItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  docIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "var(--radius-sm)",
    background: "var(--accent-dim)",
    color: "var(--accent)",
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
    minWidth: 0,
  },
  docName: {
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--accent)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  docMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--text-muted)",
    marginTop: "4px",
  },
  metaSep: {
    opacity: 0.4,
  },
  docActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  badgePending: {
    background: "rgba(156, 163, 175, 0.15)",
    color: "#9ca3af",
  },
  badgeProcessing: {
    background: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
  },
  badgeCompleted: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
  },
  badgeFailed: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
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
};
