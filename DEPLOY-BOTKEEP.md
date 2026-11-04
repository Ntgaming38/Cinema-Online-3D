# Triển khai Cinema Online 3D lên Botkeep

Tài liệu ngắn để copy khi cấu hình panel. Kiến trúc đã chốt ban đầu: mỗi thành phần một server Botkeep riêng. **Cập nhật 2026-11-05:** trần đĩa 1.024MB của gói Free không chứa nổi một lần cài đầy đủ monorepo + bản build cho MỖI server riêng (daemon Botkeep tự dừng tiến trình khi vượt giới hạn đĩa, đã xác nhận từ log), nên server Cinema hiện chạy **chế độ gộp** (`npm start` = gateway `start:all`: web + realtime trong cùng 1 server). Các launcher tự xóa cache tải xuống của npm sau khi cài để chừa đĩa cho bước build (chừa lại bằng biến `CINEMA_KEEP_NPM_CACHE=1`).

---

## 1. Server WEB (server hiện tại — tài khoản Botkeep #3 "Cinema")

| Mục | Giá trị |
|---|---|
| Server type | **Application** (KHÔNG chọn "Service & website" — loại đó chỉ cho web tĩnh/PHP, không chạy được Node.js) |
| Runtime | **Node.js 24** |
| Server name | `Cinema Online 3D` |
| Start command | `npm start` |
| GitHub repo | `Ntgaming38/Cinema-Online-3D` |
| GitHub branch | `main` sau khi đã merge bản sửa vào main (branch `fix/unified-stage-and-features` phải được push + merge trước) |
| Endpoint đã cấp | `node9.botkeep.cloud:49521` |
| Tài nguyên | Kéo max gói Free: RAM 512MB · CPU 50% · Storage 1024MB |

`npm start` ở root = **chế độ gộp** qua `scripts/start-all.mjs` (xem mục 3): gateway nghe tại cổng `SERVER_PORT` do Botkeep cấp, web chạy nội bộ ở 3100, realtime ở 4001. Nếu chưa có bản build `.next`/`dist` (Botkeep chỉ sync file rồi chạy start), các launcher tự chạy build trước. Chạy riêng lẻ vẫn còn: `npm run start:web` (chỉ web), `npm run start:realtime` (chỉ realtime).

### Biến môi trường phải đặt trong panel (tab Environment) — server WEB

```text
DATABASE_URL=<connection string TiDB Cloud>
JWT_SECRET=<giữ nguyên giá trị hiện tại — không đổi>
NODE_ENV=production
NEXT_PUBLIC_REALTIME_URL=<xem mục 3>
```

Lưu ý: `NEXT_PUBLIC_*` được Next.js "đóng" vào bản build — đổi giá trị này xong phải **build/redeploy lại** web mới có hiệu lực.

### Bật web access / Domains sau khi tạo server

1. Mở server → tab **Domains** → **Enable web access** để nhận địa chỉ `*.bot-keep.xyz`.
2. (Tuỳ chọn) đặt Pretty alias, ví dụ `cinemaonline3d` → `https://cinemaonline3d.bot-keep.xyz`.
3. Bật HTTPS nếu panel yêu cầu thêm một bước riêng.
4. Lấy đúng địa chỉ public cuối cùng để điền vào `WEB_ORIGIN` của server realtime và (khi tách riêng) `NEXT_PUBLIC_REALTIME_URL` của web.

---

## 2. Server REALTIME (sau này — tài khoản Botkeep khác, khi cần tách)

| Mục | Giá trị |
|---|---|
| Server type | **Application** |
| Runtime | **Node.js 24** |
| Server name | `Cinema Online 3D — Realtime` |
| Start command | `npm run start:realtime` |
| GitHub repo / branch | `Ntgaming38/Cinema-Online-3D` / `main` |
| Tài nguyên | Kéo max gói Free |

### Biến môi trường — server REALTIME

```text
DATABASE_URL=<connection string TiDB Cloud — cùng database với web>
JWT_SECRET=<PHẢI giống hệt giá trị ở server web>
NODE_ENV=production
WEB_ORIGIN=https://<domain public của server web>
```

- Không đặt `REALTIME_PORT` trên Botkeep: code ưu tiên `SERVER_PORT || PORT || REALTIME_PORT || 4001`, nên server realtime tự nghe đúng cổng Botkeep cấp.
- `WEB_ORIGIN`: danh sách origin cách nhau bằng dấu phẩy. Có thể đặt tạm `*` (cho mọi origin, server tự phản chiếu origin của request) khi chưa biết domain web; biết rồi thì thay bằng domain cụ thể.
- Realtime có endpoint kiểm tra sống: `GET /health`.

Sau khi realtime có domain public, quay lại server WEB đặt:

```text
NEXT_PUBLIC_REALTIME_URL=https://<domain public của server realtime>
```

rồi build/redeploy lại web.

---

## 3. Chọn NEXT_PUBLIC_REALTIME_URL theo chế độ

| Chế độ | Giá trị |
|---|---|
| **Tách riêng (đã chốt)** — realtime ở server khác | `https://<domain realtime>` |
| **Gộp (dự phòng)** — một server chạy `npm run start:all` | Để **trống/không đặt**: bản production tự dùng cùng origin của trang web (gateway chuyển `/socket.io/` sang realtime) |
| Local dev | Không đặt → tự dùng `http://localhost:4001` |

Chế độ gộp (dự phòng): đổi Start command thành `npm run start:all`. Gateway (Node thuần, không thêm thư viện) nghe ở cổng public, chạy web ở cổng nội bộ 3100 và realtime ở 4001, chuyển `/socket.io/` (polling + WebSocket) sang realtime, còn lại sang web.

---

## 4. Các lệnh start ở root (tham khảo)

```text
npm start              # GỘP: gateway + web + realtime trong 1 server (mặc định trên Botkeep hiện tại)
npm run start:web      # chỉ WEB
npm run start:realtime # chỉ REALTIME
npm run start:all      # GỘP (tên tường minh của npm start)
npm run build          # build cả web (.next) và realtime (dist)
```

Các launcher tự build phần còn thiếu (`.next` / `dist`) và `postinstall` tự chạy `prisma generate`. Thứ tự ưu tiên cổng của web: `SERVER_PORT || PORT || 3000`; của realtime: `SERVER_PORT || PORT || REALTIME_PORT || 4001`. **`SERVER_PORT` do Botkeep cấp lúc chạy — không đặt tay trong panel.**

## 5. Lưu ý RAM 512MB

- Gói Free chỉ có **512MB RAM**: `next build` khá nặng, lần build đầu trên Botkeep có thể chậm hoặc hụt RAM. Nếu build trên Botkeep thất bại vì RAM, hãy build sẵn ở máy local/PC rồi mới tính phương án đưa bản build lên, hoặc tách build khỏi lúc start.
- Khi chạy production, web + Prisma ở mức 512MB là chật — theo dõi mục Usage sau khi chạy thật; đây là lý do kiến trúc tách server được ưu tiên thay vì gộp.
