"use client";

import React, { useState } from "react";
import { ThumbsUp, Play, Check, X, Clock, Film } from "lucide-react";

interface VideoQueuePanelProps {
  videoQueue: any[];
  queueForm: any;
  setQueueForm: React.Dispatch<React.SetStateAction<any>>;
  handleQueueSubmit: (e: React.FormEvent) => void;
  socket?: any;
  canModerate?: boolean;
  onClose?: () => void;
}

export function VideoQueuePanel({
  videoQueue,
  queueForm,
  setQueueForm,
  handleQueueSubmit,
  socket,
  canModerate,
  onClose
}: VideoQueuePanelProps) {
  const [activeTab, setActiveTab] = useState<"all" | "approved" | "pending">("all");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const filteredQueue = videoQueue.filter((q) => {
    if (activeTab === "approved") return q.status === "APPROVED" || q.status === "PLAYING";
    if (activeTab === "pending") return q.status === "PENDING";
    return true;
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(400px, calc(100vw - 28px))",
        maxHeight: "min(560px, 80vh)",
        display: "flex",
        flexDirection: "column",
        background: "rgba(14, 10, 30, 0.95)",
        border: "1px solid rgba(168, 85, 247, 0.4)",
        borderRadius: "16px",
        padding: "16px",
        zIndex: 450,
        color: "#fff",
        backdropFilter: "blur(12px)",
        boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#6d28d9", display: "grid", placeItems: "center" }}>
            <Film size={15} color="#fff" />
          </div>
          <div>
            <b style={{ fontSize: "14px", color: "#fff", display: "block" }}>Hàng chờ video</b>
            <span style={{ fontSize: "10px", color: "#a78bfa" }}>Cộng đồng bình chọn bài tiếp theo</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "none",
            borderRadius: "50%",
            width: "26px",
            height: "26px",
            color: "#cbd5e1",
            cursor: "pointer",
            display: "grid",
            placeItems: "center"
          }}
        >
          ✕
        </button>
      </div>

      {/* Tabs & Add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
        <div style={{ display: "flex", background: "rgba(30, 20, 50, 0.7)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              background: activeTab === "all" ? "#7c3aed" : "transparent",
              color: activeTab === "all" ? "#fff" : "#a78bfa",
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Tất cả ({videoQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            style={{
              background: activeTab === "approved" ? "#7c3aed" : "transparent",
              color: activeTab === "approved" ? "#fff" : "#a78bfa",
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Đã duyệt ({videoQueue.filter(x => x.status === "APPROVED" || x.status === "PLAYING").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            style={{
              background: activeTab === "pending" ? "#7c3aed" : "transparent",
              color: activeTab === "pending" ? "#fff" : "#a78bfa",
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Chờ duyệt ({videoQueue.filter(x => x.status === "PENDING").length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowSubmitForm(!showSubmitForm)}
          style={{
            background: showSubmitForm ? "#374151" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "5px 10px",
            fontSize: "10px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0
          }}
        >
          {showSubmitForm ? "Đóng form" : "+ Gửi video"}
        </button>
      </div>

      {/* Video submission form */}
      {showSubmitForm && (
        <form
          onSubmit={(e) => {
            handleQueueSubmit(e);
            setShowSubmitForm(false);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "12px",
            background: "rgba(20, 14, 40, 0.8)",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid rgba(139, 92, 246, 0.2)"
          }}
        >
          <input
            placeholder="Tên video (ví dụ: Trailer Avengers)"
            value={queueForm.title}
            onChange={(e) => setQueueForm({ ...queueForm, title: e.target.value })}
            style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "7px 10px", color: "#fff", fontSize: "11px", outline: "none" }}
          />
          <input
            placeholder="Link video (YouTube / MP4 / HLS .m3u8)"
            value={queueForm.sourceUrl}
            onChange={(e) => setQueueForm({ ...queueForm, sourceUrl: e.target.value })}
            style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "7px 10px", color: "#fff", fontSize: "11px", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <select
              value={queueForm.type}
              onChange={(e) => setQueueForm({ ...queueForm, type: e.target.value })}
              style={{ flex: 1, background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "6px 8px", color: "#fff", fontSize: "10px" }}
            >
              <option>YouTube</option>
              <option>TikTok</option>
              <option>SoundCloud</option>
              <option>Trực tiếp</option>
              <option>Khác</option>
            </select>
            <select
              value={queueForm.durationMin}
              onChange={(e) => setQueueForm({ ...queueForm, durationMin: e.target.value })}
              style={{ background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "6px 8px", color: "#fff", fontSize: "10px" }}
            >
              <option value="under5">&lt; 5 phút</option>
              <option value="5-20">5 - 20 phút</option>
              <option value="over20">&gt; 20 phút</option>
            </select>
          </div>
          <button
            type="submit"
            style={{
              background: "linear-gradient(135deg, #a855f7, #7c3aed)",
              border: "none",
              color: "#fff",
              borderRadius: "6px",
              padding: "7px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              marginTop: "4px"
            }}
          >
            Đưa vào hàng chờ
          </button>
        </form>
      )}

      {/* Queue items list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
        {filteredQueue.map((q: any, idx: number) => {
          const isPlaying = q.status === "PLAYING";
          const isApproved = q.status === "APPROVED";
          const isPending = q.status === "PENDING";

          return (
            <div
              key={q.id}
              style={{
                background: isPlaying ? "rgba(56, 189, 248, 0.12)" : "rgba(25, 17, 46, 0.7)",
                border: isPlaying ? "1px solid #38bdf8" : "1px solid rgba(139, 92, 246, 0.2)",
                borderRadius: "10px",
                padding: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {isPlaying && (
                      <span style={{ background: "#0284c7", color: "#fff", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: 800 }}>
                        ĐANG PHÁT
                      </span>
                    )}
                    {isApproved && (
                      <span style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        ĐÃ DUYỆT
                      </span>
                    )}
                    {isPending && (
                      <span style={{ background: "rgba(234, 179, 8, 0.2)", color: "#facc15", fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        CHỜ DUYỆT
                      </span>
                    )}
                    <span style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 600, wordBreak: "break-word" }}>
                      {q.title}
                    </span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "3px" }}>
                    Người gửi: <span style={{ color: "#c4b5fd" }}>{q.addedByName}</span>
                  </div>
                </div>

                {/* Vote button on each queue item */}
                <button
                  type="button"
                  onClick={() => socket?.emit("video:queue:vote", { itemId: q.id })}
                  title="Bình chọn video này để ưu tiên phát tiếp theo"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: (q.votes || 0) > 0 ? "linear-gradient(135deg, #9333ea, #7c3aed)" : "rgba(139, 92, 246, 0.15)",
                    border: "1px solid rgba(168, 85, 247, 0.3)",
                    color: "#fff",
                    borderRadius: "8px",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <ThumbsUp size={12} />
                  <span>{q.votes || 0}</span>
                </button>
              </div>

              {/* Moderator controls */}
              {canModerate && socket && (
                <div style={{ display: "flex", gap: "6px", marginTop: "4px", paddingTop: "4px", borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => socket.emit("video:approve", { itemId: q.id, action: "approve" })}
                        style={{ display: "flex", alignItems: "center", gap: "4px", background: "#14532d", border: "1px solid #22c55e", color: "#bbf7d0", borderRadius: "6px", padding: "3px 8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        <Check size={11} /> Duyệt
                      </button>
                      <button
                        type="button"
                        onClick={() => socket.emit("video:approve", { itemId: q.id, action: "reject" })}
                        style={{ display: "flex", alignItems: "center", gap: "4px", background: "#450a0a", border: "1px solid #ef4444", color: "#fecaca", borderRadius: "6px", padding: "3px 8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        <X size={11} /> Từ chối
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <button
                      type="button"
                      onClick={() => socket.emit("video:play", { itemId: q.id })}
                      style={{ display: "flex", alignItems: "center", gap: "4px", background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", border: "none", color: "#fff", borderRadius: "6px", padding: "4px 10px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                    >
                      <Play size={11} fill="#fff" /> Phát ngay
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredQueue.length === 0 && (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "#9ca3af", fontSize: "11px", fontStyle: "italic" }}>
            {activeTab === "pending"
              ? "Không có video nào đang chờ duyệt."
              : activeTab === "approved"
              ? "Chưa có video nào được duyệt."
              : "Hàng chờ đang trống. Hãy là người đầu tiên gửi video!"}
          </div>
        )}
      </div>
    </div>
  );
}
