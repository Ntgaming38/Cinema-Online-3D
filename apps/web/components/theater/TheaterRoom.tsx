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
  X,
  Layers,
  Sparkles,
  Copy,
  Gauge,
  Volume2,
  VolumeX
} from "lucide-react";
import { CinemaVideoPlayer, CinemaVideoPlayerRef } from "@/components/video/CinemaVideoPlayer";
import { TheaterScene, SeatOccupant, CameraViewMode, ActiveEmote, EmoteKind, StagePerformerInfo } from "@/components/theater/TheaterScene";
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
  muted?: boolean;
  seatLabel?: string;
  gender?: string;
  appearance?: { shirtColor?: string; hairStyle?: string; accessory?: string };
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
  // Syncplay-style drift correction state: the last authoritative playback
  // state and the rate currently applied for gentle correction.
  const syncRef = useRef<{ positionSec: number; isPlaying: boolean; playbackRate: number; at: number } | null>(null);
  const appliedRateRef = useRef(1);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const screenOverlayRef = useRef<HTMLDivElement>(null);

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
  const [viewMode, setViewMode] = useState<CameraViewMode>("wide");
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toolRailCollapsed, setToolRailCollapsed] = useState(false);
  const [showRoomHint, setShowRoomHint] = useState(false);
  const [sceneQuality, setSceneQuality] = useState<"auto" | "low" | "medium" | "high">("auto");
  const [effectiveSceneQuality, setEffectiveSceneQuality] = useState<"low" | "medium" | "high">("medium");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(70);
  const [audioMuted, setAudioMuted] = useState(false);
  // ==================== NEW FEATURES STATE ====================
  const [featureTab, setFeatureTab] = useState<"mission" | "leaderboard" | "queue" | "character" | "donation" | "image" | "theme" | null>(null);
  const [missions, setMissions] = useState<Array<{ key: string; label: string; exp: number; progress: number; target: number; completed: boolean; claimed: boolean }>>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ userId: string; displayName: string; avatarUrl?: string; role: string; exp: number; level: number; totalDonated: number; shirtColor?: string; hairStyle?: string; accessory?: string }>>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"level" | "support">("level");
  const [videoQueue, setVideoQueue] = useState<Array<{ id: string; title: string; sourceUrl: string; type: string; status: string; addedBy: string; addedByName: string; createdAt: number }>>([]);
  const [queueForm, setQueueForm] = useState({ title: "", sourceUrl: "", type: "YouTube", durationMin: "under5", hasSubtitle: "no", note: "" });
  const [skipVote, setSkipVote] = useState({ votes: 0, total: 0, ratio: 0 });
  const [actingHost, setActingHost] = useState<{ userId: string; name: string } | null>(null);
  const [disco, setDisco] = useState(false);
  const [slowModeSec, setSlowModeSec] = useState(0);
  const [activeEmotes, setActiveEmotes] = useState<Record<string, ActiveEmote>>({});
  const [stageList, setStageList] = useState<Array<{ userId: string; displayName: string; startedAt: number }>>([]);
  const [fireworksBursts, setFireworksBursts] = useState<Array<{ id: number; at: number }>>([]);
  const [quiz, setQuiz] = useState<{ question: string; options: string[]; endsAt: number } | null>(null);
  const [quizResult, setQuizResult] = useState<{ question: string; options: string[]; correctIndex: number; counts: number[]; winners: string[]; totalAnswers: number } | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizAnsweredCount, setQuizAnsweredCount] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [kickedNotice, setKickedNotice] = useState<string | null>(null);
  const [donations, setDonations] = useState<Array<{ amount: number; message?: string; userId: string; displayName: string; createdAt: string }>>([]);
  const [donationInput, setDonationInput] = useState("");
  const [projectedImage, setProjectedImage] = useState<{ url: string; setByName: string } | null>(null);
  const [roomTheme, setRoomTheme] = useState("main");
  const [userAppearance, setUserAppearance] = useState<{ shirtColor?: string; hairStyle?: string; accessory?: string }>({});

  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [newVideoInput, setNewVideoInput] = useState("");
  const [newTitleInput, setNewTitleInput] = useState("");
  const [isChangingVideo, setIsChangingVideo] = useState(false);
  const [appAlert, setAppAlert] = useState<string | null>(null);

  useEffect(() => {
    try {
      setShowRoomHint(window.localStorage.getItem("cinema-room-hint-dismissed") !== "1");
    } catch {
      setShowRoomHint(true);
    }
  }, []);

  useEffect(() => {
    if (sceneQuality !== "auto") {
      setEffectiveSceneQuality(sceneQuality);
      return;
    }
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = window.matchMedia("(max-width: 680px)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    setEffectiveSceneQuality(isMobile || memory <= 4 || cores <= 4 ? "low" : memory >= 8 && cores >= 8 ? "high" : "medium");
  }, [sceneQuality]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  useEffect(() => {
    setVideoError(null);
  }, [sourceUrl]);

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

    // Realtime endpoint resolution:
    // 1. NEXT_PUBLIC_REALTIME_URL set -> use it (split deployment: realtime on its own server).
    // 2. Production build without it -> same origin as the web page (combined gateway mode:
    //    the web server proxies /socket.io/ to realtime). io() with no URL uses window.location.
    // 3. Local dev -> http://localhost:4001.
    const configuredRealtimeUrl = (process.env.NEXT_PUBLIC_REALTIME_URL || "").trim();
    const endpoint =
      configuredRealtimeUrl ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:4001");
    const socketOptions = {
      auth: { token: authToken },
      transports: ["websocket", "polling"] as ("websocket" | "polling")[]
    };
    const socket = endpoint ? io(endpoint, socketOptions) : io(socketOptions);

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

      syncRef.current = {
        positionSec: state.positionSec,
        isPlaying: state.isPlaying,
        playbackRate: state.playbackRate || 1,
        at: Date.now(),
      };

      setIsPlaying(state.isPlaying);

      if (playerRef.current) {
        const clientPos = playerRef.current.getCurrentTime();
        const diff = Math.abs(clientPos - state.positionSec);
        // Big jumps (video change, seek command, first join) snap at once;
        // small drift is absorbed gently by the sync interval below.
        if (diff > 2.5 || (!state.isPlaying && diff > 1.2)) {
          playerRef.current.seekTo(state.positionSec);
          appliedRateRef.current = state.playbackRate || 1;
          playerRef.current.setPlaybackRate(appliedRateRef.current);
        }

        if (state.isPlaying) {
          playerRef.current.play();
        } else {
          playerRef.current.pause();
        }
      }
    });

    // ==================== FEATURE EVENT WIRING ====================
    socket.on("app:notice", (data: { message: string }) => {
      setAppNotice(data.message);
      setTimeout(() => setAppNotice(null), 4500);
    });

    socket.on("room:password-required", () => {
      setPasswordRequired(true);
    });

    socket.on("missions:state", (data: { missions: any[] }) => {
      setMissions(data.missions || []);
    });

    socket.on("mission:claimed", () => {
      // Server follows with a fresh missions:state; refresh profile numbers too.
      fetch("/api/auth/me").then(r => r.json()).then(d => {
        if (d.user) setCurrentUser(prev => (prev ? { ...prev, ...d.user } : d.user));
      }).catch(() => {});
    });

    socket.on("leaderboard:update", (data: { tab: "level" | "support"; list: any[] }) => {
      setLeaderboard(data.list || []);
      setLeaderboardTab(data.tab);
    });

    socket.on("video:queue:update", (data: { queue: any[] }) => {
      setVideoQueue(data.queue || []);
    });

    socket.on("vote:skip:update", (data: { votes: number; total: number; ratio: number }) => {
      setSkipVote({ votes: data.votes, total: data.total, ratio: data.ratio });
    });

    socket.on("room:host", (data: { actingHostId: string | null; actingHostName: string | null }) => {
      setActingHost(data.actingHostId ? { userId: data.actingHostId, name: data.actingHostName || "" } : null);
    });

    socket.on("room:disco:changed", (data: { disco: boolean }) => {
      setDisco(Boolean(data.disco));
    });

    socket.on("room:slowmode:changed", (data: { seconds: number }) => {
      setSlowModeSec(Math.max(0, Math.floor(data.seconds || 0)));
    });

    socket.on("room:emote:played", (data: { userId: string; emote: EmoteKind }) => {
      const startedAt = Date.now();
      setActiveEmotes((prev) => ({ ...prev, [data.userId]: { kind: data.emote, startedAt } }));
      setTimeout(() => {
        setActiveEmotes((prev) => {
          if (prev[data.userId]?.startedAt !== startedAt) return prev;
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 3600);
    });

    socket.on("stage:update", (data: { performers: Array<{ userId: string; displayName: string; startedAt: number }> }) => {
      setStageList(data.performers || []);
    });

    socket.on("stage:fireworks", () => {
      const burst = { id: Date.now() + Math.random(), at: Date.now() };
      setFireworksBursts((prev) => [...prev.slice(-2), burst]);
      setTimeout(() => {
        setFireworksBursts((prev) => prev.filter((b) => b.id !== burst.id));
      }, 2400);
    });

    socket.on("quiz:question", (data: { question: string; options: string[]; endsAt: number; answeredCount: number }) => {
      setQuiz({ question: data.question, options: data.options, endsAt: data.endsAt });
      setQuizResult(null);
      setQuizAnswer(null);
      setQuizAnsweredCount(data.answeredCount || 0);
    });

    socket.on("quiz:answered-count", (data: { count: number }) => {
      setQuizAnsweredCount(data.count);
    });

    socket.on("quiz:result", (data: { question: string; options: string[]; correctIndex: number; counts: number[]; winners: string[]; totalAnswers: number }) => {
      setQuizResult(data);
      setQuiz(null);
      setTimeout(() => setQuizResult(null), 10000);
    });

    socket.on("room:kicked", (data: { message?: string }) => {
      setKickedNotice(data?.message || "Bạn đã bị mời ra khỏi phòng.");
      setTimeout(() => router.push("/"), 2800);
    });

    socket.on("vote:skip:result", () => {
      setAppNotice("Đã đủ 35% phiếu — đang chuyển sang video tiếp theo trong hàng chờ!");
      setTimeout(() => setAppNotice(null), 4500);
    });

    socket.on("donation:received", (data: { amount: number; message?: string; userId: string; displayName: string; balance?: number; totalDonated?: number }) => {
      setDonations(prev => [...prev.slice(-30), {
        amount: data.amount,
        message: data.message,
        userId: data.userId,
        displayName: data.displayName,
        createdAt: new Date().toISOString()
      }]);
      setCurrentUser(prev => (prev && prev.id === data.userId
        ? { ...prev, balance: data.balance ?? prev.balance, totalDonated: data.totalDonated ?? prev.totalDonated }
        : prev));
    });

    socket.on("room:theme:changed", (data: { theme: string }) => {
      setRoomTheme(data.theme);
    });

    socket.on("image:projected", (data: { url: string; setByName: string }) => {
      setProjectedImage({ url: data.url, setByName: data.setByName });
    });

    socket.on("image:unprojected", () => {
      setProjectedImage(null);
    });

    return () => {
      socket.emit("room:leave", { roomCode });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, passwordRequired, roomNotFound, sessionReady, authToken, currentUser]);

  // Watch-time heartbeat: 1 ping per minute feeds the "Ngồi xem cùng nhau" mission.
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      socketRef.current?.emit("heartbeat:watch");
    }, 60000);
    return () => clearInterval(timer);
  }, [connected]);

  // Syncplay-style drift correction, checked every second against the
  // expected position extrapolated from the last playback:state (the
  // server also re-broadcasts state every 5s). Drift under 0.35s is
  // ignored; 0.35–2.5s is absorbed by a ±10% playback-rate nudge so the
  // picture never visibly jumps; beyond 2.5s it snaps with a seek.
  useEffect(() => {
    const timer = setInterval(() => {
      const sync = syncRef.current;
      const player = playerRef.current;
      if (!sync || !player) return;
      const baseRate = sync.playbackRate || 1;
      const expected = sync.isPlaying
        ? sync.positionSec + ((Date.now() - sync.at) / 1000) * baseRate
        : sync.positionSec;
      const clientPos = player.getCurrentTime();
      if (!Number.isFinite(clientPos) || clientPos <= 0) return;
      const diff = clientPos - expected; // > 0 ahead of the room, < 0 behind
      const abs = Math.abs(diff);
      if (abs > 2.5) {
        player.seekTo(expected);
        sync.positionSec = expected;
        sync.at = Date.now();
        if (appliedRateRef.current !== baseRate) {
          appliedRateRef.current = baseRate;
          player.setPlaybackRate(baseRate);
        }
        return;
      }
      if (!sync.isPlaying) return;
      const target = abs > 0.35 ? baseRate * (diff < 0 ? 1.1 : 0.9) : baseRate;
      if (appliedRateRef.current !== target) {
        appliedRateRef.current = target;
        player.setPlaybackRate(target);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1s UI tick driving the stage + quiz countdown labels.
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        avatarUrl: m.avatarUrl,
        gender: m.gender,
        appearance: m.appearance
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
    <div className={`cinema-app-shell room-app-shell${focusMode ? " focus-mode" : ""}`}>
      {kickedNotice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(5, 2, 12, 0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#1d1030", border: "1px solid rgba(248, 113, 113, 0.5)", borderRadius: "14px", padding: "22px 26px", maxWidth: "420px", textAlign: "center", color: "#fecaca", fontSize: "14px", lineHeight: 1.6 }}>
            {kickedNotice}
            <div style={{ marginTop: "8px", fontSize: "11px", color: "#fca5a5" }}>Đang đưa bạn về trang chủ…</div>
          </div>
        </div>
      )}

      {/* Stage status chip: who is performing + seconds left on their turn */}
      {stageList.length > 0 && (
        <div style={{ position: "fixed", left: "16px", bottom: "72px", zIndex: 400, background: "rgba(24, 12, 36, 0.92)", border: "1px solid rgba(244, 114, 182, 0.4)", borderRadius: "12px", padding: "8px 12px", color: "#fbcfe8", fontSize: "11px", lineHeight: 1.7, backdropFilter: "blur(6px)" }}>
          <b style={{ color: "#f9a8d4" }}>🎤 Sân khấu</b>
          {stageList.map((p) => (
            <div key={p.userId}>
              {p.displayName} — còn {Math.max(0, 30 - Math.floor((nowTick - p.startedAt) / 1000))}s
            </div>
          ))}
        </div>
      )}

      {/* Mid-movie quiz card */}
      {(quiz || quizResult) && (
        <div style={{ position: "fixed", top: "76px", left: "50%", transform: "translateX(-50%)", zIndex: 450, width: "min(480px, calc(100vw - 32px))", background: "rgba(20, 10, 34, 0.96)", border: "1px solid rgba(251, 191, 36, 0.5)", borderRadius: "16px", padding: "16px 18px", color: "#fff", boxShadow: "0 18px 44px rgba(0,0,0,0.5)" }}>
          {quiz && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <b style={{ color: "#fde68a", fontSize: "12px" }}>❓ QUIZ GIỮA PHIM</b>
                <span style={{ fontSize: "11px", color: "#fca5a5", fontWeight: 700 }}>
                  {Math.max(0, Math.ceil((quiz.endsAt - nowTick) / 1000))}s · {quizAnsweredCount} đã trả lời
                </span>
              </div>
              <div style={{ fontSize: "14.5px", fontWeight: 700, lineHeight: 1.45, marginBottom: "12px" }}>{quiz.question}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {quiz.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={quizAnswer !== null}
                    onClick={() => {
                      setQuizAnswer(i);
                      socketRef.current?.emit("quiz:answer", { index: i });
                    }}
                    style={{
                      background: quizAnswer === i ? "#7c3aed" : "#211631",
                      color: "#fff",
                      border: quizAnswer === i ? "1px solid #c4b5fd" : "1px solid rgba(139, 92, 246, 0.35)",
                      borderRadius: "10px",
                      padding: "9px 10px",
                      fontSize: "12.5px",
                      cursor: quizAnswer === null ? "pointer" : "default",
                      textAlign: "left",
                    }}
                  >
                    <b style={{ color: "#c4b5fd" }}>{["A", "B", "C", "D"][i]}.</b> {opt}
                  </button>
                ))}
              </div>
              {quizAnswer !== null && <div style={{ marginTop: "9px", fontSize: "11px", color: "#a78bfa" }}>Đã ghi nhận đáp án của bạn — chờ kết quả…</div>}
            </>
          )}
          {quizResult && (
            <>
              <b style={{ color: "#fde68a", fontSize: "12px" }}>🏁 KẾT QUẢ QUIZ</b>
              <div style={{ fontSize: "13.5px", fontWeight: 700, lineHeight: 1.45, margin: "8px 0 10px" }}>{quizResult.question}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {["A", "B", "C", "D"].map((letter, i) => (
                  <div
                    key={letter}
                    style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      background: i === quizResult.correctIndex ? "rgba(22, 101, 52, 0.55)" : quizAnswer === i ? "rgba(127, 29, 29, 0.55)" : "rgba(22, 16, 38, 0.6)",
                      border: i === quizResult.correctIndex ? "1px solid #4ade80" : "1px solid rgba(139, 92, 246, 0.25)",
                    }}
                  >
                    <b>{letter}.</b> {quizResult.options[i] ?? ""}{i === quizResult.correctIndex ? " ✓" : ""} — {quizResult.counts[i] || 0} người chọn
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#fde68a" }}>
                {quizResult.winners.length > 0
                  ? `🎉 Trả lời đúng: ${quizResult.winners.join(", ")}`
                  : "Không ai trả lời đúng lần này."}
              </div>
            </>
          )}
        </div>
      )}
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

      {/* Success/Info Notice Toast */}
      {appNotice && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "#059669", color: "#fff", padding: "10px 22px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, zIndex: 10000, boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>
          {appNotice}
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

      <div className="room-top-controls">
        <label className="room-quality-control" title={`Chất lượng đồ họa đang dùng: ${effectiveSceneQuality}`}>
          <Gauge size={15} />
          <span>Độ nét</span>
          <select aria-label="Chất lượng đồ họa" value={sceneQuality} onChange={(event) => setSceneQuality(event.target.value as typeof sceneQuality)}>
            <option value="auto">Tự động</option>
            <option value="low">Tiết kiệm</option>
            <option value="medium">Cân bằng</option>
            <option value="high">Cao</option>
          </select>
        </label>
        <button type="button" className="room-top-control-button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setAppNotice("Đã sao chép link mời vào phòng");
            window.setTimeout(() => setAppNotice(null), 2400);
          } catch {
            setAppAlert("Không thể sao chép link. Hãy sao chép địa chỉ trên thanh trình duyệt.");
            window.setTimeout(() => setAppAlert(null), 3000);
          }
        }}><Copy size={15} /> Mời bạn</button>
        <button type="button" className="room-top-control-button" onClick={() => { setFocusMode(true); setShowChatPanel(true); }}><Maximize size={15} /> Tập trung</button>
        <button type="button" title="Rời rạp" aria-label="Rời rạp" className="room-top-control-button room-leave-button" onClick={() => router.push("/")}>
          <LogOut size={13} /> Rời rạp
        </button>
      </div>
      {focusMode && <button type="button" className="room-focus-exit" onClick={() => setFocusMode(false)}><Minimize size={14} /> Thoát tập trung <kbd>Esc</kbd></button>}

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
              <button
                type="button"
                onClick={() => setFeatureTab("donation")}
                style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", border: "none", borderRadius: "8px", padding: "5px 10px", fontSize: "10px", fontWeight: 700, cursor: "pointer", width: "100%" }}
              >
                Ủng hộ & Nâng cấp &gt;
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
                  <span className={`room-playback-status${videoError ? " is-error" : isPlaying ? " is-playing" : ""}`} title={videoError || undefined}>
                    <i /> {videoError ? "Video gặp lỗi" : isPlaying ? "Đang chiếu" : "Tạm dừng"}
                  </span>
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
            </div>
            <button type="button" className="room-overlay-vote" onClick={() => socketRef.current?.emit("vote:skip")}>
              <Play size={13} /> Bỏ qua <b>{skipVote.votes}/{skipVote.total || onlineCount}</b>
              <small>{Math.round(skipVote.ratio * 100)}% · đủ 35% sẽ chuyển video</small>
            </button>
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

            <nav className={`room-tool-rail${toolRailCollapsed ? " is-collapsed" : ""}`} aria-label="Công cụ phòng chiếu">
              <button className="room-tool-rail-toggle" type="button" aria-label={toolRailCollapsed ? "Mở công cụ" : "Thu gọn công cụ"} onClick={() => setToolRailCollapsed((collapsed) => !collapsed)}>
                <ChevronDown size={16} />
              </button>
              <button type="button" title="Gửi video vào rạp" onClick={() => setShowChangeVideoModal(true)}><Tv size={17} /><span>Gửi video</span></button>
              <button type="button" title="Chiếu ảnh lên màn hình" onClick={() => setFeatureTab("image")}><Layers size={17} /><span>Chiếu ảnh</span></button>
              <button type="button" title="Mở hàng chờ video" onClick={() => setFeatureTab("queue")}><Film size={17} /><span>Hàng chờ</span></button>
              <button type="button" title="Bình chọn bỏ qua video" onClick={() => socketRef.current?.emit("vote:skip")}><Play size={17} /><span>Bỏ qua</span></button>
              <button type="button" title="Mở trò chuyện" onClick={() => setShowChatPanel((open) => !open)}><MessageSquare size={17} /><span>Trò chuyện</span></button>
              <button type="button" title="Tùy chỉnh nhân vật" onClick={() => setFeatureTab("character")}><Sparkles size={17} /><span>Tủ đồ</span></button>
              <button type="button" title="Ủng hộ người tạo" onClick={() => setFeatureTab("donation")}><Crown size={17} /><span>Ủng hộ</span></button>
              <button type="button" title="Đổi chủ đề rạp" onClick={() => setRoomTheme((theme) => theme === "sky" ? "main" : "sky")}><Globe size={17} /><span>Rạp trời</span></button>
              <button type="button" title="Xem thông tin rạp" onClick={() => setShowRoomInfo((visible) => !visible)}><Users size={17} /><span>Thông tin rạp</span></button>
            </nav>

            {mySeat && <div className="room-seat-indicator"><span /> Ghế của bạn: <b>{mySeat}</b><small>Bấm ghế khác để đổi chỗ</small></div>}
            {showRoomHint && (
              <aside className="room-gesture-hint" role="note">
                <b>Điều khiển phòng</b>
                <span>Lăn chuột hoặc vuốt hai ngón để thu phóng · Bấm ghế để chọn chỗ · mở Chat để trò chuyện</span>
                <button type="button" onClick={() => {
                  setShowRoomHint(false);
                  try { window.localStorage.setItem("cinema-room-hint-dismissed", "1"); } catch { /* Ignore private browsing storage restrictions. */ }
                }}>Đã hiểu</button>
              </aside>
            )}
            {/* UNIFIED STAGE FRAME — screen, stage, presenter, seats and audience
                all live in ONE 3D frame, exactly like the reference mockup
                (no more split "screen frame" / "auditorium frame"). */}
            <div className="room-stage-frame">
              <TheaterScene
                viewMode={viewMode}
                overlayElement={screenOverlayRef.current}
                selectedSeat={mySeat}
                occupiedSeats={occupiedSeatsMap}
                isPlaying={isPlaying}
                quality={effectiveSceneQuality}
                theme={roomTheme}
                disco={disco}
                activeEmotes={activeEmotes}
                stagePerformers={stageList.map((p): StagePerformerInfo => {
                  const member = membersList.find((m) => m.userId === p.userId);
                  return {
                    userId: p.userId,
                    displayName: p.displayName,
                    gender: member?.gender,
                    appearance: member?.appearance,
                    startedAt: p.startedAt,
                  };
                })}
                fireworksBursts={fireworksBursts}
                recentReactions={sceneReactions}
                onSelectSeat={handleSelectSeat}
              />

              {/* Video player overlaid exactly onto the 3D cinema screen */}
              <div ref={screenOverlayRef} className="room-screen-overlay">
                <CinemaVideoPlayer
                  ref={playerRef}
                  sourceUrl={sourceUrl}
                  videoTitle={videoTitle}
                  isPlaying={isPlaying}
                  canControl={canControl}
                  onCommand={handlePlaybackCommand}
                  onTitleDetected={(t) => setVideoTitle(t)}
                  onPlaybackError={setVideoError}
                  volume={audioVolume}
                  muted={audioMuted}
                />
                {projectedImage && (
                  <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={projectedImage.url} alt="Ảnh chiếu lên màn hình" style={{ maxWidth: "96%", maxHeight: "96%", objectFit: "contain", borderRadius: "6px" }} />
                    <button type="button" onClick={() => socketRef.current?.emit("image:unproject")} style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(255,255,255,.92)", color: "#111", border: "none", borderRadius: "999px", padding: "5px 11px", fontWeight: 800, fontSize: "11px", cursor: "pointer" }}>✕ Tắt ảnh</button>
                  </div>
                )}
              </div>

              {/* Floating Bottom Action Capsule */}
              <div className="room-action-bar">
                <div className="room-audio-controls" aria-label="Điều khiển âm thanh video">
                  <button
                    type="button"
                    aria-label={audioMuted || audioVolume === 0 ? "Bật tiếng" : "Tắt tiếng"}
                    title={audioMuted || audioVolume === 0 ? "Bật tiếng" : "Tắt tiếng"}
                    onClick={() => {
                      if (audioMuted || audioVolume === 0) {
                        if (audioVolume === 0) setAudioVolume(70);
                        setAudioMuted(false);
                      } else setAudioMuted(true);
                    }}
                  >
                    {audioMuted || audioVolume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    aria-label="Âm lượng video"
                    title={`Âm lượng ${audioVolume}%`}
                    value={audioMuted ? 0 : audioVolume}
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      setAudioVolume(nextVolume);
                      setAudioMuted(nextVolume === 0);
                    }}
                  />
                  <span>{audioMuted ? 0 : audioVolume}%</span>
                </div>
                <select
                  aria-label="Góc camera"
                  title="Góc camera"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as CameraViewMode)}
                  style={{ background: "#211631", color: "#fff", border: "1px solid #68409a", borderRadius: 12, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  <option value="wide">Góc rộng</option>
                  <option value="panorama">Toàn rạp</option>
                  <option value="audience">Ghế của tôi</option>
                  <option value="reverse">Nhìn lại khán giả</option>
                  <option value="focus">Tập trung màn hình</option>
                </select>
                <button type="button" onClick={() => socketRef.current?.emit("room:disco", { disco: !disco })} title="Chế độ disco cho cả phòng (chủ phòng/mod bật tắt)" style={{ background: disco ? "#831843" : "#211631", color: "#fff", border: "1px solid #68409a", borderRadius: 12, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
                  🪩 {disco ? "Tắt Disco" : "Disco"}
                </button>
                <button
                  type="button"
                  className="room-chat-toggle"
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

                {/* Character emotes: your avatar performs for the whole room */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "0 4px" }}>
                  {([
                    { kind: "jump", label: "🙆 Nhảy" },
                    { kind: "dance", label: "🕺 Múa" },
                    { kind: "wave", label: "👋 Vẫy" },
                    { kind: "clap", label: "👏 Vỗ tay" },
                  ] as Array<{ kind: EmoteKind; label: string }>).map((e) => (
                    <button
                      key={e.kind}
                      type="button"
                      onClick={() => socketRef.current?.emit("room:emote", { emote: e.kind })}
                      style={{ background: "transparent", border: "1px solid rgba(139, 92, 246, 0.3)", color: "#e9d5ff", fontSize: "10.5px", cursor: "pointer", padding: "4px 8px", borderRadius: "999px", whiteSpace: "nowrap" }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => socketRef.current?.emit(stageList.some((p) => p.userId === currentUser?.id) ? "stage:leave" : "stage:join")}
                  title="Lên sân khấu trình diễn 30 giây trước cả phòng (tối đa 5 người)"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: stageList.some((p) => p.userId === currentUser?.id) ? "#831843" : "transparent", color: "#f9a8d4", border: "1px solid rgba(244, 114, 182, 0.35)", borderRadius: "999px", padding: "6px 10px", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  🎤 {stageList.some((p) => p.userId === currentUser?.id) ? "Rời sân khấu" : "Lên sân khấu"}
                </button>
                <button
                  type="button"
                  onClick={() => socketRef.current?.emit("quiz:start")}
                  title="Mở một câu quiz giữa phim cho cả phòng (chủ phòng/mod)"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", color: "#fde68a", border: "1px solid rgba(251, 191, 36, 0.35)", borderRadius: "999px", padding: "6px 10px", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  ❓ Quiz
                </button>
                <button
                  type="button"
                  onClick={() => socketRef.current?.emit("vote:skip")}
                  title="Bình chọn bỏ qua video hiện tại — đủ 35% sẽ chuyển video đã duyệt tiếp theo"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", color: "#c4b5fd", border: "none", padding: "6px 10px", fontSize: "11px", cursor: "pointer" }}
                >
                  <BarChart2 size={13} /> Bình chọn bỏ qua{skipVote.total > 0 ? ` · ${Math.round(skipVote.ratio * 100)}%` : ""}
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "transparent", color: "#c4b5fd", border: "none", padding: "6px 10px", fontSize: "11px", cursor: "pointer" }}
                >
                  {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />} Toàn màn hình
                </button>
                <button type="button" className="room-focus-trigger" onClick={() => { setFocusMode(true); setShowChatPanel(true); }}>
                  <Maximize size={13} /> Tập trung
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
            {/* Chat Tabs & Close Button */}
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
              <button
                type="button"
                onClick={() => setShowChatPanel(false)}
                title="Đóng chat"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0
                }}
              >
                <X size={14} />
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
                {actingHost && (
                  <div style={{ fontSize: "10px", color: "#fde68a", background: "rgba(120, 72, 20, 0.35)", border: "1px solid rgba(253, 224, 71, 0.35)", padding: "6px 9px", borderRadius: "8px" }}>
                    Chủ phòng đang vắng — <b>{actingHost.name}</b> tạm điều khiển phòng.
                  </div>
                )}
                {(() => {
                  const me = membersList.find((x) => x.userId === currentUser?.id);
                  const iAmStaff = me?.role === "OWNER" || me?.role === "MODERATOR" || actingHost?.userId === currentUser?.id;
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px", color: "#a78bfa", background: "rgba(22, 16, 38, 0.6)", padding: "6px 9px", borderRadius: "8px" }}>
                      <span>Chat chậm {slowModeSec > 0 ? <b style={{ color: "#e9d5ff" }}>{slowModeSec}s</b> : <b style={{ color: "#e9d5ff" }}>Tắt</b>}</span>
                      {iAmStaff && (
                        <select
                          value={slowModeSec}
                          onChange={(e) => socketRef.current?.emit("room:slowmode", { seconds: Number(e.target.value) })}
                          style={{ background: "#161129", color: "#e9d5ff", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "6px", fontSize: "10px", padding: "2px 4px", cursor: "pointer" }}
                        >
                          <option value={0}>Tắt</option>
                          <option value={3}>3 giây</option>
                          <option value={5}>5 giây</option>
                          <option value={10}>10 giây</option>
                          <option value={30}>30 giây</option>
                        </select>
                      )}
                    </div>
                  );
                })()}
                {membersList.map((m) => {
                  const iAmOwner = membersList.find((x) => x.userId === currentUser?.id)?.role === "OWNER";
                  return (
                  <div key={m.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(22, 16, 38, 0.6)", padding: "7px 10px", borderRadius: "8px", fontSize: "11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={m.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
                      <span style={{ color: m.role === "OWNER" ? "#fde047" : "#fff" }}>{m.displayName}</span>
                      {m.role === "OWNER" && <span style={{ fontSize: "8.5px", background: "#713f12", color: "#fde047", padding: "1px 5px", borderRadius: "5px", fontWeight: 700 }}>CHỦ PHÒNG</span>}
                      {m.role === "MODERATOR" && <span style={{ fontSize: "8.5px", background: "#1e3a5f", color: "#7dd3fc", padding: "1px 5px", borderRadius: "5px", fontWeight: 700 }}>MOD</span>}
                      {actingHost?.userId === m.userId && <span style={{ fontSize: "8.5px", background: "#581c87", color: "#e9d5ff", padding: "1px 5px", borderRadius: "5px", fontWeight: 700 }}>TẠM QUYỀN</span>}
                      {m.muted && <span style={{ fontSize: "8.5px", background: "#7f1d1d", color: "#fecaca", padding: "1px 5px", borderRadius: "5px", fontWeight: 700 }}>🔇 MUTE</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {iAmOwner && m.userId !== currentUser?.id && m.role !== "OWNER" && (
                        <button
                          type="button"
                          onClick={() => socketRef.current?.emit("member:set-role", { userId: m.userId, role: m.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })}
                          style={{ fontSize: "9px", background: "#2b1650", color: "#c4b5fd", border: "1px solid rgba(167, 139, 250, 0.4)", padding: "2px 7px", borderRadius: "6px", cursor: "pointer" }}
                        >
                          {m.role === "MODERATOR" ? "Gỡ mod" : "Lên mod"}
                        </button>
                      )}
                      {(() => {
                        const me = membersList.find((x) => x.userId === currentUser?.id);
                        const staff = me?.role === "OWNER" || me?.role === "MODERATOR" || actingHost?.userId === currentUser?.id;
                        const canMod = staff && m.userId !== currentUser?.id && m.role !== "OWNER" && (me?.role === "OWNER" || (m.role === "MEMBER" && actingHost?.userId !== m.userId));
                        if (!canMod) return null;
                        const btnStyle = { fontSize: "9px", background: "#2b1650", color: "#c4b5fd", border: "1px solid rgba(167, 139, 250, 0.4)", padding: "2px 7px", borderRadius: "6px", cursor: "pointer" } as const;
                        return (
                          <>
                            <button type="button" style={btnStyle} onClick={() => socketRef.current?.emit("member:mute", { userId: m.userId, minutes: m.muted ? 0 : 5 })}>
                              {m.muted ? "Bỏ mute" : "Mute 5'"}
                            </button>
                            <button type="button" style={{ ...btnStyle, color: "#fca5a5", borderColor: "rgba(248, 113, 113, 0.45)" }} onClick={() => socketRef.current?.emit("member:kick", { userId: m.userId })}>
                              Mời ra
                            </button>
                          </>
                        );
                      })()}
                      <span style={{ fontSize: "9px", background: "#381c5a", color: "#c084fc", padding: "2px 6px", borderRadius: "6px" }}>
                        {m.seatLabel ? `Ghế ${m.seatLabel}` : "Đứng xem"}
                      </span>
                    </div>
                  </div>
                  );
                })}
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
        canModerate={canControl}
        roomCode={roomCode}
        currentTheme={roomTheme}
        onThemeChange={t => setRoomTheme(t)}
        currentUser={currentUser}
        missions={missions}
        leaderboard={leaderboard}
        leaderboardTab={leaderboardTab}
        setLeaderboardTab={setLeaderboardTab}
        videoQueue={videoQueue}
        queueForm={queueForm}
        setQueueForm={setQueueForm}
        userAppearance={userAppearance}
        setUserAppearance={setUserAppearance}
        donations={donations}
        donationInput={donationInput}
        setDonationInput={setDonationInput}
        projectedImage={projectedImage}
        featureTab={featureTab}
        setFeatureTab={setFeatureTab}
      />
      )}
    </div>
  );
}
