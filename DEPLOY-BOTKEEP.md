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

---

## 6. Quy trình deploy chuẩn (rút kinh nghiệm 2026-11-04/05, cập nhật 2026-11-14)

Bản live hiện tại (https://sd2z43.bot-keep.xyz) chạy **chế độ GỘP** bằng đúng quy trình này. Build trực tiếp trên server đã thử 3 lần và đều chết (hết đĩa 1,024MB lúc cài, SIGKILL hết RAM 512MB lúc build) — đừng thử lại; luôn build sẵn ở máy ngoài.

1. **Dọn sâu TRƯỚC khi Sync**: trên panel Files của server, xóa hẳn `node_modules` và `~/.npm/_cacache`. Sync chụp ảnh cây file hiện có trước khi ghi bản mới — đĩa đang đầy là sync đứt giữa chừng ("Source staging was interrupted").
2. **Sync** theo GitHub `main` (panel tự cài dependencies; các launcher tự dọn cache npm sau cài và bỏ qua build khi đã có bản build sẵn).
3. **Build sẵn ở máy ngoài**: tải mã nguồn `main` mới nhất → `npm ci` → `prisma generate` → `npm run build` (chỉ cần phần web `.next`; realtime `dist` nhẹ, để launcher tự build). Nếu Node tải engine Prisma bị ECONNRESET: tải bằng curl từ `binaries.prisma.sh/all_commits/<hash>/debian-openssl-3.0.x/` (hash nằm trong `node_modules/@prisma/engines-version`), rồi generate với biến môi trường `PRISMA_QUERY_ENGINE_LIBRARY` + `PRISMA_SCHEMA_ENGINE_BINARY`. Lúc build dùng `JWT_SECRET`/`DATABASE_URL` giả — build không chạm database thật. Nén thư mục `apps/web/.next` (bỏ qua thư mục con `cache`) ≈ 1,7MB.
4. **Đưa bản build lên**: panel Files → upload file nén vào `apps/web/` → Unarchive → kiểm tra `.next/BUILD_ID` khớp bản vừa build.
5. **Env trên panel** (chỉ 4 biến): `DATABASE_URL`, `REALTIME_PORT`, `WEB_ORIGIN=https://sd2z43.bot-keep.xyz`, `JWT_SECRET`. **Không** đặt `NEXT_PUBLIC_REALTIME_URL` (chế độ gộp dùng cùng origin), không đặt tay `SERVER_PORT`.
6. **Start** → log phải có `Gateway listening on 0.0.0.0:49521` và `Ready`. Kiểm tra sống thật: mở trang chủ, `GET /api/rooms` trả dữ liệu thật, bắt tay Socket.IO polling (`/socket.io/?EIO=4&transport=polling`) trả về sid.
7. **Chống mất code (bài học 2026-11-14)**: `main` trên GitHub là nguồn sự thật duy nhất. Mọi phía — PC/VS Code, AI khác, Muse — phải `git pull` bản main mới nhất TRƯỚC khi push, tuyệt đối không force-push. Một lần push từ mốc cũ đã làm main mất 3 PR sửa deploy (đã khôi phục bằng PR #7).
8. **Prisma ở máy dev**: `npm run dev` đã gắn `scripts/prisma-client-guard.mjs` — client lệch phiên bản/schema sẽ tự generate lại; nếu guard in lỗi đỏ tiếng Việt thì làm theo hướng dẫn đó, đừng cố chạy app (sẽ lỗi P6001 khó hiểu trên mọi API).
