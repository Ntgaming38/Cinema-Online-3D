# CINEMA-ONLINE-3D — NỀN TẢNG XEM PHIM TRỰC TUYẾN 3D ĐỒNG BỘ THỜI GIAN THỰC

Nền tảng xem video, phim và rạp chiếu trực tuyến nhiều người tham gia cùng lúc trong không gian rạp 3D tương tác. Hỗ trợ YouTube, MP4, WebM và HLS (`.m3u8`), trò chuyện và biểu cảm thời gian thực, lưu trữ trên TiDB Cloud (MySQL-compatible).

---

## 1. Công nghệ nền tảng

- **Web Frontend / Fullstack**: Next.js 15 (App Router), React 19, TypeScript, Lucide Icons.
- **3D Graphics & Cinema Space**: Three.js, React Three Fiber (R3F), `@react-three/drei`.
- **Realtime Synchronization**: Socket.IO 4.8, Express, JWT authentication handshake.
- **Database & ORM**: TiDB Cloud (MySQL 8.0+ compatible), Prisma ORM 6.19.
- **Video Playback**:
  - Official YouTube IFrame Player API (Watch, youtu.be, Shorts, Embed).
  - HLS.js (`.m3u8`) với fallback Safari native HLS.
  - HTML5 Video Player (MP4, WebM).
- **Bảo mật**: Bcrypt password hashing, signed JWT auth tokens, socket permission middleware, anti-spam rate limiting.

---

## 2. Các tính năng chính

### 🎬 Hệ thống Video & Trình phát đa năng
- **Tự động nhận diện URL**: Phân tích thông minh link YouTube (watch, youtu.be, Shorts, Embed), HLS stream (`.m3u8`), tệp MP4, WebM.
- **YouTube IFrame API chính thức**: Không truyền URL YouTube vào thẻ `<video>`, tránh vi phạm chính sách và tương thích hoàn toàn.
- **Xử lý trạng thái thông minh**: Trạng thái tải (buffering spinner), báo lỗi khi video YouTube bị tắt tính năng nhúng (code 101/150) hoặc video bị xóa/riêng tư.
- **Hỗ trợ HLS linh hoạt**: Tích hợp `hls.js` cho Google Chrome, Firefox, Edge, Android; tự động dùng native HLS trên Safari iOS/macOS.

### ⏱️ Đồng bộ phát & Chống lệch thời gian (Drift Auto-Correction)
- **Đồng bộ thời gian thực**: Play, Pause, Seek (tua tới/lùi), thay đổi video mới.
- **Tự động hiệu chỉnh sai lệch**: Khi người mới tham gia hoặc kết nối lại, client tính toán thời điểm chính xác dựa trên timestamp server `updatedAt` và tự động nhảy đến đúng thời điểm (nếu lệch > 1.8s).
- **Chống vòng lặp vô hạn (Anti-looping)**: Cơ chế cờ `isRemoteActionRef` ngăn chặn sự kiện play/pause từ server phản xạ ngược lại lên socket.
- **Phân quyền chặt chẽ**:
  - **Chủ phòng (Owner)** & **Quản trị viên (Moderator)**: Toàn quyền điều khiển video, đổi nguồn phát, bật/tắt quyền điều khiển cho thành viên.
  - **Khán giả (Member)**: Mặc định chỉ theo dõi đồng bộ theo phòng, chỉ được điều khiển khi chủ phòng bật tùy chọn `allowMemberControl`.

### 🏛️ Không gian rạp 3D tương tác
- **Màn hình rạp chiếu & Ánh sáng động**: Màn hình rạp 3D phản ứng theo trạng thái video (tự động giảm ánh sáng phòng khi chiếu phim và tăng sáng dịu nhẹ khi tạm dừng).
- **Ghế ngồi có thể chọn**: Các dãy ghế A-E, 1-9 có thể click trực tiếp trong không gian 3D. Ghế của bạn sẽ sáng viền Neon, ghế có người khác ngồi hiển thị tên và avatar tương ứng.
- **Hiệu ứng Biểu cảm nổi 3D**: Biểu cảm reaction (❤️, 👍, 🔥, 😂, 🎉, 🍿) bay lơ lửng và tan biến sinh động cả trên màn hình 2D lẫn trong rạp 3D.
- **Bật/Tắt chế độ 3D**: Người dùng thiết bị di động hoặc máy cấu hình yếu có thể chuyển đổi mượt mà giữa chế độ "Rạp 3D" và "2D Gọn nhẹ".

