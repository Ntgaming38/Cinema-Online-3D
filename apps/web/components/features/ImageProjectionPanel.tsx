"use client";

import React from "react";

interface ImageProjectionPanelProps {
  projectedImage: { url: string; setByName: string } | null;
  imageUrl: string;
  setImageUrl: React.Dispatch<React.SetStateAction<string>>;
  handleProjectImage: () => void;
  handleUnproject: () => void;
  onClose?: () => void;
}

export function ImageProjectionPanel({ projectedImage, imageUrl, setImageUrl, handleProjectImage, handleUnproject, onClose }: ImageProjectionPanelProps) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
      width: "min(420px, 90vw)", background: "rgba(14, 8, 28, 0.92)",
      border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "14px",
      padding: "16px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <b style={{ fontSize: "15px", color: "#fff" }}>📸 Chiếu ảnh</b>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input
          placeholder="Link ảnh (http(s))"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          style={{ flex: 1, background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "11px" }}
        />
        <button onClick={handleProjectImage} style={{ background: "#a855f7", border: "none", color: "#fff", borderRadius: "6px", padding: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
          Chiếu
        </button>
      </div>
      {projectedImage && (
        <div style={{ position: "relative", marginBottom: "10px" }}>
          <img src={projectedImage.url} alt="projected" style={{ width: "100%", borderRadius: "8px", border: "1px solid rgba(168, 85, 247, 0.3)" }} />
          <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "10px", padding: "3px 8px", borderRadius: "6px" }}>
            Đặt bởi {projectedImage.setByName}
          </div>
          <button onClick={handleUnproject} style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(248,113,113,0.8)", border: "none", color: "#fff", borderRadius: "6px", padding: "3px 10px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>
            Tắt ảnh
          </button>
        </div>
      )}
    </div>
  );
}