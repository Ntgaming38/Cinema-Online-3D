import Link from "next/link";
import { Film, Users, Sparkles, LockKeyhole, Plus } from "lucide-react";

const demoRooms = [
  { code: "ONEPIECE", title: "One Piece Film: Red", host: "Gen.G_VN", viewers: 86, tag: "Đang chiếu", private: false },
  { code: "ANIME01", title: "Anime Chill Night", host: "Raptor", viewers: 24, tag: "Sắp bắt đầu", private: false },
  { code: "VIP2026", title: "Phòng riêng cuối tuần", host: "Gen.G_VN", viewers: 4, tag: "Riêng tư", private: true }
];

export default function HomePage() {
  return <main className="home-shell">
    <header className="topbar">
      <Link href="/" className="brand"><span className="brand-mark"><Film /></span><span><b>TCG Cinema</b><small>Xem phim cùng bạn bè</small></span></Link>
      <nav><a className="active" href="#rooms">Rạp chiếu</a><a href="#community">Cộng đồng</a><a href="#about">Giới thiệu</a></nav>
      <div className="profile"><span className="avatar">G</span><span>Gen.G_VN</span></div>
    </header>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={15}/> YOUR PRIVATE CINEMA</div>
        <h1>Rạp chiếu của bạn.<br/><em>Khoảnh khắc</em> của mọi người.</h1>
        <p>Tạo phòng, mời bạn bè và cùng xem video trong một không gian rạp chiếu 3D. Mọi người luôn được đồng bộ cùng một thời điểm.</p>
        <div className="hero-actions"><a className="primary-btn" href="#create"><Plus size={18}/> Tạo phòng chiếu</a><a className="secondary-btn" href="#rooms">Khám phá phòng</a></div>
        <div className="hero-stats"><span><b>3D</b><small>Không gian rạp</small></span><span><b>Realtime</b><small>Đồng bộ phát</small></span><span><b>PC + Mobile</b><small>Mọi thiết bị</small></span></div>
      </div>
      <div className="hero-art" aria-label="Minh họa rạp chiếu 3D">
        <div className="art-glow"/><div className="screen-frame"><div className="screen-content"><span>NOW SHOWING</span><strong>YOUR<br/>MOVIE<br/><i>NIGHT</i></strong><small>WATCH TOGETHER</small></div></div>
        <div className="stage"/><div className="seat-row row-one"><i/><i/><i/><i/><i/></div><div className="seat-row row-two"><i/><i/><i/><i/><i/><i/></div><div className="seat-row row-three"><i/><i/><i/><i/><i/><i/><i/></div>
        <div className="floating-card"><span className="live-dot"/> 86 người đang xem</div>
      </div>
    </section>
    <section id="rooms" className="rooms-section">
      <div className="section-heading"><div><div className="eyebrow">DISCOVER</div><h2>Phòng chiếu nổi bật</h2></div><a href="#rooms">Xem tất cả ↗</a></div>
      <div className="room-grid">{demoRooms.map((room, i)=><article className="room-card" key={room.code}>
        <div className={`room-poster poster-${i}`}><span>{room.tag}</span><div>{i===0?"ONE PIECE":i===1?"ANIME CHILL":"PRIVATE ROOM"}</div></div>
        <div className="room-info"><div><h3>{room.title}</h3><p>Chủ phòng: {room.host}</p></div><span className="viewer-count"><Users size={15}/>{room.viewers}</span></div>
        <Link className="join-link" href={`/rooms/${room.code}`}>{room.private?<><LockKeyhole size={15}/> Xem phòng</>:"Vào xem phòng"} <span>→</span></Link>
      </article>)}</div>
    </section>
    <section id="create" className="create-strip"><div><div className="eyebrow">MAKE IT YOURS</div><h2>Sẵn sàng mở rạp?</h2><p>Trong bản khởi tạo này, trang tạo phòng và xác thực sẽ được nối vào API ở bước tiếp theo.</p></div><a className="primary-btn" href="mailto:admin@example.com?subject=TCG%20Cinema%20Room"><Plus size={18}/> Yêu cầu tạo phòng</a></section>
    <footer><span>© 2026 TCG Cinema</span><span>Built for movie nights together.</span></footer>
  </main>;
}
