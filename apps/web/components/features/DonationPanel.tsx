"use client";

import React from "react";

interface DonationPanelProps {
  donations: any[];
  donationInput: string;
  setDonationInput: React.Dispatch<React.SetStateAction<string>>;
  handleDonation: () => void;
  currentUser: { balance?: number; totalDonated?: number } | null;
}

export function DonationPanel({ donations, donationInput, setDonationInput, handleDonation, currentUser }: DonationPanelProps) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", right: "20px", width: "280px",
      background: "rgba(14, 8, 28, 0.92)", border: "1px solid rgba(168, 85, 247, 0.35)",
      borderRadius: "14px", padding: "14px", zIndex: 450, color: "#fff", backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <b style={{ fontSize: "14px", color: "#fff" }}>❤️ ủng hộ</b>
        <button onClick={() => {}} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#c4b5fd" }}>Số dư:</span>
          {(currentUser?.balance !== undefined ? currentUser.balance : 0).toLocaleString()}{"đ"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#c4b5fd" }}>Tổng:</span>
          {(currentUser?.totalDonated !== undefined ? currentUser.totalDonated : 0).toLocaleString()}{"đ"}
        </div>
        <input
          type="number"
          placeholder="Số tiền (1.000–10.000.000)"
          value={donationInput}
          onChange={e => setDonationInput(e.target.value)}
          min={1000}
          max={10000000}
          style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "6px", padding: "8px", color: "#fff", fontSize: "12px" }}
        />
        <button onClick={handleDonation} style={{ background: "#a855f7", border: "none", color: "#fff", borderRadius: "6px", padding: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
          ủng hộ
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px", maxHeight: "120px", overflowY: "auto" }}>
        {donations.slice(-10).reverse().map((d: any, i: number) => (
          <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(168, 85, 247, 0.15)" }}>
            <div style={{ color: "#e2e8f0", fontSize: "11px" }}>{d.displayName} ủng hộ {d.amount.toLocaleString()}đ</div>
          </div>
        ))}
        {donations.length === 0 && <div style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic" }}>Chưa có ủng hộ</div>}
      </div>
    </div>
  );
}