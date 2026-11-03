"use client";

import React from "react";

interface CharacterPanelProps {
  userAppearance: { shirtColor?: string; hairStyle?: string; accessory?: string };
  setUserAppearance: React.Dispatch<React.SetStateAction<{ shirtColor?: string; hairStyle?: string; accessory?: string }>>;
  handleCharacter: () => void;
  onClose?: () => void;
}

export function CharacterPanel({ userAppearance, setUserAppearance, handleCharacter, onClose }: CharacterPanelProps) {
  const HAIR_STYLES = [
    "Tóc ngắn", "Tóc dài", "Tóc búi", "Tóc xoăn", "Tóc vuốt", "Tóc mái",
    "Tóc 2 bím", "Tóc dài thẳng", "Tóc tém", "Tóc chỏm", "Tóc undercut",
    "Đầu hói", "Tóc bob", "Tóc dài xoăn", "Tóc mohawk", "Tóc đuôi ngựa", "Tóc bím lệch",
  ];
  const SHIRT_COLORS = ["Đen", "Xám", "Trắng", "Vàng", "Đỏ", "Tím", "Cam", "Xanh lá", "Xanh dương", "Hồng", "Nâu"];
  const ACCESSORIES = ["Kính", "Mũ", "Tai nghe", "Vương miện", "Nơ", "Kính râm", "Mũ len", "Mũ lưỡi trai", "Mũ bảo hiểm", "Mũ hoa", "Mũ phù thủy", "Mũ tai mèo", "Tai mèo", "Sừng quỷ", "Halo", "Bông tai", "Mặt nạ", "Băng đô"];

  return (
    <div style={{
      position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
      width: "min(560px, 95vw)", background: "rgba(14, 8, 28, 0.92)",
      border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "14px",
      padding: "16px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <b style={{ fontSize: "15px", color: "#fff" }}>👤 Ngoại hình nhân vật</b>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#c4b5fd", marginBottom: "6px" }}>Màu áo</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {SHIRT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setUserAppearance({ ...userAppearance, shirtColor: c })}
                style={{
                  background: userAppearance.shirtColor === c ? "#a855f7" : "#1a132c",
                  border: `1px solid ${userAppearance.shirtColor === c ? "#a855f7" : "#392852"}`,
                  color: "#fff", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", cursor: "pointer",
                }}
              >{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#c4b5fd", marginBottom: "6px" }}>Kiểu tóc</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {HAIR_STYLES.map(h => (
              <button
                key={h}
                onClick={() => setUserAppearance({ ...userAppearance, hairStyle: h })}
                style={{
                  background: userAppearance.hairStyle === h ? "#a855f7" : "#1a132c",
                  border: `1px solid ${userAppearance.hairStyle === h ? "#a855f7" : "#392852"}`,
                  color: "#fff", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", cursor: "pointer",
                }}
              >{h}</button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "12px", color: "#c4b5fd", marginBottom: "6px" }}>Phụ kiện / Tủ đồ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {ACCESSORIES.map(a => (
              <button
                key={a}
                onClick={() => setUserAppearance({ ...userAppearance, accessory: a })}
                style={{
                  background: userAppearance.accessory === a ? "#a855f7" : "#1a132c",
                  border: `1px solid ${userAppearance.accessory === a ? "#a855f7" : "#392852"}`,
                  color: "#fff", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", cursor: "pointer",
                }}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={handleCharacter}
        style={{ marginTop: "12px", width: "100%", background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", border: "none", color: "#fff", borderRadius: "8px", padding: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
      >Áp dụng ngoại hình (cả phòng thấy)</button>
    </div>
  );
}