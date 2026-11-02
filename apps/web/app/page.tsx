"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film,
  Users,
  Sparkles,
  LockKeyhole,
  Plus,
  Tv,
  LogIn,
  LogOut,
  User,
  Shield,
  Eye,
  Check,
  X,
  PlayCircle
} from "lucide-react";

interface PublicRoomItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: "WAITING" | "PLAYING" | "PAUSED" | "ENDED";
  visibility: "PUBLIC" | "PRIVATE";
  maxMembers: number;
  owner: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  video?: {
    title: string;
    sourceUrl: string;
    posterUrl?: string;
  };
  _count: {
    members: number;
  };
}

interface UserProfile {
  id: string;
  username?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  isGuest: boolean;
}

export default function HomePage() {
  const router = useRouter();

  // Rooms Data from TiDB
  const [rooms, setRooms] = useState<PublicRoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Create Room Form State
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomVisibility, setRoomVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [roomPassword, setRoomPassword] = useState("");
  const [roomMaxMembers, setRoomMaxMembers] = useState(50);
  const [roomAllowMemberControl, setRoomAllowMemberControl] = useState(false);
  const [initialVideoUrl, setInitialVideoUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [initialVideoTitle, setInitialVideoTitle] = useState("Big Buck Bunny / Featured Video");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Auth Form State
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Load public rooms & current user session
  useEffect(() => {
    fetchRooms();
    fetchCurrentUser();
  }, []);

  async function fetchRooms() {
    try {
      setLoadingRooms(true);
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (e) {
      console.error("Fetch rooms failed:", e);
    } finally {
      setLoadingRooms(false);
    }
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
      } else {
        // Auto initialize guest session so user has a verified identity
        const guestRes = await fetch("/api/auth/guest", { method: "POST" });
        const guestData = await guestRes.json();
        if (guestData.user) {
          setCurrentUser(guestData.user);
        }
      }
    } catch (e) {
      console.error("Fetch auth failed:", e);
    }
  }

  // Handle Create Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          description: roomDesc.trim() || undefined,
          visibility: roomVisibility,
          password: roomVisibility === "PRIVATE" ? roomPassword.trim() : undefined,
          maxMembers: Number(roomMaxMembers),
          allowMemberControl: roomAllowMemberControl,
          video: initialVideoUrl.trim()
            ? {
                title: initialVideoTitle.trim() || "Video rạp chiếu",
                sourceUrl: initialVideoUrl.trim()
              }
            : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Không thể tạo phòng.");
        setCreateSubmitting(false);
        return;
      }

      // Automatically redirect to newly created room page!
      router.push(`/rooms/${data.room.code}`);
    } catch {
      setCreateError("Lỗi kết nối khi tạo phòng.");
      setCreateSubmitting(false);
    }
  };

  // Handle Login / Register
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { username: authUsername.trim(), password: authPassword }
        : { username: authUsername.trim(), password: authPassword, displayName: authDisplayName.trim() || authUsername.trim() };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Xác thực không thành công.");
        setAuthSubmitting(false);
        return;
      }

      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthUsername("");
      setAuthPassword("");
      setAuthDisplayName("");
    } catch {
      setAuthError("Lỗi kết nối máy chủ.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    fetchCurrentUser();
  };

  return (
    <main className="home-shell">
      {/* Top Bar */}
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Film />
          </span>
          <span>
            <b>TCG Cinema</b>
            <small>Xem phim cùng bạn bè</small>
          </span>
        </Link>

        <nav>
          <a className="active" href="#rooms">Rạp chiếu</a>
          <a href="#about">Tính năng</a>
          <a href="https://github.com/Ntgaming38/Cinema-Online-3D" target="_blank" rel="noopener noreferrer">Mã nguồn</a>
        </nav>

        <div className="profile">
          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="avatar">
                {currentUser.displayName ? currentUser.displayName.slice(0, 1).toUpperCase() : "U"}
              </span>
              <div>
                <b style={{ display: "block", fontSize: "13px", color: "#f3e8ff" }}>
                  {currentUser.displayName}
                </b>
                <small style={{ color: "#a78bfa" }}>
                  {currentUser.isGuest ? "Khách vãng lai" : `@${currentUser.username}`}
                </small>
              </div>

              {currentUser.isGuest ? (
                <button
                  type="button"
                  onClick={() => { setAuthMode("login"); setShowAuthModal(true); }}
                  style={{ background: "#2a1e45", border: "1px solid #4c2f82", color: "#d8b4fe", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <LogIn size={13} /> Đăng nhập
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Đăng xuất"
                  style={{ background: "transparent", border: "1px solid #3d2c58", color: "#a79bc2", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setAuthMode("login"); setShowAuthModal(true); }}
              style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <LogIn size={14} /> Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> YOUR VIRTUAL 3D AUDITORIUM
          </div>
          <h1>
            Rạp chiếu của bạn.<br />
            <em>Khoảnh khắc</em> của mọi người.
          </h1>
          <p>
            Mở rạp chiếu phim ảo 3D, mời bạn bè cùng xem YouTube, video MP4 hoặc luồng trực tiếp HLS.
            Mọi người luôn xem cùng một giây, cùng tương tác biểu cảm và trò chuyện theo thời gian thực.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowCreateModal(true)}
              style={{ cursor: "pointer", border: "none" }}
            >
              <Plus size={18} /> Mở phòng chiếu mới
            </button>
            <a className="secondary-btn" href="#rooms">
              Khám phá phòng hiện có
            </a>
          </div>
          <div className="hero-stats">
            <span>
              <b>3D Interactive</b>
              <small>Chọn ghế & ngồi cùng nhau</small>
            </span>
            <span>
              <b>Realtime Sync</b>
              <small>YouTube & HLS & MP4</small>
            </span>
            <span>
              <b>TiDB Cloud</b>
              <small>Lưu trữ phòng & chat an toàn</small>
            </span>
          </div>
        </div>

        <div className="hero-art" aria-label="Minh họa rạp chiếu 3D">
          <div className="art-glow" />
          <div className="screen-frame">
            <div className="screen-content">
              <span>NOW SHOWING</span>
              <strong>
                YOUR<br />
                MOVIE<br />
                <i>NIGHT</i>
              </strong>
              <small>WATCH TOGETHER IN 3D</small>
            </div>
          </div>
          <div className="stage" />
          <div className="seat-row row-one">
            <i /><i /><i /><i /><i />
          </div>
          <div className="seat-row row-two">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="seat-row row-three">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="floating-card">
            <span className="live-dot" /> Rạp chiếu trực tuyến 3D
          </div>
        </div>
      </section>

      {/* Discover Public Rooms Section (From TiDB Cloud) */}
      <section id="rooms" className="rooms-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">KHÁM PHÁ TI-DB CLOUD</div>
            <h2>Phòng chiếu đang hoạt động</h2>
          </div>
          <button
            type="button"
            onClick={fetchRooms}
            style={{ background: "#211933", border: "1px solid #432e63", color: "#c084fc", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
          >
            Làm mới ↻
          </button>
        </div>

        {loadingRooms ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#a78bfa" }}>
            Đang tải danh sách phòng từ cơ sở dữ liệu TiDB Cloud...
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#120e20", borderRadius: "16px", border: "1px solid #2d2242" }}>
            <Tv size={42} style={{ color: "#a855f7", margin: "0 auto 12px", opacity: 0.8 }} />
            <h3 style={{ fontSize: "17px", color: "#fff", marginBottom: "6px" }}>Chưa có phòng chiếu công khai nào</h3>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "20px" }}>Hãy là người đầu tiên tạo phòng rạp 3D và rủ bạn bè vào xem ngay!</p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowCreateModal(true)}
              style={{ cursor: "pointer", border: "none" }}
            >
              <Plus size={16} /> Tạo phòng đầu tiên
            </button>
          </div>
        ) : (
          <div className="room-grid">
            {rooms.map((room, i) => (
              <article className="room-card" key={room.code}>
                <div className={`room-poster poster-${i % 3}`}>
                  <span>{room.status === "PLAYING" ? "● Đang chiếu" : "○ Chờ phát"}</span>
                  <div>{room.video?.title ? room.video.title.slice(0, 20) : "TCG THEATER"}</div>
                </div>
                <div className="room-info">
                  <div>
                    <h3>{room.name}</h3>
                    <p>Chủ phòng: {room.owner?.displayName || "Ẩn danh"}</p>
                  </div>
                  <span className="viewer-count">
                    <Users size={15} />
                    {room._count?.members || 1}
                  </span>
                </div>
                <Link className="join-link" href={`/rooms/${room.code}`}>
                  {room.visibility === "PRIVATE" ? (
                    <>
                      <LockKeyhole size={15} /> Phòng riêng tư (Có mật khẩu)
                    </>
                  ) : (
                    "Vào xem phòng"
                  )}
                  <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Create Strip Banner */}
      <section id="create" className="create-strip">
        <div>
          <div className="eyebrow">TRẢI NGHIỆM ĐỒNG BỘ</div>
          <h2>Sẵn sàng mở rạp xem cùng bạn bè?</h2>
          <p>Tự do lựa chọn video YouTube, phim MP4 hoặc HLS, tùy chỉnh không gian rạp 3D và quản lý người xem.</p>
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={() => setShowCreateModal(true)}
          style={{ cursor: "pointer", border: "none" }}
        >
          <Plus size={18} /> Tạo phòng ngay
        </button>
      </section>

      {/* Footer */}
      <footer>
        <span>© 2026 TCG Cinema · Nền tảng xem phim trực tuyến 3D</span>
        <span>Built with Next.js 15, Three.js, Socket.IO & TiDB Cloud</span>
      </footer>

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "grid", placeItems: "center", zIndex: 10000, padding: "20px" }}>
          <div style={{ background: "#141022", border: "1px solid #3c2a55", borderRadius: "18px", padding: "26px", maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Tv size={20} color="#a855f7" />
                <h3 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>Tạo phòng rạp chiếu 3D</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{ background: "#450a0a", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", marginBottom: "14px", border: "1px solid #7f1d1d" }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "5px" }}>Tên phòng chiếu *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đêm Anime Cuối Tuần..."
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "5px" }}>Mô tả phòng</label>
                <input
                  type="text"
                  placeholder="Ghi chú cho bạn bè xem cùng..."
                  value={roomDesc}
                  onChange={e => setRoomDesc(e.target.value)}
                  style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "5px" }}>Quyền riêng tư</label>
                  <select
                    value={roomVisibility}
                    onChange={e => setRoomVisibility(e.target.value as any)}
                    style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                  >
                    <option value="PUBLIC">Công khai (Ai cũng vào được)</option>
                    <option value="PRIVATE">Riêng tư (Cần mật khẩu)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "5px" }}>Giới hạn khán giả</label>
                  <input
                    type="number"
                    min={2}
                    max={500}
                    value={roomMaxMembers}
                    onChange={e => setRoomMaxMembers(Number(e.target.value))}
                    style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                  />
                </div>
              </div>

              {roomVisibility === "PRIVATE" && (
                <div>
                  <label style={{ fontSize: "12px", color: "#fbbf24", display: "block", marginBottom: "5px" }}>Mật khẩu phòng *</label>
                  <input
                    type="password"
                    placeholder="Đặt mật khẩu để vào phòng..."
                    value={roomPassword}
                    onChange={e => setRoomPassword(e.target.value)}
                    style={{ width: "100%", background: "#0a0714", border: "1px solid #5a3d1c", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                    required={roomVisibility === "PRIVATE"}
                  />
                </div>
              )}

              <div style={{ borderTop: "1px solid #281d3d", paddingTop: "12px" }}>
                <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "5px" }}>Đường dẫn video khởi đầu</label>
                <input
                  type="text"
                  placeholder="URL YouTube (watch, youtu.be, shorts), MP4 hoặc HLS .m3u8"
                  value={initialVideoUrl}
                  onChange={e => setInitialVideoUrl(e.target.value)}
                  style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="allowControl"
                  checked={roomAllowMemberControl}
                  onChange={e => setRoomAllowMemberControl(e.target.checked)}
                />
                <label htmlFor="allowControl" style={{ fontSize: "12px", color: "#d8b4fe", cursor: "pointer" }}>
                  Cho phép mọi người cùng điều khiển video (Play/Pause/Seek)
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: "#211b33", border: "1px solid #432e63", color: "#d8c7f8", padding: "10px 18px", borderRadius: "9px", cursor: "pointer", fontSize: "13px" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", padding: "10px 22px", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}
                >
                  {createSubmitting ? "Đang tạo..." : "Mở phòng & Vào ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTH MODAL (LOGIN / REGISTER) */}
      {showAuthModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "grid", placeItems: "center", zIndex: 10000, padding: "20px" }}>
          <div style={{ background: "#141022", border: "1px solid #3c2a55", borderRadius: "18px", padding: "26px", maxWidth: "420px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>
                {authMode === "login" ? "Đăng nhập tài khoản" : "Đăng ký thành viên"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {authError && (
              <div style={{ background: "#450a0a", color: "#fca5a5", padding: "10px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px", border: "1px solid #7f1d1d" }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "4px" }}>Tên đăng nhập</label>
                <input
                  type="text"
                  placeholder="username..."
                  value={authUsername}
                  onChange={e => setAuthUsername(e.target.value)}
                  style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                  required
                />
              </div>

              {authMode === "register" && (
                <div>
                  <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "4px" }}>Tên hiển thị trong rạp</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Hoàng Long, Gen.G..."
                    value={authDisplayName}
                    onChange={e => setAuthDisplayName(e.target.value)}
                    style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", color: "#c4b5fd", display: "block", marginBottom: "4px" }}>Mật khẩu</label>
                <input
                  type="password"
                  placeholder="Mật khẩu của bạn..."
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  style={{ width: "100%", background: "#0a0714", border: "1px solid #33234d", borderRadius: "9px", padding: "11px", color: "#fff", fontSize: "13px", outline: "none" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", padding: "11px", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, marginTop: "6px" }}
              >
                {authSubmitting ? "Đang xử lý..." : authMode === "login" ? "Đăng nhập" : "Đăng ký ngay"}
              </button>

              <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "#9ca3af" }}>
                {authMode === "login" ? (
                  <>
                    Chưa có tài khoản?{" "}
                    <button
                      type="button"
                      onClick={() => { setAuthMode("register"); setAuthError(""); }}
                      style={{ background: "transparent", border: "none", color: "#c084fc", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                    >
                      Đăng ký tại đây
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{" "}
                    <button
                      type="button"
                      onClick={() => { setAuthMode("login"); setAuthError(""); }}
                      style={{ background: "transparent", border: "none", color: "#c084fc", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                    >
                      Đăng nhập tại đây
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
