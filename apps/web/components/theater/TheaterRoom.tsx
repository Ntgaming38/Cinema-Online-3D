"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Play,
  Film,
  Users,
  Trophy,
  Search,
  Bell,
  Home,
  Clapperboard,
  Flame,
  Bookmark,
  Settings,
  Crown,
  LogOut,
  ChevronDown,
  Globe,
  MessageSquare,
  BarChart2,
  Maximize,
  Minimize,
  Smile,
  Send,
  Lock,
  Tv,
  Check,
  X,
  Layers,
  Sparkles
} from "lucide-react";
import { CinemaVideoPlayer, CinemaVideoPlayerRef } from "@/components/video/CinemaVideoPlayer";
import { TheaterScene, SeatOccupant } from "@/components/theater/TheaterScene";
import { parseVideoUrl } from "@/lib/video-parser";
import { FeaturePanels } from "@/components/features/FeaturePanels";

interface ChatItem {
  id: string;
  userId: string;
  user: string;
  avatarUrl?: string;
  message: string;
  createdAt: string;
}

interface RoomMemberItem {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  seatLabel?: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
  left: number;
}

export default function TheaterRoom({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const playerRef = useRef<CinemaVideoPlayerRef>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // User State
  const [currentUser, setCurrentUser] = useState<{ id: string; displayName: string; avatarUrl?: string; isGuest?: boolean; balance?: number; totalDonated?: number } | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const [sessionReady, setSessionReady] = useState(false);

  // Room State
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Connection & Playback State
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [membersList, setMembersList] = useState<RoomMemberItem[]>([]);
  const [userRole, setUserRole] = useState<"OWNER" | "MODERATOR" | "MEMBER">("MEMBER");
  const [allowMemberControl, setAllowMemberControl] = useState(false);

  const [sourceUrl, setSourceUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [videoTitle, setVideoTitle] = useState("One Piece Film: Red");
  const [isPlaying, setIsPlaying] = useState(false);

  // Chat & Reactions
  const [chatTab, setChatTab] = useState<"chat" | "members">("chat");
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [message, setMessage] = useState("");
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [sceneReactions, setSceneReactions] = useState<Array<{ id: string; emoji: string; userName: string; timestamp: number }>>([]);
  const [likeCount, setLikeCount] = useState(0);

  // UI States
  const [mySeat, setMySeat] = useState<string | undefined>();
  const [showChatPanel, setShowChatPanel] = useState(true);
  const [showRoomInfo, setShowRoomInfo] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // ==================== NEW FEATURES STATE ====================
  const [featureTab, setFeatureTab] = useState<"mission" | "leaderboard" | "queue" | "character" | "donation" | "image" | "theme" | null>(null);
  const [missions, setMissions] = useState<Array<{ key: string; label: string; exp: number; progress: number; target: number; completed: boolean; claimed: boolean }>>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ userId: string; displayName: string; avatarUrl?: string; role: string; exp: number; level: number; totalDonated: number; shirtColor?: string; hairStyle?: string; accessory?: string }>>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"level" | "support">("level");
  const [videoQueue, setVideoQueue] = useState<Array<{ id: string; title: string; sourceUrl: string; type: string; status: string; addedBy: string; addedByName: string; createdAt: number }>>([]);
  const [queueForm, setQueueForm] = useState({ title: "", sourceUrl: "", type: "YouTube", durationMin: "under5", hasSubtitle: "no", note: "" });
  const [skipVote, setSkipVote] = useState({ votes: 0, total: 0, ratio: 0 });
  const [appearance, setAppearance] = useState<{ shirtColor?: string; hairStyle?: string; accessory?: string }>({});
  const [donations, setDonations] = useState<Array<{ amount: number; message?: string; userId: string; displayName: string; createdAt: string }>>([]);
  const [donationInput, setDonationInput] = useState("");
  const [projectedImage, setProjectedImage] = useState<{ url: string; setByName: string } | null>(null);
  const [roomTheme, setRoomTheme] = useState("main");
  const [userAppearance, setUserAppearance] = useState<{ shirtColor?: string; hairStyle?: string; accessory?: string }>({});

  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [newVideoInput, setNewVideoInput] = useState("");
  const [newTitleInput, setNewTitleInput] = useState("");
  const [isChangingVideo, setIsChangingVideo] = useState(false);
  const [appAlert, setAppAlert] = useState<string | null>(null);

  // 1. Initial Authentication & Load Room Details
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        let token = "";
        let user = null;

        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();

        if (meData.user) {
          user = meData.user;
          token = meData.token || "";
        } else {
          const guestRes = await fetch("/api/auth/guest", { method: "POST" });
          const guestData = await guestRes.json();
          if (guestData.user) {
            user = guestData.user;
            token = guestData.token;
          }
        }

        if (!active) return;
        setCurrentUser(user);
        setAuthToken(token);

        // Fetch room info from TiDB Cloud
        const roomRes = await fetch(`/api/rooms/${roomCode}`);
        if (roomRes.status === 404) {
          setRoomNotFound(true);
          return;
        }

        const roomData = await roomRes.json();
        if (!active) return;

        if (roomData.room) {
          setRoomDetails(roomData.room);
          setAllowMemberControl(roomData.room.allowMemberControl || false);
          if (roomData.room.name) setVideoTitle(roomData.room.name);

          if (roomData.room.isPasswordProtected && !roomData.room.isOwner && !roomData.room.isMember) {
            setPasswordRequired(true);
          } else {
            if (roomData.room.playback?.sourceUrl) {
              setSourceUrl(roomData.room.playback.sourceUrl);
              setVideoTitle(roomData.room.playback.videoTitle || roomData.room.name || "One Piece Film: Red");
              setIsPlaying(roomData.room.playback.isPlaying);
            } else if (roomData.room.video?.sourceUrl) {
              setSourceUrl(roomData.room.video.sourceUrl);
              setVideoTitle(roomData.room.video.title);
            }
          }
        }

        // Fetch initial chat from TiDB Cloud
        const chatRes = await fetch(`/api/rooms/${roomCode}/chat`);
        const chatData = await chatRes.json();
        if (active && Array.isArray(chatData.messages)) setChat(chatData.messages);
        if (active) setSessionReady(true);
      } catch (err) {
        console.error("Init room error:", err);
        if (active) {
          setAppAlert("Không thể khởi tạo phiên phòng chiếu.");
          setSessionReady(true);
        }
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [roomCode]);

  // 2. Connect to Socket.IO once room is verified
  useEffect(() => {
    if (!sessionReady || passwordRequired || roomNotFound) return;

    const endpoint = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4001";
    const socket = io(endpoint, {
      auth: { token: authToken },
      transports: ["websocket", "polling"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", { roomCode });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("app:error", (data: { message: string }) => {
      setAppAlert(data.message);
      setTimeout(() => setAppAlert(null), 4500);
    });

    socket.on("room:presence", (data: { count: number; members: RoomMemberItem[] }) => {
      setOnlineCount(data.count ?? 0);
      setMembersList(data.members || []);

      if (currentUser) {
        const me = data.members.find(m => m.userId === currentUser.id);
        if (me?.seatLabel) {
          setMySeat(me.seatLabel);
        }
      }
    });

    socket.on("chat:message", (item: ChatItem) => {
      setChat(prev => [...prev.slice(-99), item]);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    });

    socket.on("reaction:new", (data: { id: string; emoji: string; userName: string }) => {
      setLikeCount(prev => prev + 1);
      const randomLeft = Math.floor(15 + Math.random() * 70);
      const newFloating: FloatingReaction = {
        id: data.id,
        emoji: data.emoji,
        userName: data.userName,
        left: randomLeft
      };

      setFloatingReactions(prev => [...prev.slice(-15), newFloating]);
      setSceneReactions(prev => [
        ...prev.slice(-10),
        { id: data.id, emoji: data.emoji, userName: data.userName, timestamp: Date.now() }
      ]);

      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== data.id));
      }, 2800);
    });

    socket.on("playback:state", (state: {
      isPlaying: boolean;
      positionSec: number;
      playbackRate?: number;
      sourceUrl?: string;
      videoTitle?: string;
      allowMemberControl?: boolean;
      userRole?: "OWNER" | "MODERATOR" | "MEMBER";
    }) => {
      if (state.userRole) setUserRole(state.userRole);
      if (typeof state.allowMemberControl === "boolean") setAllowMemberControl(state.allowMemberControl);

      if (state.sourceUrl && state.sourceUrl !== sourceUrl) {
        setSourceUrl(state.sourceUrl);
      }
      if (state.videoTitle) {
        setVideoTitle(state.videoTitle);
      }

      setIsPlaying(state.isPlaying);

      if (playerRef.current) {
        const clientPos = playerRef.current.getCurrentTime();
        const diff = Math.abs(clientPos - state.positionSec);
        if (diff > 1.8) {
          playerRef.current.seekTo(state.positionSec);
        }

        if (state.isPlaying) {
          playerRef.current.play();
        } else {
          playerRef.current.pause();
        }
      }
    });

    return () => {
      socket.emit("room:leave", { roomCode });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, passwordRequired, roomNotFound, sessionReady, authToken, currentUser]);

  const canControl = userRole === "OWNER" || userRole === "MODERATOR" || allowMemberControl;
  const parsedVideo = parseVideoUrl(sourceUrl);
  const moviePoster = roomDetails?.video?.posterUrl ||
    (parsedVideo.youtubeId ? `https://img.youtube.com/vi/${parsedVideo.youtubeId}/hqdefault.jpg` : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=240&auto=format&fit=crop");

  const handlePlaybackCommand = (action: "play" | "pause" | "seek", positionSec?: number) => {
    if (!canControl) return;
    socketRef.current?.emit("playback:command", {
      roomCode,
      action,
      positionSec
    });
  };

  const handleChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canControl || !newVideoInput.trim() || isChangingVideo) return;

    const parsedVideo = parseVideoUrl(newVideoInput.trim());
    if (!parsedVideo.embeddable) {
      setAppAlert(parsedVideo.errorMessage || "Link video không hợp lệ.");
      return;
    }

    const socket = socketRef.current;
    if (!socket?.connected) {
      setAppAlert("Kết nối phòng bị gián đoạn. Vui lòng thử lại.");
      return;
    }

    setIsChangingVideo(true);
    socket.timeout(10000).emit("playback:command", {
      roomCode,
      action: "changeVideo",
      sourceUrl: parsedVideo.cleanUrl,
      videoTitle: newTitleInput.trim() || undefined
    }, (timeoutError: Error | null, result?: { success: boolean; error?: string }) => {
      setIsChangingVideo(false);
      if (timeoutError || !result?.success) {
        setAppAlert(result?.error || "Không thể đổi video. Vui lòng thử lại.");
        return;
      }

      setShowChangeVideoModal(false);
      setNewVideoInput("");
      setNewTitleInput("");
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = message.trim().slice(0, 500);
    if (!clean) return;

    socketRef.current?.emit("chat:send", {
      roomCode,
      message: clean
    });

    setMessage("");
  };

  const handleSendReaction = (emoji: string) => {
    socketRef.current?.emit("reaction:send", {
      roomCode,
      emoji
    });
  };

  const handleSelectSeat = (seatLabel: string) => {
    socketRef.current?.emit("seat:select", {
      roomCode,
      seatLabel
    });
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    try {
      const res = await fetch(`/api/rooms/${roomCode}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput })
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Mật khẩu không đúng.");
        return;
      }

      setPasswordRequired(false);
    } catch {
      setPasswordError("Lỗi kết nối máy chủ.");
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const occupiedSeatsMap: Record<string, SeatOccupant> = {};
  for (const m of membersList) {
    if (m.seatLabel) {
      occupiedSeatsMap[m.seatLabel] = {
        userId: m.userId,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl
      };
    }
  }

  // 404 View
  if (roomNotFound) {
    return (
      <main className="cinema-app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080612", color: "#fff", textAlign: "center", padding: "20px" }}>
        <div style={{ background: "#141022", padding: "36px", borderRadius: "18px", border: "1px solid #3c2a55", maxWidth: "450px" }}>
          <h2 style={{ fontSize: "22px", color: "#fca5a5", marginBottom: "12px" }}>Không tìm thấy phòng chiếu</h2>
          <p style={{ color: "#a59cb8", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>Mã phòng <b>{roomCode}</b> không tồn tại hoặc đã bị đóng.</p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "#fff", padding: "11px 22px", borderRadius: "10px", fontWeight: 600, fontSize: "13px" }}>
            Quay về Trang chủ
          </Link>
        </div>
      </main>
    );
  }

  // Password Prompt View
  if (passwordRequired) {
    return (
      <main className="cinema-app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080612", color: "#fff", textAlign: "center", padding: "20px" }}>
        <div style={{ background: "#141022", padding: "36px", borderRadius: "18px", border: "1px solid #3c2a55", maxWidth: "420px", width: "100%" }}>
          <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#3b1e5a", color: "#c084fc", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px" }}>Phòng riêng tư ({roomCode})</h2>
          <p style={{ color: "#a59cb8", fontSize: "12px", marginBottom: "20px" }}>Vui lòng nhập mật khẩu phòng để vào xem phim.</p>

          <form onSubmit={handleVerifyPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              type="password"
              placeholder="Nhập mật khẩu..."
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              style={{ background: "#0d0918", border: "1px solid #3b2a54", borderRadius: "10px", padding: "12px", color: "#fff", fontSize: "13px", outline: "none" }}
              autoFocus
            />
            {passwordError && <p style={{ color: "#f87171", fontSize: "12px", margin: "0" }}>{passwordError}</p>}
            <button type="submit" style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>
              Vào rạp chiếu
            </button>
          </form>

          <Link href="/" style={{ display: "inline-block", marginTop: "18px", color: "#c4b5fd", fontSize: "12px" }}>
            ← Quay lại trang chủ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="cinema-app-shell room-app-shell">
      {/* Floating Reactions Overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {floatingReactions.map((rx) => (
          <div
            key={rx.id}
            style={{
              position: "absolute",
              left: `${rx.left}%`,
              bottom: "15%",
              fontSize: "38px",
              animation: "floatUp 2.8s ease-out forwards",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))"
            }}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      {/* App Alert Toast */}
      {appAlert && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "#ef4444", color: "#fff", padding: "10px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 10000, boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
          {appAlert}
        </div>
      )}

      {/* 1. TOP NAVIGATION BAR */}
      <header className="room-topbar">
        {/* Logo */}
        <Link href="/" className="room-brand">
          <div className="room-brand-mark">
            <Play size={18} fill="#fff" color="#fff" />
          </div>
          <div>
            <b style={{ fontSize: "16px", letterSpacing: "0.5px", color: "#fff" }}>Cinema Online 3D</b>
            <small style={{ display: "block", fontSize: "10px", color: "#a78bfa" }}>Xem phim cùng bạn bè</small>
          </div>
        </Link>

        {/* Center Nav Pills */}
        <nav className="room-top-nav hidden-mobile">
          <Link href={`/rooms/${roomCode}`} className="room-top-nav-active">
            <Clapperboard size={14} /> Rạp chiếu
          </Link>
          <a href="#movies">
            <Film size={14} /> Phim
          </a>
          <a href="#community">
            <Users size={14} /> Cộng đồng
          </a>
          <a href="#achievements">
            <Trophy size={14} /> Thành tích
          </a>
        </nav>

        {/* Right Search, Notification & User Avatar */}
        <div className="room-top-actions">
          <div className="room-search hidden-mobile">
            <Search size={14} style={{ position: "absolute", left: "10px", color: "#8b5cf6" }} />
            <input
              type="text"
              placeholder="Tìm phim... (Ctrl + K)"
              className="room-search-input"
            />
          </div>

          <div className="room-notifications">
            <Bell size={18} color="#c4b5fd" />
            <span style={{ position: "absolute", top: "-4px", right: "-4px", width: "14px", height: "14px", background: "#ef4444", borderRadius: "50%", color: "#fff", fontSize: "9px", fontWeight: 800, display: "grid", placeItems: "center" }}>
              3
            </span>
          </div>

          {/* User Profile Avatar with Online Dot */}
          <div className="room-profile">
            <div className="room-profile-avatar">
              <img
                src={currentUser?.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=Luffy"}
                alt="Avatar"
                className="room-profile-image"
              />
            </div>
            <span style={{ position: "absolute", bottom: "-1px", right: "-1px", width: "9px", height: "9px", background: "#22c55e", borderRadius: "50%", border: "2px solid #080612" }} />
          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT: LEFT SIDEBAR + CENTER THEATER + RIGHT CHAT */}
      <div className="room-layout">
        {/* LEFT FLOATING SIDEBAR */}
        <aside className="room-sidebar hidden-mobile">
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#c4b5fd", fontSize: "12px", fontWeight: 500 }}>
              <Home size={16} /> Trang chủ
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 10px rgba(124, 58, 237, 0.3)" }}>
              <Clapperboard size={16} /> Rạp chiếu
            </div>
            <a href="#hot" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#c4b5fd", fontSize: "12px", fontWeight: 500 }}>
              <Flame size={16} /> Phim hot
            </a>
            <a href="#list" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#c4b5fd", fontSize: "12px", fontWeight: 500 }}>
              <Bookmark size={16} /> Danh sách
            </a>
            <a href="#community" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#c4b5fd", fontSize: "12px", fontWeight: 500 }}>
              <Users size={16} /> Cộng đồng
            </a>
            <button type="button" onClick={() => setShowChangeVideoModal(true)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", color: "#c4b5fd", fontSize: "12px", fontWeight: 500, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
              <Settings size={16} /> {canControl ? "Đổi video" : "Cài đặt"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* VIP Card */}
            <div style={{ background: "linear-gradient(145deg, #2a164d, #1a0f30)", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: "14px", padding: "12px", textAlign: "center" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#581c87", display: "grid", placeItems: "center", margin: "0 auto 6px" }}>
                <Crown size={18} color="#facc15" />
              </div>
              <b style={{ fontSize: "12px", display: "block", color: "#fff" }}>Nâng cấp VIP</b>
              <p style={{ fontSize: "10px", color: "#c4b5fd", margin: "4px 0 8px", lineHeight: "1.3" }}>Trải nghiệm rạp chiếu không giới hạn!</p>
              <button type="button" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", border: "none", borderRadius: "8px", padding: "5px 10px", fontSize: "10px", fontWeight: 700, cursor: "pointer", width: "100%" }}>
                Nâng cấp ngay &gt;
              </button>
            </div>

            {/* Now Playing Chip */}
            <div style={{ background: "rgba(22, 16, 38, 0.7)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "10px", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: "9px", color: "#22c55e", fontWeight: 700 }}>● Đang chiếu</span>
                <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#fff", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoTitle}</p>
              </div>
              <button type="button" onClick={() => setShowChangeVideoModal(true)} style={{ background: "#381c5a", color: "#e9d5ff", border: "none", borderRadius: "6px", padding: "3px 7px", fontSize: "9px", cursor: "pointer" }}>
                Chi tiết &gt;
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER: THEATER AUDITORIUM VIEWPORT */}
        <main className="room-main">
          {/* Top Movie Info Bar */}
          <div className="room-movie-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div className="room-movie-poster">
                <img
                  src={moviePoster}
                  alt="Poster"
                  className="room-movie-poster-image"
                />
              </div>

              <div className="room-movie-copy">
                <div className="room-movie-heading">
                  <h1>{videoTitle}</h1>
                </div>
                <div className="room-movie-meta">
                  <span style={{ background: "#2e1c4a", padding: "2px 6px", borderRadius: "4px" }}>🎬 Phim chiếu rạp</span>
                  <span style={{ background: "#2e1c4a", padding: "2px 6px", borderRadius: "4px" }}>⏱ 119 phút</span>
                  <span style={{ background: "#2e1c4a", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>HD</span>
                  <span style={{ background: "#2e1c4a", padding: "2px 6px", borderRadius: "4px" }}>13+</span>
                  <span style={{ marginLeft: "8px", color: "#9ca3af" }}>Đang chiếu: <b>20:00</b> • Còn lại: <b>01:42:17</b></span>
                </div>
              </div>
            </div>

            <div className="room-movie-actions">
              <div className="room-viewer-pill">
                <Users size={14} /> <b>{onlineCount}</b> người đang xem
              </div>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="room-leave-button"
              >
                <LogOut size={13} /> Rời rạp
              </button>
            </div>
          </div>

          {/* STAGE & AUDITORIUM VIEWPORT */}
          <div className="room-stage">
            {/* Floating Room Info Card (Upper Left) */}
            {showRoomInfo && (
              <div className="room-info-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid rgba(139, 92, 246, 0.2)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#c084fc", display: "flex", alignItems: "center", gap: "5px" }}>
                    ℹ️ Thông tin rạp
                  </span>
                  <button type="button" onClick={() => setShowRoomInfo(false)} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0 }}>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "10px", color: "#d8b4fe" }}>
                  <div>Phòng số: <b style={{ color: "#fff" }}>#{roomCode}</b></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Crown size={12} color="#facc15" /> Chủ phòng: <b style={{ color: "#fef08a" }}>{roomDetails?.owner?.displayName || "Gen.G_VN"}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Globe size={12} color="#38bdf8" /> Chế độ: <b style={{ color: "#7dd3fc" }}>{roomDetails?.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Users size={12} color="#c084fc" /> Số người: <b style={{ color: "#fff" }}>{onlineCount} / {roomDetails?.maxMembers || 200}</b>
                  </div>
                </div>
              </div>
            )}

            {/* THE CINEMA SCREEN (Centered at Top) */}
            <div className="room-screen-stage">
              {/* Stage Curtains Left & Right framing the video screen */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "65px", background: "linear-gradient(90deg, #1f0b33, #3b0764 60%, rgba(59, 7, 100, 0))", zIndex: 12, pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "65px", background: "linear-gradient(-90deg, #1f0b33, #3b0764 60%, rgba(59, 7, 100, 0))", zIndex: 12, pointerEvents: "none" }} />

              {/* Video Player Embedded as the Cinema Screen */}
              <div className="room-screen-frame">
                <CinemaVideoPlayer
                  ref={playerRef}
                  sourceUrl={sourceUrl}
                  videoTitle={videoTitle}
                  isPlaying={isPlaying}
                  canControl={canControl}
                  onCommand={handlePlaybackCommand}
                  onTitleDetected={(t) => setVideoTitle(t)}
                />
              </div>
            </div>

            {/* THE 3D AUDITORIUM (Tiered Seats + Audience + Purple Center Aisle + Hologram Stage) */}
            <div className="room-auditorium">
              <TheaterScene
                currentUserId={currentUser?.id}
                selectedSeat={mySeat}
                occupiedSeats={occupiedSeatsMap}
                isPlaying={isPlaying}
                recentReactions={sceneReactions}
                onSelectSeat={handleSelectSeat}
              />

              {/* Floating Bottom Action Capsule */}
              <div className="room-action-bar">
                <button
                  type="button"
                  onClick={() => setShowChatPanel(!showChatPanel)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: showChatPanel ? "#3b1e5a" : "transparent", color: "#fff", border: "none", borderRadius: "20px", padding: "6px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  <MessageSquare size={14} /> Chat
                </button>

                {/* Emojis matching reference image: ❤️ 👍 👏 🔥 🎉 😂 */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", borderLeft: "1px solid rgba(139, 92, 246, 0.25)", borderRight: "1px solid rgba(139, 92, 246, 0.25)", padding: "0 8px" }}>
                  {["❤️", "👍", "👏", "🔥", "🎉", "😂"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSendReaction(emoji)}
                      style={{ background: "transparent", border: "none", fontSize: "16px", cursor: "pointer", padding: "4px", borderRadius: "6px" }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAppAlert("Tính năng bình chọn sẽ mở theo phiên chiếu!")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", color: "#c4b5fd", border: "none", padding: "6px 10px", fontSize: "11px", cursor: "pointer" }}
                >
                  <BarChart2 size={13} /> Bình chọn
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", color: "#c4b5fd", border: "none", padding: "6px 10px", fontSize: "11px", cursor: "pointer" }}
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />} Toàn màn hình
                </button>
              </div>

              {/* Bottom Right Room Stat Card */}
              <div className="room-stat-card hidden-mobile">
                <span style={{ fontSize: "10px", color: "#a78bfa", fontWeight: 700 }}>📊 Thống kê phòng</span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#f472b6" }}>
                    <Users size={12} /> <b>{onlineCount}</b> Người xem
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#ec4899" }}>
                    ❤️ <b>{(likeCount / 1000).toFixed(1)}k</b> Lượt thích
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* 3. RIGHT SIDEBAR: CHAT & MEMBER TABS */}
        {showChatPanel && (
          <aside className="room-chat-panel">
            {/* Chat Tabs */}
            <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid rgba(139, 92, 246, 0.2)", padding: "10px 14px", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setChatTab("chat")}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: chatTab === "chat" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "transparent", color: chatTab === "chat" ? "#fff" : "#a78bfa", border: "none", borderRadius: "16px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
              >
                <MessageSquare size={13} /> Chat chung
              </button>
              <button
                type="button"
                onClick={() => setChatTab("members")}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: chatTab === "members" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "transparent", color: chatTab === "members" ? "#fff" : "#a78bfa", border: "none", borderRadius: "16px", padding: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
              >
                <Users size={13} /> Danh sách ({onlineCount})
              </button>
            </div>

            {/* Chat Message Stream */}
            {chatTab === "chat" ? (
              <div
                ref={chatScrollRef}
                style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {chat.length === 0 ? (
                  <div className="room-chat-empty">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</div>
                ) : chat.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", border: "1px solid #7c3aed", flexShrink: 0, background: "#2e1a47" }}>
                      <img
                        src={item.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.user}`}
                        alt={item.user}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <b style={{ fontSize: "11px", color: item.user.includes("Gen.G") ? "#fde047" : "#e9d5ff" }}>
                          {item.user} {item.user.includes("Gen.G") && "👑"}
                        </b>
                        <span style={{ fontSize: "9px", color: "#6b7280" }}>{item.createdAt}</span>
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#f3e8ff", wordBreak: "break-word", lineHeight: "1.4" }}>
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <b style={{ fontSize: "11px", color: "#c084fc", marginBottom: "4px" }}>Khán giả trong rạp</b>
                {membersList.map((m) => (
                  <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(22, 16, 38, 0.6)", padding: "7px 10px", borderRadius: "8px", fontSize: "11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={m.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
                      <span style={{ color: m.role === "OWNER" ? "#fde047" : "#fff" }}>{m.displayName}</span>
                    </div>
                    <span style={{ fontSize: "9px", background: "#381c5a", color: "#c084fc", padding: "2px 6px", borderRadius: "6px" }}>
                      {m.seatLabel ? `Ghế ${m.seatLabel}` : "Đứng xem"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Chat Input Bar */}
            <form onSubmit={handleSendChat} style={{ padding: "12px", borderTop: "1px solid rgba(139, 92, 246, 0.2)", display: "flex", alignItems: "center", gap: "8px", background: "rgba(10, 7, 20, 0.95)" }}>
              <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ width: "100%", background: "#161129", border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: "20px", padding: "9px 36px 9px 14px", color: "#fff", fontSize: "11px", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={() => setMessage(prev => prev + " ❤️")}
                  style={{ position: "absolute", right: "10px", background: "transparent", border: "none", color: "#a78bfa", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <Smile size={16} />
                </button>
              </div>

              <button
                type="submit"
                style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 10px rgba(124, 58, 237, 0.4)" }}
              >
                <Send size={15} />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* CHANGE VIDEO MODAL */}
      {showChangeVideoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "grid", placeItems: "center", zIndex: 9000, padding: "20px" }}>
          <div style={{ background: "#141024", border: "1px solid #4a2f6c", borderRadius: "16px", padding: "24px", maxWidth: "480px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <b style={{ fontSize: "16px", color: "#fff" }}>Đổi Video Chiếu Rạp</b>
              <button type="button" onClick={() => setShowChangeVideoModal(false)} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeVideo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#c4b5fd", display: "block", marginBottom: "6px" }}>Đường dẫn video (YouTube / MP4 / HLS .m3u8):</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... hoặc file .mp4, .m3u8"
                  value={newVideoInput}
                  onChange={e => setNewVideoInput(e.target.value)}
                  style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "9px", padding: "10px", color: "#fff", fontSize: "12px", outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#c4b5fd", display: "block", marginBottom: "6px" }}>Tiêu đề video (tùy chọn):</label>
                <input
                  type="text"
                  placeholder="Tiêu đề hiển thị..."
                  value={newTitleInput}
                  onChange={e => setNewTitleInput(e.target.value)}
                  style={{ width: "100%", background: "#0a0713", border: "1px solid #392852", borderRadius: "9px", padding: "10px", color: "#fff", fontSize: "12px", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowChangeVideoModal(false)}
                  style={{ background: "#211b33", border: "1px solid #3f2e5a", color: "#d8c7f8", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isChangingVideo}
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: isChangingVideo ? "wait" : "pointer", opacity: isChangingVideo ? 0.7 : 1 }}
                >
                  {isChangingVideo ? "Đang cập nhật..." : "Chiếu Video Này"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {connected && socketRef.current && (
      <FeaturePanels
        socket={socketRef.current}
        userId={currentUser?.id || ""}
        displayName={currentUser?.displayName || "Người dùng"}
        avatarUrl={currentUser?.avatarUrl}
        roomCode={roomCode}
        currentTheme={roomTheme}
        onThemeChange={t => setRoomTheme(t)}
        currentUser={currentUser}
        missions={missions}
        setMissions={setMissions}
        leaderboard={leaderboard}
        setLeaderboard={setLeaderboard}
        leaderboardTab={leaderboardTab}
        setLeaderboardTab={setLeaderboardTab}
        videoQueue={videoQueue}
        setVideoQueue={setVideoQueue}
        queueForm={queueForm}
        setQueueForm={setQueueForm}
        skipVote={skipVote}
        setSkipVote={setSkipVote}
        appearance={appearance}
        setAppearance={setAppearance}
        userAppearance={userAppearance}
        setUserAppearance={setUserAppearance}
        donations={donations}
        setDonations={setDonations}
        donationInput={donationInput}
        setDonationInput={setDonationInput}
        projectedImage={projectedImage}
        setProjectedImage={setProjectedImage}
        featureTab={featureTab}
        setFeatureTab={setFeatureTab}
      />
      )}
    </div>
  );
}
