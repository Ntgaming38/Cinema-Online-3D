import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#080710", color: "#f5f1ff" }}>
      <section style={{ width: "min(100%, 460px)", padding: 32, border: "1px solid #3b2857", borderRadius: 20, background: "linear-gradient(145deg, #171126, #0d0b16)", textAlign: "center", boxShadow: "0 16px 50px rgba(0, 0, 0, .45)" }}>
        <p style={{ margin: 0, color: "#c084fc", fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>CINEMA ONLINE 3D</p>
        <h1 style={{ margin: "12px 0 10px", fontSize: 28 }}>Không tìm thấy phòng chiếu</h1>
        <p style={{ margin: "0 0 24px", color: "#aaa3b9", fontSize: 14, lineHeight: 1.6 }}>Liên kết này có thể đã hết hạn hoặc phòng không còn tồn tại.</p>
        <Link href="/" style={{ display: "inline-flex", padding: "11px 18px", borderRadius: 10, background: "linear-gradient(135deg, #9333ea, #6d28d9)", color: "#fff", fontSize: 13, fontWeight: 700 }}>Về trang chủ</Link>
      </section>
    </main>
  );
}