### 💬 Trò chuyện & Biểu cảm (Chat & Reactions)
- **Lưu lịch sử vào TiDB Cloud**: Tin nhắn được lưu vào bảng `ChatMessage`, tự động tải 50 tin nhắn gần nhất khi vào phòng.
- **Chống spam & Giới hạn ký tự**: Rate limit (tối đa 5 tin nhắn/5s, 3 reactions/giây).
- **Tự động cuộn mượt mà**: Tin nhắn mới luôn cuộn về đáy, hiển thị thời gian và avatar người gửi.

### 👥 Người dùng & Quản lý phòng
- **Đăng ký / Đăng nhập / Đăng xuất**: Mật khẩu mã hóa bcrypt, phiên đăng nhập bằng JWT Cookie HTTP-only.
- **Chế độ Khách (Guest) an toàn**: Tự động cấp token định danh có chữ ký số cho khách vãng lai, không tạo user rác không cần thiết.
- **Tạo và quản lý phòng từ TiDB**: Hỗ trợ phòng công khai (PUBLIC), phòng riêng tư có mật khẩu (PRIVATE), giới hạn số lượng người tối đa, mã phòng ngẫu nhiên không trùng lặp.

---

## 3. Cấu hình môi trường (`.env`)

Tạo tệp `.env` tại thư mục gốc của dự án:

```env
# TiDB Cloud MySQL Connection String
DATABASE_URL="mysql://<user>:<password>@<host>:4000/<dbname>?sslaccept=strict"

# Realtime Socket.IO Server
NEXT_PUBLIC_REALTIME_URL="http://localhost:4001"
REALTIME_PORT=4001
WEB_ORIGIN="http://localhost:3000,http://localhost:3001"

# JWT Secret Key
JWT_SECRET="tcg-cinema-secret-key-prod-2026-tidb"
```

---

## 4. Hướng dẫn chạy cục bộ (Local Development)

### Bước 1: Cài đặt dependencies

```bash
npm install
```

### Bước 2: Đồng bộ cơ sở dữ liệu TiDB Cloud

```bash
npm run db:generate
npm run db:push
```

### Bước 3: Chạy kiểm thử tự động

```bash
npm test
```
*(Kiểm tra toàn bộ 11 bài unit test và 10 bài integration test trực tiếp trên TiDB Cloud)*.

### Bước 4: Khởi động hệ thống

```bash
npm run dev
```

Hệ thống sẽ chạy:
- **Web Frontend**: `http://localhost:3000` (hoặc `http://localhost:3001`)
- **Realtime Socket.IO**: `http://localhost:4001` (Kiểm tra sức khỏe tại `http://localhost:4001/health`)

---

## 5. Hướng dẫn kiểm tra tính năng

1. **Mở 2 tab trình duyệt khác nhau**:
   - Tab 1: Vào `http://localhost:3000`, bấm **Mở phòng chiếu mới**, nhập tên phòng và dán link YouTube (hoặc MP4/HLS).
   - Tab 2: Vào bằng mã phòng vừa tạo.
2. **Kiểm tra đồng bộ video**:
   - Ở Tab 1 (Chủ phòng), bấm **Phát**, **Tạm dừng**, hoặc tua thời gian (+10s / -10s).
   - Quan sát Tab 2: video tự động chạy và tua đúng giây mà không bị lặp sự kiện.
3. **Kiểm tra rạp 3D & Chọn ghế**:
   - Trên Tab 1, click vào ghế `C5`.
   - Trên Tab 2, ghế `C5` lập tức hiển thị tên của Tab 1. Click vào ghế `C6` cho Tab 2.
4. **Kiểm tra Chat & Reaction**:
   - Bấm các icon biểu cảm ❤️, 👍, 🔥, 🍿. Biểu cảm bay lên mượt mà trên cả 2 màn hình.
   - Nhập tin nhắn chat: tin nhắn hiển thị tức thời và được lưu vào cơ sở dữ liệu TiDB.

---

## 6. Hướng dẫn triển khai Production

- **Frontend (apps/web)**: Triển khai lên Vercel hoặc Docker container:
  - Thiết lập biến môi trường `DATABASE_URL`, `NEXT_PUBLIC_REALTIME_URL`, `JWT_SECRET`.
- **Backend Realtime (apps/realtime)**: Triển khai lên máy chủ VPS / Cloud Run / Railway / Render:
  - Thiết lập biến môi trường `DATABASE_URL`, `PORT` (hoặc `REALTIME_PORT`), `WEB_ORIGIN`, `JWT_SECRET`.
  - Đối với cấu hình nhiều instance realtime: có thể gắn `@socket.io/redis-adapter` để đồng bộ phòng đa server.
