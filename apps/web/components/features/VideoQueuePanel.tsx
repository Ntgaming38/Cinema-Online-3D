"use client";

import React from "react";

interface VideoQueuePanelProps {
  videoQueue: any[];
  queueForm: any;
  setQueueForm: React.Dispatch<React.SetStateAction<any>>;
  handleQueueSubmit: (e: React.FormEvent) => void;
}

export function VideoQueuePanel({ videoQueue, queueForm, setQueueForm, handleQueueSubmit }: VideoQueuePanelProps) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", left: "20px", width: "340px",
      background: "rgba(14, 8, 28, 0.92)", border: "1px solid rgba(168, 85, 247, 0.35)",
      borderRadius: "14px", padding: "14px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <b style={{ fontSize: "15px", color: "#fff" }}>📥 Hàng chờ video</b>
        <button onClick={() => {}} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <form onSubmit={handleQueueSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
        <input
          placeholder="Tên video"
          value={queueForm.title}
          onChange={e => setQueueForm({ ...queueForm, title: e.target.value })}
          style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}
        />
        <input
          placeholder="Link video (YouTube / MP4 / HLS .m3u8)"
          value={queueForm.sourceUrl}
          onChange={e => setQueueForm({ ...queueForm, sourceUrl: e.target.value })}
          style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          <select value={queueForm.type} onChange={e => setQueueForm({ ...queueForm, type: e.target.value })} style={{ flex: 1, background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}>
            <option>YouTube</option><option>TikTok</option><option>SoundCloud</option><option>Trực tiếp</option><option>Khác</option>
          </select>
          <select value={queueForm.durationMin} onChange={e => setQueueForm({ ...queueForm, durationMin: e.target.value })} style={{ background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}>
            <option>under5</option><option>5-20</option><option>over20</option>
          </select>
        </div>
        <select value={queueForm.hasSubtitle} onChange={e => setQueueForm({ ...queueForm, hasSubtitle: e.target.value })} style={{ background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}>
          <option value="no">Không có phụ đề</option><option value="yes">Có phụ đề</option><option value="unknown">Không rõ</option>
        </select>
        <textarea
          placeholder="Ghi chú cho người duyệt..."
          value={queueForm.note}
          onChange={e => setQueueForm({ ...queueForm, note: e.target.value })}
          style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px", minHeight: "40px" }}
        />
        <button type="submit" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", border: "none", color: "#fff", borderRadius: "6px", padding: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Gửi video</button>
      </form>
      <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px" }}>{videoQueue.length} mục trong hàng chờ</div>
      <div style={{ overflowY: "auto", maxHeight: "200px", fontSize: "11px" }}>
        {videoQueue.map((q: any) => (
          <div key={q.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(168, 85, 247, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#e2e8f0" }}>{q.title}</div>
              <div style={{ color: "#9ca3af" }}>{q.addedByName}</div>
            </div>
            <span style={{ color: q.status === "APPROVED" ? "#4ade80" : q.status === "REJECTED" ? "#f87171" : "#fbbf24" }}>{q.status}</span>
          </div>
        ))}
        {videoQueue.length === 0 && <div style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>Chưa có video nào trong hàng chờ</div>}
      </div>
    </div>
  );
}