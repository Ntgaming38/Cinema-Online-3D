"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy, BarChart2, Film, Check, X, Timer, User, Share2,
  Send, Plus, Maximize, Minimize,
  MessageSquare, Users, ArrowLeft, ChevronRight, ChevronLeft
} from "lucide-react";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { VideoQueuePanel } from "./VideoQueuePanel";
import { DonationPanel } from "./DonationPanel";
import { ImageProjectionPanel } from "./ImageProjectionPanel";
import { ThemeTogglePanel } from "./ThemeTogglePanel";
import { CharacterPanel } from "./CharacterPanel";

const HAIR_STYLES = [
  "Tóc ngắn", "Tóc dài", "Tóc búi", "Tóc xoăn", "Tóc vuốt", "Tóc mái",
  "Tóc 2 bím", "Tóc dài thẳng", "Tóc tém", "Tóc chỏm", "Tóc undercut",
  "Đầu hói", "Tóc bob", "Tóc dài xoăn", "Tóc mohawk", "Tóc đuôi ngựa", "Tóc bím lệch",
];
const SHIRT_COLORS = ["Đen", "Xám", "Trắng", "Vàng", "Đỏ", "Tím", "Cam", "Xanh lá", "Xanh dương", "Hồng", "Nâu"];
const ACCESSORIES = ["Kính", "Mũ", "Tai nghe", "Vương miện", "Nơ", "Kính râm", "Mũ len", "Mũ lưỡi trai", "Mũ bảo hiểm", "Mũ hoa", "Mũ phù thủy", "Mũ tai mèo", "Tai mèo", "Sừng quỷ", "Halo", "Bông tai", "Mặt nạ", "Băng đô"];

const MISSIONS: Array<{ key: string; label: string; exp: number; target: number }> = [
  { key: "daily_checkin", label: "Chào buổi sáng", exp: 5, target: 1 },
  { key: "chat_5", label: "Trò chuyện sôi nổi", exp: 10, target: 5 },
  { key: "video_approved", label: "Gửi video hay", exp: 15, target: 1 },
  { key: "watch_30min", label: "Ngồi xem cùng nhau (phút)", exp: 10, target: 30 },
  { key: "support", label: "Ủng hộ rạp", exp: 20, target: 1 },
  { key: "invite", label: "Chia sẻ rạp", exp: 15, target: 1 },
];

interface FeaturePanelsProps {
  socket: any;
  canModerate?: boolean;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  roomCode: string;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  currentUser: { id: string; displayName: string; avatarUrl?: string; isGuest?: boolean; balance?: number; totalDonated?: number } | null;
  missions: any[];
  setMissions: React.Dispatch<React.SetStateAction<any[]>>;
  leaderboard: any[];
  setLeaderboard: React.Dispatch<React.SetStateAction<any[]>>;
  leaderboardTab: "level" | "support";
  setLeaderboardTab: React.Dispatch<React.SetStateAction<"level" | "support">>;
  videoQueue: any[];
  setVideoQueue: React.Dispatch<React.SetStateAction<any[]>>;
  queueForm: any;
  setQueueForm: React.Dispatch<React.SetStateAction<any>>;
  skipVote: any;
  setSkipVote: React.Dispatch<React.SetStateAction<any>>;
  appearance: any;
  setAppearance: React.Dispatch<React.SetStateAction<any>>;
  userAppearance: any;
  setUserAppearance: React.Dispatch<React.SetStateAction<any>>;
  donations: any[];
  setDonations: React.Dispatch<React.SetStateAction<any[]>>;
  donationInput: string;
  setDonationInput: React.Dispatch<React.SetStateAction<string>>;
  projectedImage: { url: string; setByName: string } | null;
  setProjectedImage: React.Dispatch<React.SetStateAction<{ url: string; setByName: string } | null>>;
  featureTab: "mission" | "leaderboard" | "queue" | "character" | "donation" | "image" | "theme" | null;
  setFeatureTab: React.Dispatch<React.SetStateAction<"mission" | "leaderboard" | "queue" | "character" | "donation" | "image" | "theme" | null>>;
}

