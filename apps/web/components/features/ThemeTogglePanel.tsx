"use client";

import React from "react";

interface ThemeTogglePanelProps {
  currentTheme: string;
  handleTheme: (theme: string) => void;
  onClose?: () => void;
}

export function ThemeTogglePanel({ currentTheme, handleTheme, onClose }: ThemeTogglePanelProps) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
      width: "min(300px, 85vw)", background: "rgba(14, 8, 28, 0.92)",
      border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "14px",
      padding: "16px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <b style={{ fontSize: "14px", color: "#fff" }}>🌌 Rạp Trời</b>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <button
        onClick={() => handleTheme(currentTheme === "sky" ? "main" : "sky")}
        style={{
          background: currentTheme === "sky" ? "rgba(100,200,255,0.2)" : "transparent",
          border: `2px solid ${currentTheme === "sky" ? "#38bdf8" : "#392852"}`,
          color: currentTheme === "sky" ? "#38bdf8" : "#c4b5fd",
          borderRadius: "10px", padding: "14px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
          textAlign: "center", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center",
        }}
      >
        <span style={{ fontSize: "28px" }}>{currentTheme === "sky" ? "🌙" : "🌅"}</span>
        <span>{currentTheme === "sky" ? "Rạp Trời đang mở 👻" : "Bật Rạp Trời 🌌"}</span>
        <span style={{ fontSize: "10px", opacity: 0.7 }}>Chủ phòng/ quản trị viên</span>
      </button>
    </div>
  );
}