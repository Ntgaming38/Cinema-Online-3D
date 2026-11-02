"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Trang chu", path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { href: "/", label: "Rap chieu", path: "M2 21v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2" },
  { href: "/", label: "Phim hot", path: "M13 2L3 14h9l-1 8 10-12h-9l-1 8z" },
  { href: "/", label: "Danh sach", path: "M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4" },
  { href: "/", label: "Cong dong", path: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" },
  { href: "/", label: "Cai dat", path: "M19.428 15.428a2 2 0 0 0 1.022-.547l2.387-4.775a1 1 0 0 0-.213-1.32l-2.487-1.142a1 1 0 0 0-1.32.213l-1.142 2.487a1 1 0 0 0 .213 1.32l1.142-2.487a1 1 0 0 1 1.32-.213l2.387-4.775a1 1 0 0 1 1.32.213l1.142 2.487a1 1 0 0 1-.213 1.32l-2.487 1.142a1 1 0 0 1-1.32-.213l-1.142-2.487a1 1 0 0 0-.213-1.32l-2.387 4.775a1 1 0 0 1-1.022.547z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <aside className="sidebar">
      <nav style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px" }}>
        {items.map((item, i) => (
          <Link key={i} href={item.href} className={isActive(item.href) ? "active" : ""} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "12px", color: isActive(item.href) ? "#fff" : "#a7a0b8", background: isActive(item.href) ? "#2a2242" : "transparent", fontSize: "13px", fontWeight: 500, textDecoration: "none", border: isActive(item.href) ? "1px solid #4a2f6c" : "none" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{item.path}</svg>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="vip-card" style={{ marginTop: "auto", padding: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: "16px" }}>V</div>
          <div><b style={{ display: "block", fontSize: "14px", color: "#fff" }}>Nang cap VIP</b><small style={{ color: "#c4b5fd" }}>Trai nghiem rap chieu khong gioi han!</small></div>
        </div>
        <button style={{ width: "100%", background: "linear-gradient(135deg, #9333ea, #7c3aed)", color: "#fff", border: "none", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginTop: "4px" }}>Nang cap ngay</button>
      </div>
    </aside>
  );
}