export function FeaturePanels(props: FeaturePanelsProps) {
  const {
    socket, canModerate, userId, displayName, avatarUrl, roomCode,
    currentTheme, onThemeChange, currentUser,
    missions, setMissions, leaderboard, setLeaderboard,
    leaderboardTab, setLeaderboardTab,
    videoQueue, setVideoQueue, queueForm, setQueueForm,
    skipVote, setSkipVote, appearance, setAppearance, userAppearance, setUserAppearance,
    donations, setDonations, donationInput, setDonationInput,
    projectedImage, setProjectedImage, featureTab, setFeatureTab,
  } = props;

  const [showMission, setShowMission] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [showDonation, setShowDonation] = useState(false);
  const [copyTooltip, setCopyTooltip] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const handleClaim = (key: string) => socket.emit("mission:claim", { missionKey: key });
  const handleCharacter = () => socket.emit("character:update", { ...userAppearance });
  const handleQueueSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!queueForm.title.trim() || !queueForm.sourceUrl.trim()) return;

    socket.emit("video:queue", queueForm);
    setQueueForm({ title: "", sourceUrl: "", type: "YouTube", durationMin: "under5", hasSubtitle: "no", note: "" });
  };
  const handleDonation = () => {
    const amt = parseInt(donationInput, 10);
    if (!amt || amt < 1000) return;
    socket.emit("donation", { amount: amt });
    setDonationInput("");
  };
  const handleProjectImage = () => { socket.emit("image:project", { url: imageUrl }); setImageUrl(""); };
  const handleTheme = (theme: string) => { socket.emit("room:theme", { theme }); onThemeChange(theme); };
  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/rooms/${roomCode}`);
    setCopyTooltip(true); setTimeout(() => setCopyTooltip(false), 2000);
    socket.emit("mission:invite");
  };
  const handleCheckin = () => socket.emit("checkin:daily");

  useEffect(() => { socket.emit("leaderboard:get", { tab: leaderboardTab }); }, [socket, leaderboardTab]);

  const btn = (key: string, label: string, icon: React.ReactElement, on: () => void) => (
    <button key={key} onClick={on} style={{
      background: featureTab === key ? "#a855f7" : "transparent",
      color: featureTab === key ? "#fff" : "#c4b5fd", border: "none", borderRadius: "8px",
      padding: "6px 10px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
      display: "flex", alignItems: "center", gap: "5px",
    }}>{icon} {label}</button>
  );

  return (
    <div className="room-feature-panels">
      {/* FEATURE TOOLBAR */}
      <div className="room-feature-toolbar" style={{ position: "fixed", right: "16px", bottom: "72px", left: "auto", top: "auto", transform: "none",
        display: "flex", gap: "6px", background: "rgba(168, 85, 247, 0.15)",
        border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "999px", padding: "4px",
        zIndex: 400, backdropFilter: "blur(6px)" }}>
        {[
          { key: "mission", label: "Nhiệm vụ", icon: <Trophy size={14} />, on: () => setFeatureTab("mission") },
          { key: "leaderboard", label: "BXH", icon: <BarChart2 size={14} />, on: () => setFeatureTab("leaderboard") },
          { key: "queue", label: "Hàng chờ", icon: <Film size={14} />, on: () => setFeatureTab("queue") },
          { key: "invite", label: "Mời bạn", icon: <Share2 size={14} />, on: handleCopyInvite },
        ].map(b => btn(b.key, b.label, b.icon, b.on))}
        {copyTooltip && <span style={{ fontSize: "10px", color: "#4ade80", marginLeft: "6px" }}>Đã sao chép link!</span>}
      </div>

      {/* MISSION PANEL */}
      {featureTab === "mission" && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          width: "min(520px, 92vw)", background: "rgba(14, 8, 28, 0.92)",
          border: "1px solid rgba(168, 85, 247, 0.35)", borderRadius: "14px", padding: "16px",
          zIndex: 450, color: "#fff", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <b style={{ fontSize: "15px", color: "#fff" }}>📋 Nhiệm vụ hằng ngày</b>
            <button onClick={() => setFeatureTab(null)} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {MISSIONS.map((m) => {
              const found: any = missions.find((x: any) => x.key === m.key);
              const pct = found ? Math.min(100, (found.progress / m.target) * 100) : 0;
              const canClaim = found ? found.completed && !found.claimed : false;
              return (
                <div key={m.key} style={{ borderBottom: "1px solid rgba(168, 85, 247, 0.2)", paddingBottom: "8px", marginBottom: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ color: "#e2e8f0" }}>{m.label}</span>
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>{m.exp} EXP</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(139, 92, 246, 0.25)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #a855f7, #db2777)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    <span>{found ? found.progress : 0}/{m.target}</span>
                    {m.key === "daily_checkin" && !found?.completed ? (
                      <button onClick={handleCheckin} style={{ background: "#a855f7", border: "none", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>Điểm danh</button>
                    ) : canClaim ? (
                      <button onClick={() => handleClaim(m.key)} style={{ background: "#a855f7", border: "none", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>Nhận thưởng</button>
                    ) : found?.claimed ? (
                      <span style={{ color: "#4ade80" }}>Đã nhận</span>
                    ) : (
                      <span>Chưa hoàn thành</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* LEADERBOARD */}
      {featureTab === "leaderboard" && (
        <LeaderboardPanel leaderboard={leaderboard} leaderboardTab={leaderboardTab} setLeaderboardTab={setLeaderboardTab} socket={socket} onClose={() => setFeatureTab(null)} />
      )}
      {featureTab === "queue" && <VideoQueuePanel videoQueue={videoQueue} queueForm={queueForm} setQueueForm={setQueueForm} handleQueueSubmit={handleQueueSubmit} socket={socket} canModerate={canModerate} onClose={() => setFeatureTab(null)} />}
      {featureTab === "donation" && <DonationPanel donations={donations} donationInput={donationInput} setDonationInput={setDonationInput} handleDonation={handleDonation} currentUser={currentUser} onClose={() => setFeatureTab(null)} />}
      {featureTab === "image" && <ImageProjectionPanel projectedImage={projectedImage} imageUrl={imageUrl} setImageUrl={setImageUrl} handleProjectImage={handleProjectImage} handleUnproject={() => socket.emit("image:unproject")} onClose={() => setFeatureTab(null)} />}
      {featureTab === "character" && <CharacterPanel userAppearance={userAppearance} setUserAppearance={setUserAppearance} handleCharacter={handleCharacter} onClose={() => setFeatureTab(null)} />}
      {featureTab === "theme" && <ThemeTogglePanel currentTheme={currentTheme} handleTheme={handleTheme} onClose={() => setFeatureTab(null)} />}
    </div>
  );
}
