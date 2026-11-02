"use client";

interface RoomInfoCardProps {
  roomCode: string;
  ownerName: string;
  visibility: string;
  memberCount: number;
  maxMembers: number;
  isOwner: boolean;
}

export default function RoomInfoCard({
  roomCode,
  ownerName,
  visibility,
  memberCount,
  maxMembers,
  isOwner,
}: RoomInfoCardProps) {
  return (
    <div
      style={{
        background: "#11101d",
        border: "1px solid #302747",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #9333ea, #7c3aed)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: "12px",
          }}
        >
          #
        </span>
        <b style={{ fontSize: "14px", color: "#fff" }}>{roomCode}</b>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a7a0b8" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
        <span>Chu phong: {ownerName}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a7a0b8" }}>
        <span>Che do: {visibility === "PUBLIC" ? "Cong khai" : "Rieng tu"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#a7a0b8" }}>
        <span>So nguoi: {memberCount} / {maxMembers}</span>
      </div>
      {isOwner && (
        <button
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid #4a2f6c",
            color: "#c4b5fd",
            padding: "8px",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Quan ly phong
        </button>
      )}
    </div>
  );
}
