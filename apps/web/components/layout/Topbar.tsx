"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TopbarProps {
  currentUser?: { displayName?: string; avatarUrl?: string } | null;
  onLogout?: () => void;
  onProfileClick?: () => void;
}

export default function Topbar({
  currentUser,
  onLogout,
  onProfileClick,
}: TopbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div className="brand-mark"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></div>
          <div><b style={{ fontSize: "17px", letterSpacing: "-0.5px" }}>TCG Cinema</b><small>Xem phim cùng bạn bè</small></div>
        </Link>
        <nav className="desktop-nav" style={{ gap: "28px" }}>
          <Link href="/" className="nav-item" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c3bdd0", fontSize: "13px", fontWeight: 500 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> Trang chủ
          </Link>
          <button className="nav-item active" style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "999px", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="11" rx="2" ry="2" /><line x1="2" y1="7" x2="22" y2="7" /><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /></svg> Rạp chiếu
          </button>
          <Link href="/" className="nav-item" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c3bdd0", fontSize: "13px", fontWeight: 500 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.47" /></svg> Cộng đồng
          </Link>
          <Link href="/" className="nav-item" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c3bdd0", fontSize: "13px", fontWeight: 500 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg> Thành tích
          </Link>
        </nav>
        <form onSubmit={handleSearch} className="search-form" style={{ flex: 1, maxWidth: "520px", margin: "0 24px", display: "flex", gap: "8px" }}>
          <input type="text" placeholder="Tim phim... (Ctrl + K)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, background: "#0a0714", border: "1px solid #33234d", borderRadius: "12px", padding: "10px 14px", color: "#fff", fontSize: "13px", outline: "none" }} />
          <button type="submit" style={{ background: "#1a1629", border: "1px solid #33234d", color: "#c3bdd0", borderRadius: "12px", padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </button>
        </form>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button style={{ position: "relative", background: "transparent", border: "none", color: "#c3bdd0", cursor: "pointer", padding: "6px", borderRadius: "8px" }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            <span style={{ position: "absolute", top: "2px", right: "2px", background: "#ef4444", color: "#fff", fontSize: "9px", fontWeight: 800, width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>3</span>
          </button>
          {currentUser ? (
            <button onClick={onProfileClick} style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", cursor: "pointer", padding: "4px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #4c1d95)", border: "1px solid #a855f7", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: "12px" }}>{(currentUser.displayName || "U").charAt(0).toUpperCase()}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>{currentUser.displayName || "Nguoi dung"}</div>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          ) : (
            <button onClick={onProfileClick} style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "999px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>Dang nhap</button>
          )}
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: "none", background: "transparent", border: "none", color: "#c3bdd0", cursor: "pointer", padding: "8px" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
        </button>
      </div>
    </header>
  );
}
