"use client";

import React from "react";

interface LeaderboardPanelProps {
  leaderboard: any[];
  leaderboardTab: "level" | "support";
  setLeaderboardTab: React.Dispatch<React.SetStateAction<"level" | "support">>;
  socket: any;
  onClose?: () => void;
}

export function LeaderboardPanel({ leaderboard, leaderboardTab, setLeaderboardTab, socket, onClose }: LeaderboardPanelProps) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", right: "20px", width: "300px",
      background: "rgba(14, 8, 28, 0.92)", border: "1px solid rgba(168, 85, 247, 0.35)",
      borderRadius: "14px", padding: "14px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <b style={{ fontSize: "15px", color: "#fff" }}>🏆 Bảng xếp hạng</b>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        <button
          onClick={() => { setLeaderboardTab("level"); socket.emit("leaderboard:get", { tab: "level" }); }}
          style={{ flex: 1, background: leaderboardTab === "level" ? "#a855f7" : "transparent", color: leaderboardTab === "level" ? "#fff" : "#c4b5fd", border: "none", borderRadius: "6px", padding: "6px", fontSize: "11px", cursor: "pointer" }}
        >Cấp độ</button>
        <button
          onClick={() => { setLeaderboardTab("support"); socket.emit("leaderboard:get", { tab: "support" }); }}
          style={{ flex: 1, background: leaderboardTab === "support" ? "#a855f7" : "transparent", color: leaderboardTab === "support" ? "#fff" : "#c4b5fd", border: "none", borderRadius: "6px", padding: "6px", fontSize: "11px", cursor: "pointer" }}
        >Ủng hộ</button>
      </div>
      <div style={{ fontSize: "12px", color: "#e2e8f0", overflowY: "auto", maxHeight: "260px" }}>
        {leaderboard.slice(0, 10).map((u: any, i: number) => (
          <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(168, 85, 247, 0.15)" }}>
            <span style={{ fontWeight: 700, color: i === 0 ? "#fbbf24" : "#9ca3af" }}>#{i + 1}</span>
            <div style={{ flex: 1, fontSize: "12px" }}>{u.displayName}</div>
            <span style={{ color: "#a78bfa" }}>{leaderboardTab === "level" ? `Lv.${u.level} · ${u.exp} EXP` : `${u.totalDonated.toLocaleString()}đ`}</span>
          </div>
        ))}
        {leaderboard.length === 0 && <div style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>Chưa có dữ liệu</div>}
      </div>
    </div>
  );
}