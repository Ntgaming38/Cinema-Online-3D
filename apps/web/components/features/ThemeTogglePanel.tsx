"use client";

import React from "react";
import { Sparkles, Moon, Sun, Zap } from "lucide-react";

interface ThemeTogglePanelProps {
  currentTheme: string;
  handleTheme: (theme: string) => void;
  onClose?: () => void;
}

const THEME_OPTIONS = [
  {
    id: "main",
    name: "Rạp Velvet Cổ Điển",
    description: "Không gian rạp chiếu tím huyền bí, ấm cúng và sang trọng",
    icon: <Sparkles size={20} color="#c084fc" />,
    gradient: "linear-gradient(135deg, #1e1136, #2d184f)",
    border: "#a855f7",
    color: "#e9d5ff",
  },
  {
    id: "sky",
    name: "Rạp Trời Sao Đêm",
    description: "Ngắm phim dưới bầu trời 2,600 ngôi sao lấp lánh và trăng đêm",
    icon: <Moon size={20} color="#38bdf8" />,
    gradient: "linear-gradient(135deg, #091a3e, #0c2554)",
    border: "#38bdf8",
    color: "#bae6fd",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk Neon 2077",
    description: "Không gian viễn tưởng với đèn neon Cyan & vạch holo rực rỡ",
    icon: <Zap size={20} color="#06b6d4" />,
    gradient: "linear-gradient(135deg, #051e24, #132d36)",
    border: "#06b6d4",
    color: "#67e8f9",
  },
  {
    id: "sunset",
    name: "Bãi Biển Hoàng Hôn",
    description: "Hoàng hôn buông ấm áp, rực rỡ ánh cam vàng thư thái",
    icon: <Sun size={20} color="#f97316" />,
    gradient: "linear-gradient(135deg, #2d1308, #451a08)",
    border: "#f97316",
    color: "#fed7aa",
  },
];

export function ThemeTogglePanel({ currentTheme, handleTheme, onClose }: ThemeTogglePanelProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(380px, calc(100vw - 28px))",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div>
          <b style={{ fontSize: "14px", color: "#fff", display: "block" }}>🌌 Chủ đề không gian rạp</b>
          <span style={{ fontSize: "10px", color: "#a78bfa" }}>Thay đổi phong cách rạp chiếu 3D</span>
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
            placeItems: "center",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {THEME_OPTIONS.map((theme) => {
          const isSelected = (currentTheme || "main") === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleTheme(theme.id)}
              style={{
                background: theme.gradient,
                border: isSelected ? `2px solid ${theme.border}` : "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px 10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "6px",
                cursor: "pointer",
                position: "relative",
                boxShadow: isSelected ? `0 0 14px ${theme.border}44` : "none",
                transition: "all 0.2s ease",
              }}
            >
              {isSelected && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: theme.border,
                    boxShadow: `0 0 8px ${theme.border}`,
                  }}
                />
              )}
              {theme.icon}
              <b style={{ fontSize: "11px", color: theme.color, lineHeight: "1.2" }}>{theme.name}</b>
              <span style={{ fontSize: "9px", color: "#94a3b8", lineHeight: "1.3" }}>{theme.description}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "12px", textAlign: "center", fontSize: "10px", color: "#a78bfa" }}>
        👑 Chủ phòng & Quản trị viên có thể đổi theme cho toàn bộ rạp
      </div>
    </div>
  );
}
